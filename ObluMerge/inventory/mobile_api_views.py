"""
Inventory REST API Views for Mobile App.
Provides live executive dashboard metrics (matching the website inventory intelligence)
and live searchable catalog items from PostgreSQL.
"""

from collections import defaultdict
from datetime import timedelta, date, datetime
from decimal import Decimal
import calendar
import re
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from dateutil.relativedelta import relativedelta
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from django.db import transaction
from django.db.models import Sum, Count, Q, F, Max
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.authentication import SessionAuthentication

from .models import (
    InventoryItem,
    Category,
    DailyStockData,
    PurchaseOrderTracking,
    PurchaseOrderTrackingItem,
    PurchaseOrderStage,
    PurchaseOrderStageLog,
)
from .utils import (
    get_current_stage,
    get_expected_arrival_date,
    get_days_in_current_stage,
    get_remaining_days,
)
from .views import PurchaseOrderView, _pct, _growth_3m, _avg_daily
from customer_dashboard.models import Customer
from tally_voucher.models import Voucher, VoucherStockItem


def _json_safe(val):
    """Recursively converts date/datetime/Decimal values into JSON-safe primitives."""
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, date):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, dict):
        return {k: _json_safe(v) for k, v in val.items()}
    if isinstance(val, (list, tuple)):
        return [_json_safe(v) for v in val]
    return val


def format_inr(val):
    """Formats numbers using Indian notation (Lakhs and Crores) with rupee symbol."""
    if not val:
        return "₹0"
    try:
        v = float(val)
    except (ValueError, TypeError):
        return "₹0"
    if abs(v) >= 10000000:
        return f"₹{v / 10000000:.2f} Cr"
    elif abs(v) >= 100000:
        return f"₹{v / 100000:.2f} L"
    elif abs(v) >= 1000:
        return f"₹{v:,.0f}"
    else:
        return f"₹{v:.2f}"


class InventoryExecutiveDashboardAPIView(APIView):
    """
    GET /api/inventory/dashboard/?period=1m&anchor=today
    Returns live executive inventory KPIs, sales velocity trend,
    catalog health distribution, and critical stock alerts.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        req_start = request.GET.get("start_date", "").strip()
        req_end = request.GET.get("end_date", "").strip()
        period = request.GET.get("period", "").strip().lower()

        max_daily_date = DailyStockData.objects.aggregate(m=Max("date"))["m"]
        max_voucher_date = Voucher.objects.aggregate(m=Max("date"))["m"]
        latest_db_date = max_voucher_date or max_daily_date
        today = timezone.now().date()

        anchor_param = request.GET.get("anchor", "").strip().lower()
        if anchor_param == "today":
            anchor_mode = "today"
            ref_date = today
        elif anchor_param == "snapshot":
            anchor_mode = "snapshot"
            ref_date = latest_db_date or today
        else:
            if latest_db_date and (today - latest_db_date).days > 3:
                anchor_mode = "snapshot"
                ref_date = latest_db_date
            else:
                anchor_mode = "today"
                ref_date = today

        is_custom = False
        if req_start and req_end:
            try:
                parsed_start = datetime.strptime(req_start, "%Y-%m-%d").date()
                parsed_end = datetime.strptime(req_end, "%Y-%m-%d").date()
                if parsed_start <= parsed_end:
                    start_date = parsed_start
                    end_date = parsed_end
                    duration_days = max((end_date - start_date).days + 1, 1)
                    period = "custom"
                    period_label = f"{start_date.strftime('%d %b %Y')} – {end_date.strftime('%d %b %Y')}"
                    is_custom = True
            except (ValueError, TypeError):
                is_custom = False

        if not is_custom:
            if period == "3d":
                start_date = ref_date - timedelta(days=2)
                end_date = ref_date
                period_label = "Last 3 Days"
                duration_days = 3
            elif period == "3w":
                start_date = ref_date - timedelta(days=20)
                end_date = ref_date
                period_label = "Last 3 Weeks"
                duration_days = 21
            elif period == "3m":
                start_date = ref_date - timedelta(days=90)
                end_date = ref_date
                period_label = "Last 3 Months"
                duration_days = 90
            else:
                # DEFAULT: Full calendar month (1st to 30th/31st depending on the month)
                period = "1m"
                ref_year = ref_date.year
                ref_month = ref_date.month
                last_day = calendar.monthrange(ref_year, ref_month)[1]
                start_date = date(ref_year, ref_month, 1)
                end_date = date(ref_year, ref_month, last_day)
                period_label = ref_date.strftime("%B %Y")
                duration_days = max((end_date - start_date).days + 1, 1)

        # Sales aggregates from verified Tax Invoices (VoucherStockItem)
        sales_agg = VoucherStockItem.objects.filter(
            voucher__voucher_type__iexact="TAX INVOICE",
            voucher__date__gte=start_date,
            voucher__date__lte=end_date,
        ).aggregate(
            total_val=Sum("amount"),
            total_qty=Sum("quantity")
        )
        total_sales = float(sales_agg["total_val"] or 0)
        units_sold = int(round(sales_agg["total_qty"] or 0))

        # Previous period comparison for growth %
        prev_end_date = start_date - timedelta(days=1)
        prev_start_date = prev_end_date - timedelta(days=max(duration_days - 1, 0))
        prev_sales_agg = VoucherStockItem.objects.filter(
            voucher__voucher_type__iexact="TAX INVOICE",
            voucher__date__gte=prev_start_date,
            voucher__date__lte=prev_end_date,
        ).aggregate(
            total_val=Sum("amount"),
            total_qty=Sum("quantity")
        )
        prev_sales = float(prev_sales_agg["total_val"] or 0)
        prev_units = int(round(prev_sales_agg["total_qty"] or 0))

        sales_growth_pct = round(((total_sales - prev_sales) / prev_sales) * 100, 1) if prev_sales > 0 else 0.0
        units_growth_pct = round(((units_sold - prev_units) / prev_units) * 100, 1) if prev_units > 0 else 0.0

        # Orders Dispatched count
        orders_dispatched_count = Voucher.objects.filter(
            voucher_type__iexact="TAX INVOICE",
            date__gte=start_date,
            date__lte=end_date,
        ).count()

        prev_orders_dispatched_count = Voucher.objects.filter(
            voucher_type__iexact="TAX INVOICE",
            date__gte=prev_start_date,
            date__lte=prev_end_date,
        ).count()

        orders_growth_pct = (
            round(((orders_dispatched_count - prev_orders_dispatched_count) / prev_orders_dispatched_count) * 100, 1)
            if prev_orders_dispatched_count > 0 else 0.0
        )

        avg_daily_sales = total_sales / max(duration_days, 1)

        # Active POs count
        try:
            active_pos_count = PurchaseOrderTracking.objects.defer("manual_eta").filter(status="active").count()
        except Exception:
            active_pos_count = 0

        # Active commercial items: items with TAX INVOICE sales in trailing 90 days (Excluding Dead Stock)
        dead_stock_cutoff = end_date - timedelta(days=90)
        active_item_ids = list(
            VoucherStockItem.objects.filter(
                voucher__voucher_type__iexact="TAX INVOICE",
                voucher__date__gte=dead_stock_cutoff,
                voucher__date__lte=end_date,
                item_id__isnull=False,
            ).values_list("item_id", flat=True).distinct()
        )

        # Low stock count across active commercial catalog (Excluding Dead Stock)
        low_stock_items_qs = InventoryItem.objects.filter(
            id__in=active_item_ids,
            quantity__lt=F("min_quantity_outwards"),
            min_quantity_outwards__gt=0,
        )
        low_stock_count = low_stock_items_qs.count()
        total_products = len(active_item_ids) or InventoryItem.objects.count()

        # Sales Trend Data (from VoucherStockItem)
        trend_qs = (
            VoucherStockItem.objects.filter(
                voucher__voucher_type__iexact="TAX INVOICE",
                voucher__date__gte=start_date,
                voucher__date__lte=end_date,
            )
            .values("voucher__date")
            .annotate(
                daily_val=Sum("amount"),
                daily_qty=Sum("quantity")
            )
            .order_by("voucher__date")
        )

        daily_orders_map = dict(
            Voucher.objects.filter(
                voucher_type__iexact="TAX INVOICE",
                date__gte=start_date,
                date__lte=end_date,
            )
            .values("date")
            .annotate(cnt=Count("id"))
            .values_list("date", "cnt")
        )

        trend_labels = []
        trend_values = []
        trend_quantities = []
        trend_orders = []
        peak_val = 0.0
        peak_day_str = "N/A"

        for t in trend_qs:
            val = round(float(t["daily_val"] or 0), 2)
            qty = round(float(t["daily_qty"] or 0), 1)
            t_date = t["voucher__date"]
            date_str = t_date.strftime("%d %b")
            orders_cnt = daily_orders_map.get(t_date, 0)
            trend_labels.append(date_str)
            trend_values.append(val)
            trend_quantities.append(qty)
            trend_orders.append(orders_cnt)
            if val > peak_val:
                peak_val = val
                peak_day_str = date_str

        # Top 5 Categories (from VoucherStockItem)
        cat_qs = (
            VoucherStockItem.objects.filter(
                voucher__voucher_type__iexact="TAX INVOICE",
                voucher__date__gte=start_date,
                voucher__date__lte=end_date,
                item__isnull=False,
            )
            .values("item__category__name")
            .annotate(
                cat_val=Sum("amount"),
                cat_qty=Sum("quantity")
            )
            .order_by("-cat_val")[:5]
        )

        top_categories = []
        for idx, cat in enumerate(cat_qs, 1):
            val = float(cat["cat_val"] or 0)
            qty = int(round(cat["cat_qty"] or 0))
            share_pct = round((val / total_sales * 100), 1) if total_sales > 0 else 0
            top_categories.append({
                "rank": idx,
                "name": cat["item__category__name"] or "Uncategorized",
                "sales_value": val,
                "sales_value_display": format_inr(val),
                "units_sold": f"{qty:,}",
                "percent": share_pct,
            })

        # Top Products & Low Stock Alerts (from VoucherStockItem)
        prod_qs = (
            VoucherStockItem.objects.filter(
                voucher__voucher_type__iexact="TAX INVOICE",
                voucher__date__gte=start_date,
                voucher__date__lte=end_date,
                item__isnull=False,
            )
            .values(
                "item__id",
                "item__name",
                "item__category__name",
                "item__quantity",
                "item__min_quantity_outwards",
                "item__min_quantity_average",
                "item__min_quantity",
                "item__unit",
            )
            .annotate(
                prod_val=Sum("amount"),
                prod_qty=Sum("quantity")
            )
            .order_by("-prod_val")[:5]
        )

        top_products = []
        smart_alerts = []
        low_stock_fast_movers = 0

        for idx, p in enumerate(prod_qs, 1):
            val = float(p["prod_val"] or 0)
            qty_sold = int(round(p["prod_qty"] or 0))
            current_stock = p["item__quantity"]
            if current_stock is None:
                current_stock = 0

            threshold = (
                p["item__min_quantity_outwards"]
                if p["item__min_quantity_outwards"] and p["item__min_quantity_outwards"] > 0
                else (
                    p["item__min_quantity_average"]
                    if p["item__min_quantity_average"] and p["item__min_quantity_average"] > 0
                    else p["item__min_quantity"]
                )
            )

            is_running_low = False
            is_critical = False
            if current_stock <= 0:
                is_running_low = True
                is_critical = True
                low_stock_fast_movers += 1
                stock_ratio = 0
            elif threshold and threshold > 0:
                stock_ratio = min(int(round((current_stock / threshold) * 100)), 100)
                if current_stock < threshold:
                    is_running_low = True
                    low_stock_fast_movers += 1
            else:
                stock_ratio = 100

            p_name = p["item__name"] or "Item"

            top_products.append({
                "rank": idx,
                "id": p["item__id"],
                "name": p_name,
                "category": p["item__category__name"] or "Uncategorized",
                "sales_value": val,
                "sales_value_display": format_inr(val),
                "units_sold": f"{qty_sold:,}",
                "current_stock": current_stock,
                "min_threshold": threshold if (threshold and threshold > 0) else "N/A",
                "stock_ratio": stock_ratio,
                "is_running_low": is_running_low,
                "is_critical": is_critical,
                "unit": p["item__unit"] or "units",
            })

            if is_running_low:
                smart_alerts.append({
                    "product_id": p["item__id"],
                    "product_name": p_name,
                    "category": p["item__category__name"] or "Uncategorized",
                    "current_stock": current_stock,
                    "min_threshold": threshold if (threshold and threshold > 0) else "N/A",
                    "severity": "critical" if is_critical else "warning",
                    "message": (
                        "Zero stock available! Top mover completely out of stock."
                        if is_critical
                        else "Fast-moving SKU operating below safety reorder threshold."
                    ),
                })

        # Top 5 Customers by Value (from VoucherStockItem)
        cust_qs = (
            VoucherStockItem.objects.filter(
                voucher__voucher_type__iexact="TAX INVOICE",
                voucher__date__gte=start_date,
                voucher__date__lte=end_date,
                voucher__party_name__isnull=False,
            )
            .values("voucher__party_name")
            .annotate(
                cust_val=Sum("amount"),
                cust_qty=Sum("quantity"),
                order_count=Count("voucher_id", distinct=True)
            )
            .order_by("-cust_val")[:5]
        )
        top_customers_total = sum(float(c["cust_val"] or 0) for c in cust_qs)
        top_customers = []
        for idx, c in enumerate(cust_qs, 1):
            c_val = float(c["cust_val"] or 0)
            c_qty = int(round(c["cust_qty"] or 0))
            c_name = c["voucher__party_name"] or "Unknown Customer"
            words = [w for w in c_name.replace(".", " ").replace("-", " ").split() if w]
            initials = (words[0][:2] if len(words) == 1 else words[0][0] + words[1][0]).upper()
            share_pct = round((c_val / top_customers_total * 100), 1) if top_customers_total > 0 else 0

            top_customers.append({
                "rank": idx,
                "name": c_name,
                "initials": initials,
                "sales_value": c_val,
                "sales_value_display": format_inr(c_val),
                "units_purchased": f"{c_qty:,}",
                "order_count": c["order_count"],
                "percent": share_pct,
            })

        # Pending Supplier Orders (Active PurchaseOrderTracking)
        pending_pos = []
        try:
            pos_qs = (
                PurchaseOrderTracking.objects.filter(status="active")
                .select_related("tally_voucher")
                .prefetch_related("stage_logs__stage")
                .order_by("-order_date")[:5]
            )
            for po in pos_qs:
                v = po.tally_voucher
                last_log = po.stage_logs.order_by("-id").first()
                stage_name = last_log.stage.name if last_log and last_log.stage else "In Process..."
                eta_str = po.expected_delivery.strftime("%d %b %Y") if po.expected_delivery else "TBD"
                party = v.party_name if v else "Supplier"
                p_words = [w for w in party.replace(".", " ").replace("-", " ").split() if w]
                p_initials = (p_words[0][:2] if len(p_words) == 1 else p_words[0][0] + p_words[1][0]).upper()
                pending_pos.append({
                    "id": po.id,
                    "po_number": f"#{po.id}",
                    "voucher_number": v.voucher_number if v else f"PO-{po.id:04d}",
                    "date": po.order_date.strftime("%d %b %Y") if po.order_date else "N/A",
                    "party_name": party,
                    "party_initials": p_initials,
                    "stage_name": stage_name,
                    "eta": eta_str,
                    "status": "On Track",
                })
        except Exception:
            pending_pos = []

        # Catalog health (Excluding Dead Stock)
        active_catalog_qs = InventoryItem.objects.filter(id__in=active_item_ids)
        catalog_total = active_catalog_qs.count() or 1
        catalog_out_of_stock = active_catalog_qs.filter(
            Q(quantity__lte=0) | Q(quantity__isnull=True)
        ).count()
        catalog_low_stock = active_catalog_qs.filter(
            quantity__gt=0,
            quantity__lt=F("min_quantity_outwards"),
            min_quantity_outwards__gt=0
        ).count()
        catalog_healthy = max(0, catalog_total - catalog_out_of_stock - catalog_low_stock)
        dead_stock_count = InventoryItem.objects.exclude(id__in=active_item_ids).count()

        return Response({
            "status": "success",
            "period": period,
            "period_label": period_label,
            "is_custom": is_custom,
            "duration_days": duration_days,
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d"),
            "date_range_display": f"{start_date.strftime('%d %b %Y')} – {end_date.strftime('%d %b %Y')} ({period_label})",
            "anchor_mode": anchor_mode,
            "max_daily_date": max_daily_date.strftime("%d %b %Y") if max_daily_date else None,
            "today_date": today.strftime("%d %b %Y"),
            "kpis": {
                "outwards_sales_value": total_sales,
                "outwards_sales_value_display": format_inr(total_sales),
                "sales_growth_pct": abs(sales_growth_pct),
                "is_sales_growth_positive": sales_growth_pct >= 0,
                "avg_daily_sales_display": format_inr(avg_daily_sales),
                "orders_dispatched": orders_dispatched_count,
                "orders_dispatched_display": f"{orders_dispatched_count:,} Orders",
                "orders_growth_pct": abs(orders_growth_pct),
                "is_orders_growth_positive": orders_growth_pct >= 0,
                "units_sold": units_sold,
                "units_sold_display": f"{units_sold:,} units",
                "units_growth_pct": abs(units_growth_pct),
                "is_units_growth_positive": units_growth_pct >= 0,
                "pending_supplier_orders": active_pos_count,
                "low_stock_skus": low_stock_count,
                "low_stock_fast_movers": low_stock_fast_movers,
                "low_stock_fast_movers_alert": f"{low_stock_fast_movers} Top Movers require urgent reordering" if low_stock_fast_movers > 0 else "All top movers in optimal supply",
                "total_skus": total_products,
            },
            "sales_velocity": {
                "total_revenue_display": format_inr(total_sales),
                "peak_day": peak_day_str,
                "peak_sales_display": format_inr(peak_val) if peak_val > 0 else "N/A",
                "daily_run_rate_display": format_inr(avg_daily_sales),
                "trend_labels": trend_labels,
                "trend_values": trend_values,
                "trend_quantities": trend_quantities,
                "trend_orders": trend_orders,
            },
            "catalog_health": {
                "total_skus": total_products,
                "optimal_stock": catalog_healthy,
                "optimal_pct": round((catalog_healthy / catalog_total) * 100, 1),
                "low_stock": catalog_low_stock,
                "low_pct": round((catalog_low_stock / catalog_total) * 100, 1),
                "critical_stock": catalog_out_of_stock,
                "critical_pct": round((catalog_out_of_stock / catalog_total) * 100, 1),
                "dead_stock": dead_stock_count,
            },
            "top_categories": top_categories,
            "top_products": top_products,
            "top_customers": top_customers,
            "pending_supplier_orders": pending_pos,
            "smart_alerts": smart_alerts,
        })


class InventoryItemListAPIView(APIView):
    """
    GET /api/inventory/items/?page=1&page_size=30&q=...&status=all|in_stock|low_stock|critical
    Returns real PostgreSQL inventory items for catalog browsing.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.GET.get("q", "").strip()
        status_filter = request.GET.get("status", "all").strip().lower()
        category_id = request.GET.get("category", "").strip()
        try:
            page = max(1, int(request.GET.get("page", 1)))
        except (ValueError, TypeError):
            page = 1
        try:
            page_size = min(100, max(10, int(request.GET.get("page_size", 30))))
        except (ValueError, TypeError):
            page_size = 30

        qs = InventoryItem.objects.select_related("category").all()

        if category_id and category_id.isdigit():
            qs = qs.filter(category_id=int(category_id))

        if q:
            clean_id = re.sub(r'^(?:sku[-\s:]*|#)', '', q, flags=re.IGNORECASE).strip()
            if clean_id.isdigit():
                qs = qs.filter(id=int(clean_id))
            else:
                direct_filter = Q(name__icontains=q) | Q(category__name__icontains=q)
                if qs.filter(direct_filter).exists():
                    qs = qs.filter(direct_filter)
                else:
                    tokens = [t for t in re.split(r'[\s,_\-]+', q) if len(t) > 1]
                    if tokens:
                        token_q = Q()
                        for t in tokens:
                            token_q &= (Q(name__icontains=t) | Q(category__name__icontains=t))
                        if qs.filter(token_q).exists():
                            qs = qs.filter(token_q)
                        else:
                            any_token_q = Q()
                            for t in tokens:
                                any_token_q |= (Q(name__icontains=t) | Q(category__name__icontains=t))
                            qs = qs.filter(any_token_q)
                    else:
                        qs = qs.filter(direct_filter)

        # Trailing 90-day active window for commercial viability (Excluding Dead Stock)
        latest_voucher_date = VoucherStockItem.objects.filter(
            voucher__voucher_type__iexact="TAX INVOICE"
        ).aggregate(m=Max("voucher__date"))["m"] or timezone.now().date()
        cutoff_90 = latest_voucher_date - timedelta(days=90)
        active_item_ids = set(
            VoucherStockItem.objects.filter(
                voucher__voucher_type__iexact="TAX INVOICE",
                voucher__date__gte=cutoff_90,
                item_id__isnull=False,
            ).values_list("item_id", flat=True).distinct()
        )

        if status_filter == "in_stock":
            qs = qs.filter(quantity__gte=F("min_quantity_outwards"))
        elif status_filter == "low_stock":
            qs = qs.filter(id__in=active_item_ids, quantity__gt=0, quantity__lt=F("min_quantity_outwards"))
        elif status_filter == "critical":
            qs = qs.filter(id__in=active_item_ids).filter(Q(quantity__lte=0) | Q(quantity__isnull=True))
        elif status_filter == "dead_stock":
            qs = qs.exclude(id__in=active_item_ids)

        total_count = qs.count()
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        start_idx = (page - 1) * page_size
        items = qs.order_by("name")[start_idx : start_idx + page_size]

        # Overall counts for pills (Excluding Dead Stock from Low Stock)
        base_qs = InventoryItem.objects.all()
        counts = {
            "total": base_qs.count(),
            "in_stock": base_qs.filter(quantity__gte=F("min_quantity_outwards")).count(),
            "low_stock": base_qs.filter(id__in=active_item_ids, quantity__gt=0, quantity__lt=F("min_quantity_outwards")).count(),
            "critical": base_qs.filter(id__in=active_item_ids).filter(Q(quantity__lte=0) | Q(quantity__isnull=True)).count(),
            "dead_stock": base_qs.exclude(id__in=active_item_ids).count(),
        }

        results = []
        for item in items:
            qty = item.quantity or 0
            reorder = item.min_quantity_outwards or item.min_quantity or 0
            is_active = item.id in active_item_ids
            if not is_active:
                item_status = "Dead Stock"
            elif qty <= 0:
                item_status = "Critical"
            elif reorder > 0 and qty < reorder:
                item_status = "Low Stock"
            else:
                item_status = "In Stock"

            results.append({
                "id": str(item.id),
                "name": item.name or "Item",
                "sku": f"SKU-{item.id:04d}",
                "category": item.category.name if item.category else "General",
                "stock": qty,
                "unit": item.unit or "pcs",
                "reorderLevel": reorder,
                "status": item_status,
            })

        return Response({
            "status": "success",
            "page": page,
            "page_size": page_size,
            "total_count": total_count,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
            "counts": counts,
            "items": results,
        })

    def post(self, request):
        name = request.data.get("name", "").strip()
        if not name:
            return Response(
                {"status": "error", "message": "Product name is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        category_id = request.data.get("category_id")
        category_name = (request.data.get("category_name") or "").strip()
        category = None
        if category_id:
            try:
                category = Category.objects.get(id=int(category_id))
            except (Category.DoesNotExist, ValueError):
                pass
        elif category_name:
            category = Category.objects.filter(name__iexact=category_name).first()
            if not category:
                category = Category.objects.create(name=category_name)

        unit = request.data.get("unit", "pcs").strip()
        try:
            quantity = int(request.data.get("quantity", 0))
        except (ValueError, TypeError):
            quantity = 0

        try:
            min_quantity = int(request.data.get("min_quantity", 0))
        except (ValueError, TypeError):
            min_quantity = 0

        try:
            delivery_days = int(request.data.get("expected_delivery_days", 7))
        except (ValueError, TypeError):
            delivery_days = 7

        try:
            moq = int(request.data.get("minimum_order_quantity", 1))
        except (ValueError, TypeError):
            moq = 1

        item = InventoryItem.objects.create(
            name=name,
            category=category,
            quantity=quantity,
            unit=unit,
            min_quantity=min_quantity,
            min_quantity_outwards=min_quantity,
            expected_delivery_days=delivery_days,
            minimum_order_quantity=moq,
        )

        return Response({
            "status": "success",
            "message": "Product added successfully.",
            "item": {
                "id": str(item.id),
                "name": item.name,
                "sku": f"SKU-{item.id:04d}",
                "category": item.category.name if item.category else "Uncategorized",
                "stock": item.quantity or 0,
                "unit": item.unit or "pcs",
                "reorderLevel": item.min_quantity or 0,
                "status": "In Stock" if (item.quantity or 0) > 0 else "Critical",
            }
        }, status=status.HTTP_201_CREATED)


class InventoryItemDetailAPIView(APIView):
    """
    GET /api/inventory/items/<int:pk>/
    Returns rich metadata for a single product.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        item = get_object_or_404(InventoryItem.objects.select_related("category"), pk=pk)

        # Determine status
        latest_voucher_date = VoucherStockItem.objects.filter(
            voucher__voucher_type__iexact="TAX INVOICE"
        ).aggregate(m=Max("voucher__date"))["m"] or timezone.now().date()
        cutoff_90 = latest_voucher_date - timedelta(days=90)
        is_active = VoucherStockItem.objects.filter(
            voucher__voucher_type__iexact="TAX INVOICE",
            voucher__date__gte=cutoff_90,
            item_id=item.id,
        ).exists()

        qty = item.quantity or 0
        reorder = item.min_quantity_outwards or item.min_quantity or 0
        if not is_active:
            item_status = "Dead Stock"
        elif qty <= 0:
            item_status = "Critical"
        elif reorder > 0 and qty < reorder:
            item_status = "Low Stock"
        else:
            item_status = "In Stock"

        # Recent 30 days outwards and revenue
        cutoff_30 = latest_voucher_date - timedelta(days=30)
        recent_sales = VoucherStockItem.objects.filter(
            voucher__voucher_type__iexact="TAX INVOICE",
            voucher__date__gte=cutoff_30,
            item_id=item.id,
        ).aggregate(
            qty=Sum("quantity"),
            val=Sum("amount")
        )

        return Response({
            "status": "success",
            "item": {
                "id": str(item.id),
                "name": item.name,
                "sku": f"SKU-{item.id:04d}",
                "category": {
                    "id": item.category.id if item.category else None,
                    "name": item.category.name if item.category else "Uncategorized",
                },
                "stock": qty,
                "unit": item.unit or "pcs",
                "reorder_threshold": reorder,
                "min_quantity": item.min_quantity or 0,
                "min_quantity_outwards": item.min_quantity_outwards or 0,
                "min_quantity_average": item.min_quantity_average or 0,
                "expected_delivery_days": item.expected_delivery_days or 7,
                "minimum_order_quantity": item.minimum_order_quantity or 1,
                "landing_date": item.landing_date.strftime("%Y-%m-%d") if item.landing_date else None,
                "status": item_status,
                "is_active_mover": is_active,
                "recent_30d_units_sold": int(round(recent_sales["qty"] or 0)),
                "recent_30d_revenue": float(recent_sales["val"] or 0),
                "recent_30d_revenue_display": format_inr(recent_sales["val"] or 0),
            }
        })


class InventoryItemForecastAPIView(APIView):
    """
    GET /api/inventory/items/<int:pk>/forecast/
    Returns predictive demand forecasting, safety buffer, and 3-month outlook.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        product = get_object_or_404(InventoryItem, pk=pk)
        daily_data = DailyStockData.objects.filter(product_id=pk).order_by("date")

        if not daily_data.exists():
            return Response({
                "status": "success",
                "product_id": str(product.id),
                "product_name": product.name,
                "current_stock": product.quantity or 0,
                "reorder_threshold": product.min_quantity_outwards or product.min_quantity or 0,
                "min_stock_trend": 0,
                "min_stock_demand": 0,
                "min_stock_demand_buffered": product.min_quantity_outwards or 0,
                "safety_buffer_pct": 10,
                "future_predictions": [],
                "monthly_history": [],
                "message": "No historical daily records found for this product.",
            })

        df = pd.DataFrame.from_records(
            daily_data.values(
                "date",
                "inwards_quantity",
                "inwards_value",
                "outwards_quantity",
                "outwards_value",
                "closing_quantity",
                "closing_value"
            )
        )

        df["date"] = pd.to_datetime(df["date"])
        df["month"] = df["date"].dt.month
        df["year"] = df["date"].dt.year

        monthly_summary = df.groupby(["year", "month"]).agg({
            "inwards_quantity": "sum",
            "inwards_value": "sum",
            "outwards_quantity": "sum",
            "outwards_value": "sum",
            "closing_quantity": "last",
            "closing_value": "last",
        }).reset_index()

        monthly_summary["Month"] = monthly_summary.apply(
            lambda row: f"{calendar.month_name[int(row['month'])]} {int(row['year'])}",
            axis=1
        )
        monthly_summary.reset_index(drop=True, inplace=True)
        monthly_summary["MonthIndex"] = np.arange(len(monthly_summary)).reshape(-1, 1)

        history_list = []
        for _, row in monthly_summary.iterrows():
            history_list.append({
                "month": row["Month"],
                "inwards_qty": int(round(row["inwards_quantity"] or 0)),
                "outwards_qty": int(round(row["outwards_quantity"] or 0)),
                "closing_qty": int(round(row["closing_quantity"] or 0)),
            })

        future_predictions = []
        min_stock_trend = 0
        min_stock_demand = 0
        min_stock_demand_buffered = product.min_quantity_outwards or 0

        if len(monthly_summary) >= 2:
            model_trend = LinearRegression()
            model_trend.fit(monthly_summary[["MonthIndex"]], monthly_summary["closing_quantity"])
            future_indices = np.array([len(monthly_summary), len(monthly_summary)+1, len(monthly_summary)+2]).reshape(-1, 1)
            trend_predictions = model_trend.predict(future_indices)

            model_demand = LinearRegression()
            model_demand.fit(monthly_summary[["MonthIndex"]], monthly_summary["outwards_quantity"])
            demand_predictions = model_demand.predict(future_indices)

            min_stock_trend = int(max(0, round(min(trend_predictions))))
            min_stock_demand = int(max(0, round(max(demand_predictions))))
            min_stock_demand_buffered = int(round(min_stock_demand * 1.1))

            last_year = int(monthly_summary.iloc[-1]["year"])
            last_month = int(monthly_summary.iloc[-1]["month"])
            last_date = date(last_year, last_month, 1)

            for i in range(3):
                future_date = last_date + relativedelta(months=i+1)
                lbl = f"{calendar.month_name[future_date.month]} {future_date.year}"
                future_predictions.append({
                    "month": lbl,
                    "trend_closing": int(max(0, round(trend_predictions[i]))),
                    "demand_outwards": int(max(0, round(demand_predictions[i]))),
                })
        else:
            avg_outwards = monthly_summary["outwards_quantity"].mean() or 0
            min_stock_demand = int(round(avg_outwards))
            min_stock_demand_buffered = int(round(avg_outwards * 1.1))

        return Response({
            "status": "success",
            "product_id": str(product.id),
            "product_name": product.name,
            "current_stock": product.quantity or 0,
            "reorder_threshold": product.min_quantity_outwards or product.min_quantity or 0,
            "min_stock_trend": min_stock_trend,
            "min_stock_demand": min_stock_demand,
            "min_stock_demand_buffered": min_stock_demand_buffered,
            "safety_buffer_pct": 10,
            "future_predictions": future_predictions,
            "monthly_history": history_list,
        })


class InventoryItemTrendsAPIView(APIView):
    """
    GET /api/inventory/items/<int:pk>/trends/
    Returns daily stock movement series (inwards, outwards, closing) for charts.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        product = get_object_or_404(InventoryItem, pk=pk)
        days = min(180, max(14, int(request.GET.get("days", 60))))

        qs = DailyStockData.objects.filter(product=product).order_by("date")
        total_count = qs.count()
        if total_count > days:
            qs = qs[total_count - days:]

        labels = []
        outwards = []
        closing = []
        inwards = []

        for entry in qs:
            labels.append(entry.date.strftime("%d %b"))
            outwards.append(int(round(entry.outwards_quantity or 0)))
            closing.append(int(round(entry.closing_quantity or 0)))
            inwards.append(int(round(entry.inwards_quantity or 0)))

        return Response({
            "status": "success",
            "product_id": str(product.id),
            "product_name": product.name,
            "current_stock": product.quantity or 0,
            "days_returned": len(labels),
            "labels": labels,
            "outwards": outwards,
            "closing": closing,
            "inwards": inwards,
            "total_outwards": sum(outwards),
            "total_inwards": sum(inwards),
            "avg_daily_velocity": round(sum(outwards) / max(len(outwards), 1), 1),
        })


class InventoryItemLedgerAPIView(APIView):
    """
    GET /api/inventory/items/<int:pk>/ledger/
    Returns chronological transaction entries from Tally vouchers for this item.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        product = get_object_or_404(InventoryItem, pk=pk)
        limit = min(100, max(10, int(request.GET.get("limit", 40))))

        vouchers = (
            VoucherStockItem.objects.filter(item=product)
            .select_related("voucher")
            .order_by("-voucher__date", "-id")[:limit]
        )

        entries = []
        for v in vouchers:
            v_obj = v.voucher
            entries.append({
                "id": v.id,
                "voucher_number": v_obj.voucher_number if v_obj else "N/A",
                "voucher_type": v_obj.voucher_type if v_obj else "VOUCHER",
                "date": v_obj.date.strftime("%Y-%m-%d") if v_obj and v_obj.date else None,
                "date_display": v_obj.date.strftime("%d %b %Y") if v_obj and v_obj.date else "N/A",
                "party_name": v_obj.party_name if v_obj else "Direct Customer",
                "quantity": float(v.quantity or 0),
                "unit": product.unit or "pcs",
                "rate": float(v.rate or 0),
                "amount": float(v.amount or 0),
                "amount_display": format_inr(v.amount or 0),
            })

        return Response({
            "status": "success",
            "product_id": str(product.id),
            "product_name": product.name,
            "total_entries": len(entries),
            "entries": entries,
        })


class InventoryCategoryListAPIView(APIView):
    """
    GET /api/inventory/categories/
    Returns all product categories with SKU counts and stock health metrics.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        categories = (
            Category.objects.annotate(
                sku_count=Count("inventoryitem"),
                total_units=Sum("inventoryitem__quantity")
            )
            .order_by("-sku_count")
        )

        latest_voucher_date = VoucherStockItem.objects.filter(
            voucher__voucher_type__iexact="TAX INVOICE"
        ).aggregate(m=Max("voucher__date"))["m"] or timezone.now().date()
        cutoff_90 = latest_voucher_date - timedelta(days=90)
        active_item_ids = set(
            VoucherStockItem.objects.filter(
                voucher__voucher_type__iexact="TAX INVOICE",
                voucher__date__gte=cutoff_90,
                item_id__isnull=False,
            ).values_list("item_id", flat=True).distinct()
        )

        results = []
        for cat in categories:
            items_qs = cat.inventoryitem_set.all()
            total_skus = cat.sku_count or 0
            low_count = items_qs.filter(id__in=active_item_ids, quantity__gt=0, quantity__lt=F("min_quantity_outwards")).count()
            crit_count = items_qs.filter(id__in=active_item_ids).filter(Q(quantity__lte=0) | Q(quantity__isnull=True)).count()
            dead_count = items_qs.exclude(id__in=active_item_ids).count()
            optimal_count = max(0, total_skus - low_count - crit_count - dead_count)

            results.append({
                "id": cat.id,
                "name": cat.name,
                "sku_count": total_skus,
                "total_units": cat.total_units or 0,
                "optimal_stock": optimal_count,
                "low_stock": low_count,
                "critical_stock": crit_count,
                "dead_stock": dead_count,
            })

        return Response({
            "status": "success",
            "total_categories": len(results),
            "categories": results,
        })


class InventoryLowStockAlertsAPIView(APIView):
    """
    GET /api/inventory/alerts/low-stock/
    Returns prioritized stockout deficits and safety threshold alerts for active products.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        latest_voucher_date = VoucherStockItem.objects.filter(
            voucher__voucher_type__iexact="TAX INVOICE"
        ).aggregate(m=Max("voucher__date"))["m"] or timezone.now().date()
        cutoff_90 = latest_voucher_date - timedelta(days=90)
        active_item_ids = set(
            VoucherStockItem.objects.filter(
                voucher__voucher_type__iexact="TAX INVOICE",
                voucher__date__gte=cutoff_90,
                item_id__isnull=False,
            ).values_list("item_id", flat=True).distinct()
        )

        cutoff_30 = latest_voucher_date - timedelta(days=30)
        recent_sales = dict(
            VoucherStockItem.objects.filter(
                voucher__voucher_type__iexact="TAX INVOICE",
                voucher__date__gte=cutoff_30,
                item_id__in=active_item_ids,
            )
            .values("item_id")
            .annotate(qty=Sum("quantity"), val=Sum("amount"))
            .values_list("item_id", "qty")
        )

        low_items = (
            InventoryItem.objects.filter(id__in=active_item_ids)
            .filter(
                Q(quantity__lte=0) |
                Q(quantity__isnull=True) |
                Q(quantity__lt=F("min_quantity_outwards"))
            )
            .select_related("category")
            .order_by("quantity")
        )

        critical_list = []
        warning_list = []

        for item in low_items:
            qty = item.quantity or 0
            threshold = item.min_quantity_outwards or item.min_quantity or 0
            sold_30 = float(recent_sales.get(item.id, 0) or 0)
            daily_run_rate = round(sold_30 / 30.0, 1)

            deficit = max(0, threshold - qty) if threshold > 0 else (1 if qty <= 0 else 0)
            days_left = round(qty / daily_run_rate, 1) if (daily_run_rate > 0 and qty > 0) else (0 if qty <= 0 else 999)

            alert_data = {
                "id": str(item.id),
                "name": item.name,
                "sku": f"SKU-{item.id:04d}",
                "category": item.category.name if item.category else "Uncategorized",
                "stock": qty,
                "unit": item.unit or "pcs",
                "threshold": threshold,
                "deficit": deficit,
                "daily_run_rate": daily_run_rate,
                "days_left": days_left,
                "severity": "critical" if qty <= 0 else "warning",
                "severity_label": "CRITICAL STOCKOUT" if qty <= 0 else "SAFETY DEFICIT",
            }

            if qty <= 0:
                critical_list.append(alert_data)
            else:
                warning_list.append(alert_data)

        return Response({
            "status": "success",
            "total_alerts": len(critical_list) + len(warning_list),
            "critical_count": len(critical_list),
            "warning_count": len(warning_list),
            "critical_alerts": critical_list,
            "warning_alerts": warning_list,
        })


class InventoryDeadStockAPIView(APIView):
    """
    GET /api/inventory/alerts/dead-stock/
    Returns non-moving inventory products with tied-up capital and last sold timestamps.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        latest_voucher_date = VoucherStockItem.objects.filter(
            voucher__voucher_type__iexact="TAX INVOICE"
        ).aggregate(m=Max("voucher__date"))["m"] or timezone.now().date()
        cutoff_90 = latest_voucher_date - timedelta(days=90)

        active_item_ids = set(
            VoucherStockItem.objects.filter(
                voucher__voucher_type__iexact="TAX INVOICE",
                voucher__date__gte=cutoff_90,
                item_id__isnull=False,
            ).values_list("item_id", flat=True).distinct()
        )

        dead_items_qs = InventoryItem.objects.exclude(id__in=active_item_ids).select_related("category")
        total_dead_skus = dead_items_qs.count()
        total_dead_units = dead_items_qs.aggregate(t=Sum("quantity"))["t"] or 0

        last_sales = dict(
            VoucherStockItem.objects.filter(
                voucher__voucher_type__iexact="TAX INVOICE",
                item_id__isnull=False
            )
            .values("item_id")
            .annotate(last_date=Max("voucher__date"))
            .values_list("item_id", "last_date")
        )

        page = max(1, int(request.GET.get("page", 1)))
        page_size = min(100, max(10, int(request.GET.get("page_size", 40))))
        start_idx = (page - 1) * page_size

        paginated = dead_items_qs.order_by("name")[start_idx : start_idx + page_size]

        items_list = []
        for item in paginated:
            qty = item.quantity or 0
            last_date = last_sales.get(item.id)
            days_inactive = (latest_voucher_date - last_date).days if last_date else 365

            items_list.append({
                "id": str(item.id),
                "name": item.name,
                "sku": f"SKU-{item.id:04d}",
                "category": item.category.name if item.category else "Uncategorized",
                "stock": qty,
                "unit": item.unit or "pcs",
                "last_sale_date": last_date.strftime("%d %b %Y") if last_date else "Never Sold",
                "days_inactive": days_inactive,
            })

        return Response({
            "status": "success",
            "total_dead_skus": total_dead_skus,
            "total_dead_units": total_dead_units,
            "page": page,
            "total_pages": max(1, (total_dead_skus + page_size - 1) // page_size),
            "items": items_list,
        })


def _parse_iso_datetime(val):
    if not val:
        return None
    s = str(val).strip()
    if not s:
        return None
    dt = parse_datetime(s)
    if dt is not None:
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        return dt
    d = parse_date(s[:10])
    if d is not None:
        return timezone.make_aware(datetime.combine(d, datetime.min.time()), timezone.get_current_timezone())
    return None


def _serialize_tracked_po(po, today=None):
    if today is None:
        today = timezone.localdate()

    items = []
    total_ordered = 0.0
    total_arrived = 0.0

    for it in po.items.all():
        ord_qty = float(it.ordered_quantity or 0)
        arr_qty = float(it.arrived_quantity or 0)
        total_ordered += ord_qty
        total_arrived += arr_qty
        items.append({
            "id": it.id,
            "inventory_item_id": it.inventory_item_id,
            "item_name": it.item_name_text or (it.inventory_item.name if it.inventory_item else "Item"),
            "ordered_quantity": ord_qty,
            "arrived_quantity": arr_qty,
            "is_fully_arrived": bool(it.is_fully_arrived),
            "remarks": it.remarks or "",
        })

    stage_logs = []
    for sl in po.stage_logs.all().order_by("entered_at", "id"):
        est = sl.stage.estimated_days if sl.stage else 0
        days_spent = float(sl.days_at_stage or 0)
        stage_logs.append({
            "id": sl.id,
            "stage_id": sl.stage_id,
            "stage_name": sl.stage.name if sl.stage else "Stage",
            "estimated_days": est,
            "is_final_stage": sl.stage.is_final_stage if sl.stage else False,
            "entered_at": sl.entered_at.isoformat() if sl.entered_at else None,
            "entered_at_display": sl.entered_at.strftime("%d %b %Y, %I:%M %p") if sl.entered_at else "—",
            "exit_datetime": sl.exit_datetime.isoformat() if sl.exit_datetime else None,
            "exit_datetime_display": sl.exit_datetime.strftime("%d %b %Y, %I:%M %p") if sl.exit_datetime else None,
            "days_at_stage": round(days_spent, 2),
            "manual_days_at_stage": float(sl.manual_days_at_stage) if sl.manual_days_at_stage is not None else None,
            "is_overdue": bool(est and days_spent > est),
            "is_current": sl.exit_datetime is None,
            "remarks": sl.remarks or "",
        })

    completion_pct = round((total_arrived / total_ordered * 100), 1) if total_ordered > 0 else 0.0
    system_eta = get_expected_arrival_date(po)
    effective_eta = po.manual_eta or system_eta
    remaining_days = (
        max(0, (po.manual_eta - today).days)
        if po.manual_eta
        else float(get_remaining_days(po) or 0)
    )
    current_stage = get_current_stage(po)
    days_in_stage = float(get_days_in_current_stage(po) or 0)

    v = po.tally_voucher
    return {
        "id": po.id,
        "voucher_id": v.id if v else None,
        "voucher_number": v.voucher_number if v else f"PO-{po.id:04d}",
        "party_name": v.party_name if v else "Supplier",
        "order_date": po.order_date.isoformat() if po.order_date else None,
        "order_date_display": po.order_date.strftime("%d %b %Y") if po.order_date else "N/A",
        "status": po.status,
        "status_display": po.get_status_display(),
        "arrival_datetime": po.arrival_datetime.isoformat() if po.arrival_datetime else None,
        "arrival_datetime_display": po.arrival_datetime.strftime("%d %b %Y, %I:%M %p") if po.arrival_datetime else None,
        "manual_eta": po.manual_eta.isoformat() if po.manual_eta else None,
        "system_eta": system_eta.isoformat() if system_eta else None,
        "expected_delivery": effective_eta.strftime("%d %b %Y") if effective_eta else "TBD",
        "remaining_days": round(float(remaining_days), 1) if effective_eta or current_stage else None,
        "total_days_taken": po.total_days_taken,
        "current_stage_name": current_stage.stage.name if current_stage and current_stage.stage else None,
        "days_in_current_stage": round(days_in_stage, 2),
        "remarks": po.remarks or "",
        "total_ordered": round(total_ordered, 2),
        "total_arrived": round(total_arrived, 2),
        "completion_pct": completion_pct,
        "items": items,
        "stage_history": stage_logs,
    }


class InventoryPurchaseOrdersAPIView(APIView):
    """
    GET /api/inventory/purchase-orders/
    Returns Tally purchase orders, tracked shipments with real ETA & stage logs,
    and all pipeline stages.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        tracked_qs = (
            PurchaseOrderTracking.objects.select_related("tally_voucher")
            .prefetch_related("items__inventory_item", "stage_logs__stage")
            .order_by("-order_date", "-id")
        )

        tracked_list = [_serialize_tracked_po(po, today) for po in tracked_qs]

        tally_pos = (
            Voucher.objects.filter(voucher_category__iexact="Purchase Order")
            .select_related("purchase_order_tracking")
            .prefetch_related("stock_rows__item")
            .order_by("-date", "-id")
        )

        tally_list = []
        for tpo in tally_pos:
            rows = list(tpo.stock_rows.all())
            total_val = sum(float(r.amount or 0) for r in rows)
            total_qty = sum(float(r.quantity or 0) for r in rows)
            items_list = [
                {
                    "id": r.id,
                    "name": r.item.name if r.item else (r.item_name_text or "Item"),
                    "quantity": float(r.quantity or 0),
                }
                for r in rows
            ]
            try:
                tracking_obj = tpo.purchase_order_tracking
            except PurchaseOrderTracking.DoesNotExist:
                tracking_obj = None

            tally_list.append({
                "id": tpo.id,
                "voucher_number": tpo.voucher_number or "N/A",
                "party_name": tpo.party_name or "Supplier",
                "date": tpo.date.strftime("%d %b %Y") if tpo.date else "N/A",
                "date_iso": tpo.date.isoformat() if tpo.date else None,
                "total_value": total_val,
                "total_value_display": format_inr(total_val),
                "total_quantity": total_qty,
                "item_count": len(items_list),
                "items": items_list,
                "is_tracked": tracking_obj is not None,
                "tracking_id": tracking_obj.id if tracking_obj else None,
                "tracking_status": tracking_obj.get_status_display() if tracking_obj else None,
            })

        stages_qs = PurchaseOrderStage.objects.all().order_by("sort_order", "name")
        stages_list = [
            {
                "id": s.id,
                "name": s.name,
                "estimated_days": s.estimated_days,
                "is_final_stage": s.is_final_stage,
                "sort_order": s.sort_order,
                "is_active": s.is_active,
                "active_pos_count": PurchaseOrderTracking.objects.filter(
                    stage_logs__stage=s, status="active"
                ).distinct().count(),
            }
            for s in stages_qs
        ]

        return Response({
            "status": "success",
            "tracked_orders_count": len(tracked_list),
            "tracked_orders": tracked_list,
            "tally_orders_count": len(tally_list),
            "tally_orders": tally_list,
            "stages_count": len(stages_list),
            "stages": stages_list,
        })


class InventoryPOPlannerAPIView(APIView):
    """
    GET /api/inventory/po-planner/?category_id=<id>&hide_dead=0|1
    Full Purchase Order Generator / Planner parity with web PurchaseOrderView.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        categories_qs = Category.objects.annotate(
            item_count=Count("inventoryitem")
        ).order_by("name")
        categories = [
            {"id": c.id, "name": c.name, "item_count": c.item_count}
            for c in categories_qs
        ]

        selected_cat_raw = request.GET.get("category_id", "").strip()
        hide_dead = request.GET.get("hide_dead", "0").strip() in ("1", "true", "True")

        if not selected_cat_raw or not selected_cat_raw.isdigit():
            return Response({
                "status": "success",
                "categories": categories,
                "selected_category_id": None,
                "selected_category_name": None,
                "hide_dead": hide_dead,
                "products": None,
                "summary": None,
            })

        selected_cat_id = int(selected_cat_raw)
        cat_obj = Category.objects.filter(id=selected_cat_id).first()
        if not cat_obj:
            return Response(
                {"status": "error", "message": "Selected category not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        today = date.today()
        ninety_days_ago = today - timedelta(days=90)

        sales_map, credit_note_map, internal_customer_map, po_map, gst_map = (
            PurchaseOrderView._preload_voucher_data()
        )
        tracking_item_map = PurchaseOrderView._preload_tracking_data()

        items = (
            InventoryItem.objects.filter(category_id=selected_cat_id)
            .select_related("category")
            .order_by("name")
        )

        products_data = []
        urgent_count = warn_count = dead_count = over_count = ok_count = 0

        for item in items:
            iid = item.id
            current_stock = float(item.quantity or 0)

            item_gst_rows = sorted(
                gst_map.get(iid, []),
                key=lambda r: r["date"] or date.min,
                reverse=True,
            )
            latest_gst = item_gst_rows[0] if item_gst_rows else None

            landing_date = None
            if item.is_new_product and item_gst_rows:
                valid_dates = [row["date"] for row in item_gst_rows if row["date"]]
                if valid_dates:
                    landing_date = min(valid_dates)

            raw_sales = sales_map.get(iid, [])
            item_credit_notes = credit_note_map.get(iid, [])
            item_sales = PurchaseOrderView._net_sales(raw_sales, item_credit_notes)
            item_internal_sales = internal_customer_map.get(iid, [])
            item_sales = PurchaseOrderView._remove_internal_sales(item_sales, item_internal_sales)

            monthly_sales_breakdown = PurchaseOrderView._monthly_sales(item_sales)
            daily_sales_breakdown = PurchaseOrderView._daily_sales(
                item_sales, item_credit_notes, item_internal_sales
            )

            is_dead = not any(
                row["date"] and row["date"] >= ninety_days_ago for row in item_sales
            )
            if hide_dead and is_dead:
                continue

            if item.is_new_product and landing_date:
                avg_daily = PurchaseOrderView._avg_daily_from_landing_date(item_sales, landing_date)
            else:
                avg_daily = PurchaseOrderView._avg_daily_from_tally(item_sales)

            growth_1y, growth_3m = PurchaseOrderView._growth_windows(item_sales)
            rate_1y = (growth_1y / 12 / 100) if growth_1y is not None else None
            rate_3m = (growth_3m / 3 / 100) if growth_3m is not None else None
            if rate_1y is not None and rate_3m is not None:
                monthly_growth_rate = 0.20 * rate_1y + 0.80 * rate_3m
            elif rate_3m is not None:
                monthly_growth_rate = rate_3m
            elif rate_1y is not None:
                monthly_growth_rate = rate_1y
            else:
                monthly_growth_rate = 0.0
            monthly_growth_rate = min(monthly_growth_rate, 0.4)

            pred_m1, pred_m2, pred_m3 = PurchaseOrderView._forecast_next_3_months(
                avg_daily, growth_1y, growth_3m, is_dead
            )

            item_po_rows = sorted(
                po_map.get(iid, []),
                key=lambda r: r["date"] or date.min,
                reverse=True,
            )
            latest_po = item_po_rows[0] if item_po_rows else None

            tracking_details = []
            for tracking_item in tracking_item_map.get(iid, []):
                po = tracking_item.purchase_order
                current_stage = get_current_stage(po)
                days_in_stage = get_days_in_current_stage(po)
                system_eta = get_expected_arrival_date(po)
                if po.manual_eta:
                    incoming_date = po.manual_eta
                    rem_days = max(0, (po.manual_eta - today).days)
                else:
                    incoming_date = system_eta
                    rem_days = get_remaining_days(po)

                ordered_qty = float(tracking_item.ordered_quantity or 0)
                arrived_qty = float(tracking_item.arrived_quantity or 0)
                pending_qty = max(0.0, ordered_qty - arrived_qty)

                if pending_qty > 0:
                    tracking_details.append({
                        "po_number": po.tally_voucher.voucher_number if po.tally_voucher else f"PO-{po.id}",
                        "arrived_qty": arrived_qty,
                        "incoming_qty": pending_qty,
                        "stage": current_stage.stage.name if current_stage and current_stage.stage else None,
                        "days_in_stage": float(days_in_stage) if days_in_stage is not None else None,
                        "remaining_days": float(rem_days) if rem_days is not None else None,
                        "eta": incoming_date,
                        "type": "pending",
                    })

            delivery_days = item.expected_delivery_days or 30
            total_incoming_qty = sum(t["incoming_qty"] for t in tracking_details)
            earliest_eta = min((t["eta"] for t in tracking_details if t["eta"]), default=None)

            incoming_shipments = []
            for t in tracking_details:
                arrived_qty = float(t.get("arrived_qty") or 0)
                pending_qty = float(t.get("incoming_qty") or 0)
                if arrived_qty > 0:
                    incoming_shipments.append({
                        "incoming_qty": arrived_qty,
                        "arrival_day": 0,
                        "po_number": t["po_number"],
                        "stage": "Arrived",
                        "eta": today,
                        "remaining_days": 0,
                        "days_in_stage": t.get("days_in_stage"),
                        "type": "arrived",
                    })
                if pending_qty > 0 and t.get("eta"):
                    arrival_day = max(0, (t["eta"] - today).days)
                    incoming_shipments.append({
                        "incoming_qty": pending_qty,
                        "arrival_day": arrival_day,
                        "po_number": t["po_number"],
                        "stage": t.get("stage"),
                        "eta": t["eta"],
                        "remaining_days": t.get("remaining_days"),
                        "days_in_stage": t.get("days_in_stage"),
                        "type": "pending",
                    })

            calc = PurchaseOrderView._calc_order(
                current_stock=current_stock,
                avg_daily=avg_daily,
                delivery_days=delivery_days,
                incoming_shipments=incoming_shipments,
                pred_m1=pred_m1,
                pred_m2=pred_m2,
                pred_m3=pred_m3,
                monthly_growth_rate=monthly_growth_rate,
                moq=item.minimum_order_quantity,
                is_dead=is_dead,
            )

            months_of_stock = round(current_stock / (avg_daily * 30), 1) if avg_daily > 0 else None
            is_overstocked = months_of_stock is not None and months_of_stock >= 9

            u = calc["order_urgency"]
            if u == "urgent":
                urgent_count += 1
            elif u == "warn":
                warn_count += 1
            elif u == "dead":
                dead_count += 1
            elif u == "ok":
                ok_count += 1
            if is_overstocked:
                over_count += 1

            products_data.append(_json_safe({
                "id": iid,
                "name": item.name,
                "unit": item.unit or "",
                "category": item.category.name if item.category else "—",
                "is_new_product": bool(item.is_new_product),
                "landing_date": landing_date,
                "current_stock": current_stock,
                "avg_daily": round(avg_daily, 2),
                "growth_1y": growth_1y,
                "growth_3m": growth_3m,
                "monthly_growth_rate_pct": round(monthly_growth_rate * 100, 2),
                "pred_m1": pred_m1,
                "pred_m2": pred_m2,
                "pred_m3": pred_m3,
                "is_dead": is_dead,
                "monthly_sales": monthly_sales_breakdown,
                "daily_sales": daily_sales_breakdown,
                "po_rows": item_po_rows,
                "latest_po_qty": latest_po["qty"] if latest_po else None,
                "latest_po_date": latest_po["date"] if latest_po else None,
                "latest_po_number": latest_po["voucher_number"] if latest_po else None,
                "gst_rows": item_gst_rows,
                "latest_gst_qty": latest_gst["qty"] if latest_gst else None,
                "latest_gst_date": latest_gst["date"] if latest_gst else None,
                "incoming_qty": total_incoming_qty,
                "incoming_date": earliest_eta,
                "tracking_details": tracking_details,
                "expected_delivery_days": item.expected_delivery_days,
                "order_recommended": calc["order_recommended"],
                "order_final": calc["order_final"],
                "order_urgency": calc["order_urgency"],
                "moq_note": calc["moq_note"],
                "moq": item.minimum_order_quantity,
                "order_lasts_months": calc["order_lasts_months"],
                "runway_days": calc.get("runway_days"),
                "runway_months": calc.get("runway_months"),
                "reorder_point_days": calc.get("reorder_point_days"),
                "graph_data": calc.get("graph_data", []),
                "graph_meta": {
                    "delivery_days": delivery_days,
                    "reorder_point": calc.get("reorder_point_days"),
                    "stockout_day": calc.get("stockout_day"),
                    "today": 0,
                },
                "calc_steps": calc["calc_steps"],
                "months_of_stock": months_of_stock,
                "is_overstocked": is_overstocked,
            }))

        return Response({
            "status": "success",
            "categories": categories,
            "selected_category_id": selected_cat_id,
            "selected_category_name": cat_obj.name,
            "hide_dead": hide_dead,
            "summary": {
                "total_products": len(products_data),
                "urgent_count": urgent_count,
                "warn_count": warn_count,
                "dead_count": dead_count,
                "overstocked_count": over_count,
                "ok_count": ok_count,
            },
            "products": products_data,
        })


class InventoryToggleNewProductAPIView(APIView):
    """
    POST /api/inventory/po-planner/toggle-new-product/<int:pk>/
    Toggles is_new_product flag for PO Planner calculation.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        item = get_object_or_404(InventoryItem, pk=pk)
        item.is_new_product = not item.is_new_product
        item.save(update_fields=["is_new_product"])
        return Response({
            "status": "success",
            "id": item.id,
            "is_new_product": item.is_new_product,
        })


class InventoryPOPlannerTopCustomersAPIView(APIView):
    """
    GET /api/inventory/po-planner/top-customers/?item_id=<id>
    Returns Top 5 customers by quantity with monthly breakdown for a product.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        item_id = request.GET.get("item_id", "").strip()
        if not item_id or not item_id.isdigit():
            return Response(
                {"status": "error", "message": "item_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = (
            VoucherStockItem.objects.filter(
                voucher__voucher_type__iexact="TAX INVOICE",
                item_id=int(item_id),
            )
            .select_related("voucher")
            .values("voucher__party_name", "voucher__date", "quantity")
        )

        customer_data = defaultdict(lambda: {"total": 0.0, "months": defaultdict(float)})
        for row in qs:
            name = row["voucher__party_name"] or "Unknown"
            qty = float(row["quantity"] or 0)
            month_key = row["voucher__date"].strftime("%Y-%m") if row["voucher__date"] else "Unknown"
            customer_data[name]["total"] += qty
            customer_data[name]["months"][month_key] += qty

        top5 = sorted(customer_data.items(), key=lambda x: x[1]["total"], reverse=True)[:5]
        result = []
        for name, data in top5:
            monthly = sorted(
                [{"month": m, "qty": round(q, 2)} for m, q in data["months"].items()],
                key=lambda x: x["month"],
            )
            result.append({
                "name": name,
                "total_qty": round(data["total"], 2),
                "monthly": monthly,
            })

        return Response({"status": "success", "customers": result})


class InventoryStartPOTrackingAPIView(APIView):
    """
    POST /api/inventory/tally-po/<int:voucher_id>/start-tracking/
    Mirrors web create_po_tracking: creates PurchaseOrderTracking and items from a Tally PO voucher.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, voucher_id):
        voucher = get_object_or_404(
            Voucher, id=voucher_id, voucher_category__iexact="Purchase Order"
        )
        tracking, created = PurchaseOrderTracking.objects.get_or_create(
            tally_voucher=voucher,
            defaults={
                "order_date": voucher.date,
                "created_by": request.user,
            },
        )

        if created:
            for stock_row in voucher.stock_rows.all():
                PurchaseOrderTrackingItem.objects.create(
                    purchase_order=tracking,
                    voucher_stock_item=stock_row,
                    inventory_item=stock_row.item,
                    item_name_text=stock_row.item_name_text,
                    ordered_quantity=stock_row.quantity,
                    arrived_quantity=0,
                )

        tracking = (
            PurchaseOrderTracking.objects.select_related("tally_voucher")
            .prefetch_related("items__inventory_item", "stage_logs__stage")
            .get(pk=tracking.pk)
        )
        return Response({
            "status": "success",
            "created": created,
            "message": "Purchase order tracking started." if created else "Already being tracked.",
            "tracked_order": _serialize_tracked_po(tracking),
        })


class InventoryTrackedPODetailAPIView(APIView):
    """
    GET / PATCH /api/inventory/tracked-po/<int:pk>/
    Retrieves or updates manual_eta / remarks for a tracked shipment.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        po = get_object_or_404(
            PurchaseOrderTracking.objects.select_related("tally_voucher").prefetch_related(
                "items__inventory_item", "stage_logs__stage"
            ),
            pk=pk,
        )
        stages_qs = PurchaseOrderStage.objects.filter(is_active=True).order_by("sort_order", "name")
        available_stages = [
            {
                "id": s.id,
                "name": s.name,
                "estimated_days": s.estimated_days,
                "is_final_stage": s.is_final_stage,
            }
            for s in stages_qs
        ]
        return Response({
            "status": "success",
            "tracked_order": _serialize_tracked_po(po),
            "available_stages": available_stages,
        })

    def patch(self, request, pk):
        po = get_object_or_404(PurchaseOrderTracking, pk=pk)
        if "remarks" in request.data:
            po.remarks = request.data.get("remarks") or ""
        if "manual_eta" in request.data:
            raw_eta = request.data.get("manual_eta")
            if raw_eta:
                parsed = parse_date(str(raw_eta).strip())
                if not parsed:
                    return Response(
                        {"status": "error", "message": "Invalid manual_eta format (use YYYY-MM-DD)."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                po.manual_eta = parsed
            else:
                po.manual_eta = None
        po.save()
        po = (
            PurchaseOrderTracking.objects.select_related("tally_voucher")
            .prefetch_related("items__inventory_item", "stage_logs__stage")
            .get(pk=po.pk)
        )
        return Response({
            "status": "success",
            "message": "Tracked shipment updated.",
            "tracked_order": _serialize_tracked_po(po),
        })


class InventoryUpdateArrivedQtyAPIView(APIView):
    """
    POST /api/inventory/tracked-po/<int:pk>/update-quantities/
    Updates arrived quantities and remarks on tracked PO line items.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        po = get_object_or_404(PurchaseOrderTracking, pk=pk)
        items_payload = request.data.get("items", [])
        if not isinstance(items_payload, list):
            return Response(
                {"status": "error", "message": "Expected 'items' list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        items_by_id = {it.id: it for it in po.items.all()}
        for row in items_payload:
            item_id = row.get("id")
            it = items_by_id.get(item_id)
            if not it:
                continue
            try:
                it.arrived_quantity = Decimal(str(row.get("arrived_quantity", 0)))
            except Exception:
                return Response(
                    {"status": "error", "message": f"Invalid arrived_quantity for item {item_id}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if "remarks" in row:
                it.remarks = row.get("remarks") or ""
            it.save()

        po = (
            PurchaseOrderTracking.objects.select_related("tally_voucher")
            .prefetch_related("items__inventory_item", "stage_logs__stage")
            .get(pk=po.pk)
        )
        return Response({
            "status": "success",
            "message": "Arrived quantities updated.",
            "tracked_order": _serialize_tracked_po(po),
        })


class InventoryStageLogCreateAPIView(APIView):
    """
    POST /api/inventory/tracked-po/<int:pk>/stages/add/
    Mirrors web PurchaseOrderStageLogCreateView.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        po = get_object_or_404(PurchaseOrderTracking, pk=pk)
        stage_id = request.data.get("stage_id")
        if not stage_id:
            return Response(
                {"status": "error", "message": "stage_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        stage = get_object_or_404(PurchaseOrderStage, pk=stage_id)

        entered_at = _parse_iso_datetime(request.data.get("entered_at")) or timezone.now()
        exit_datetime = _parse_iso_datetime(request.data.get("exit_datetime"))

        manual_days = request.data.get("manual_days_at_stage")
        manual_days_dec = None
        if manual_days is not None and str(manual_days).strip() != "":
            try:
                manual_days_dec = Decimal(str(manual_days))
            except Exception:
                return Response(
                    {"status": "error", "message": "Invalid manual_days_at_stage."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        manual_eta_raw = request.data.get("manual_eta")
        if manual_eta_raw:
            parsed_eta = parse_date(str(manual_eta_raw).strip())
            if parsed_eta:
                po.manual_eta = parsed_eta
                po.save(update_fields=["manual_eta", "updated_at"])

        PurchaseOrderStageLog.objects.create(
            purchase_order=po,
            stage=stage,
            entered_at=entered_at,
            exit_datetime=exit_datetime,
            manual_days_at_stage=manual_days_dec,
            remarks=request.data.get("remarks") or "",
            created_by=request.user,
        )

        po = (
            PurchaseOrderTracking.objects.select_related("tally_voucher")
            .prefetch_related("items__inventory_item", "stage_logs__stage")
            .get(pk=po.pk)
        )
        return Response({
            "status": "success",
            "message": "Stage added to purchase order.",
            "tracked_order": _serialize_tracked_po(po),
        }, status=status.HTTP_201_CREATED)


class InventoryStageLogUpdateAPIView(APIView):
    """
    POST / PATCH /api/inventory/stage-logs/<int:log_id>/edit/
    Mirrors web PurchaseOrderStageLogUpdateView.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, log_id):
        return self._update(request, log_id)

    @transaction.atomic
    def post(self, request, log_id):
        return self._update(request, log_id)

    def _update(self, request, log_id):
        log = get_object_or_404(PurchaseOrderStageLog, pk=log_id)
        po = log.purchase_order

        if request.data.get("stage_id"):
            log.stage = get_object_or_404(PurchaseOrderStage, pk=request.data["stage_id"])
        if "entered_at" in request.data and request.data.get("entered_at"):
            parsed_ent = _parse_iso_datetime(request.data.get("entered_at"))
            if parsed_ent:
                log.entered_at = parsed_ent
        if "exit_datetime" in request.data:
            raw_exit = request.data.get("exit_datetime")
            log.exit_datetime = _parse_iso_datetime(raw_exit) if raw_exit else None
        if "manual_days_at_stage" in request.data:
            raw_days = request.data.get("manual_days_at_stage")
            log.manual_days_at_stage = (
                Decimal(str(raw_days)) if raw_days is not None and str(raw_days).strip() != "" else None
            )
        if "remarks" in request.data:
            log.remarks = request.data.get("remarks") or ""

        if "manual_eta" in request.data:
            raw_eta = request.data.get("manual_eta")
            if raw_eta:
                parsed_eta = parse_date(str(raw_eta).strip())
                if parsed_eta:
                    po.manual_eta = parsed_eta
                    po.save(update_fields=["manual_eta", "updated_at"])
            else:
                po.manual_eta = None
                po.save(update_fields=["manual_eta", "updated_at"])

        log.save()

        po = (
            PurchaseOrderTracking.objects.select_related("tally_voucher")
            .prefetch_related("items__inventory_item", "stage_logs__stage")
            .get(pk=po.pk)
        )
        return Response({
            "status": "success",
            "message": "Stage log updated.",
            "tracked_order": _serialize_tracked_po(po),
        })


class InventoryStageListCreateAPIView(APIView):
    """
    GET / POST /api/inventory/stages/
    Mirrors web PurchaseOrderStageListView & PurchaseOrderStageCreateView.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stages_qs = PurchaseOrderStage.objects.all().order_by("sort_order", "name")
        stages_list = [
            {
                "id": s.id,
                "name": s.name,
                "estimated_days": s.estimated_days,
                "is_final_stage": s.is_final_stage,
                "sort_order": s.sort_order,
                "is_active": s.is_active,
                "active_pos_count": PurchaseOrderTracking.objects.filter(
                    stage_logs__stage=s, status="active"
                ).distinct().count(),
            }
            for s in stages_qs
        ]
        return Response({"status": "success", "stages": stages_list})

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        if not name:
            return Response(
                {"status": "error", "message": "Stage name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if PurchaseOrderStage.objects.filter(name__iexact=name).exists():
            return Response(
                {"status": "error", "message": "A stage with this name already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stage = PurchaseOrderStage.objects.create(
            name=name,
            estimated_days=max(0, int(request.data.get("estimated_days") or 0)),
            is_final_stage=bool(request.data.get("is_final_stage", False)),
            sort_order=max(0, int(request.data.get("sort_order") or 0)),
            is_active=bool(request.data.get("is_active", True)),
        )
        return Response({
            "status": "success",
            "stage": {
                "id": stage.id,
                "name": stage.name,
                "estimated_days": stage.estimated_days,
                "is_final_stage": stage.is_final_stage,
                "sort_order": stage.sort_order,
                "is_active": stage.is_active,
                "active_pos_count": 0,
            },
        }, status=status.HTTP_201_CREATED)


class InventoryStageUpdateAPIView(APIView):
    """
    PUT / PATCH /api/inventory/stages/<int:pk>/
    Mirrors web PurchaseOrderStageUpdateView.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        return self._update(request, pk)

    def patch(self, request, pk):
        return self._update(request, pk)

    def _update(self, request, pk):
        stage = get_object_or_404(PurchaseOrderStage, pk=pk)
        if "name" in request.data:
            new_name = (request.data.get("name") or "").strip()
            if not new_name:
                return Response(
                    {"status": "error", "message": "Stage name cannot be empty."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if PurchaseOrderStage.objects.filter(name__iexact=new_name).exclude(pk=stage.pk).exists():
                return Response(
                    {"status": "error", "message": "Another stage already has this name."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            stage.name = new_name
        if "estimated_days" in request.data:
            stage.estimated_days = max(0, int(request.data.get("estimated_days") or 0))
        if "is_final_stage" in request.data:
            stage.is_final_stage = bool(request.data.get("is_final_stage"))
        if "sort_order" in request.data:
            stage.sort_order = max(0, int(request.data.get("sort_order") or 0))
        if "is_active" in request.data:
            stage.is_active = bool(request.data.get("is_active"))
        stage.save()
        return Response({
            "status": "success",
            "stage": {
                "id": stage.id,
                "name": stage.name,
                "estimated_days": stage.estimated_days,
                "is_final_stage": stage.is_final_stage,
                "sort_order": stage.sort_order,
                "is_active": stage.is_active,
            },
        })


class InventorySalesContributionAPIView(APIView):
    """
    GET /api/inventory/analytics/contribution/?start_date=&end_date=&search=
    Mirrors web ProductContributionSummaryView.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        default_start = (today - timedelta(days=90)).isoformat()
        default_end = today.isoformat()

        start_date = (request.GET.get("start_date") or "").strip() or default_start
        end_date = (request.GET.get("end_date") or "").strip() or default_end
        search_query = (request.GET.get("search") or "").strip()

        stock_qs = VoucherStockItem.objects.filter(
            voucher__voucher_type="TAX INVOICE",
            voucher__date__gte=start_date,
            voucher__date__lte=end_date,
        )

        grand_total = float(stock_qs.aggregate(total=Sum("amount"))["total"] or 0)

        product_stats_qs = (
            stock_qs.values("item__id", "item__name", "item__category__name", "item_name_text")
            .annotate(total_sales=Sum("amount"), total_qty=Sum("quantity"))
            .order_by("-total_sales")
        )

        if search_query:
            q_low = search_query.lower()
            product_stats_raw = [
                p for p in product_stats_qs
                if q_low in (p["item__name"] or "").lower()
                or q_low in (p["item_name_text"] or "").lower()
            ]
        else:
            product_stats_raw = list(product_stats_qs)

        product_stats = []
        for p in product_stats_raw:
            val = float(p["total_sales"] or 0)
            pct = round((val / grand_total * 100), 2) if grand_total > 0 else 0.0
            product_stats.append({
                "id": p["item__id"],
                "name": p["item__name"] or p["item_name_text"] or "Product",
                "category": p["item__category__name"] or "General",
                "total_sales": val,
                "total_sales_display": format_inr(val),
                "units_sold": int(round(float(p["total_qty"] or 0))),
                "percentage": pct,
            })

        cat_stats_raw = (
            stock_qs.values("item__category__name")
            .annotate(total_sales=Sum("amount"))
            .order_by("-total_sales")
        )
        category_stats = []
        for c in cat_stats_raw:
            val = float(c["total_sales"] or 0)
            pct = round((val / grand_total * 100), 2) if grand_total > 0 else 0.0
            category_stats.append({
                "name": c["item__category__name"] or "General",
                "total_sales": val,
                "total_sales_display": format_inr(val),
                "percentage": pct,
            })

        return Response({
            "status": "success",
            "start_date": start_date,
            "end_date": end_date,
            "search": search_query,
            "grand_total": grand_total,
            "grand_total_display": format_inr(grand_total),
            "top_item": product_stats[0]["name"] if product_stats else "N/A",
            "total_items_count": len(product_stats),
            "category_stats": category_stats,
            "product_stats": product_stats,
        })


class InventorySalesContributionDetailAPIView(APIView):
    """
    GET /api/inventory/analytics/contribution/<int:item_id>/?start_date=&end_date=
    Mirrors web ProductSalesHistoryDetailView (Sales Ledger with Salesperson).
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, item_id):
        item = get_object_or_404(InventoryItem.objects.select_related("category"), pk=item_id)
        today = timezone.now().date()
        start_date = (request.GET.get("start_date") or "").strip() or (today - timedelta(days=90)).isoformat()
        end_date = (request.GET.get("end_date") or "").strip() or today.isoformat()

        transactions = (
            VoucherStockItem.objects.filter(
                item=item,
                voucher__voucher_type="TAX INVOICE",
                voucher__date__gte=start_date,
                voucher__date__lte=end_date,
            )
            .select_related("voucher")
            .order_by("-voucher__date", "-id")
        )

        party_names = [t.voucher.party_name for t in transactions if t.voucher and t.voucher.party_name]
        customer_map = {
            c.name.lower(): (c.salesperson.name if c.salesperson else "N/A")
            for c in Customer.objects.filter(name__in=party_names).select_related("salesperson")
            if c.name
        }

        rows = []
        total_qty = 0.0
        total_amt = 0.0
        for trans in transactions:
            q = float(trans.quantity or 0)
            a = float(trans.amount or 0)
            total_qty += q
            total_amt += a
            party = trans.voucher.party_name if trans.voucher else "Unknown"
            rows.append({
                "id": trans.id,
                "date": trans.voucher.date.isoformat() if trans.voucher and trans.voucher.date else None,
                "date_display": trans.voucher.date.strftime("%d %b %Y") if trans.voucher and trans.voucher.date else "—",
                "voucher_number": trans.voucher.voucher_number if trans.voucher else "—",
                "party_name": party,
                "salesperson": customer_map.get((party or "").lower(), "N/A"),
                "quantity": round(q, 2),
                "rate": round(a / q, 2) if q > 0 else 0.0,
                "amount": round(a, 2),
                "amount_display": format_inr(a),
            })

        return Response({
            "status": "success",
            "item": {
                "id": item.id,
                "name": item.name,
                "category": item.category.name if item.category else "General",
                "unit": item.unit or "pcs",
            },
            "start_date": start_date,
            "end_date": end_date,
            "total_qty": round(total_qty, 2),
            "total_amt": round(total_amt, 2),
            "total_amt_display": format_inr(total_amt),
            "transactions": rows,
        })


class InventoryCategoryAnalyticsAPIView(APIView):
    """
    GET /api/inventory/analytics/category/?category_id=<id>
    Mirrors web ProductAnalyticsCategoryView.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        categories_qs = Category.objects.annotate(
            item_count=Count("inventoryitem")
        ).order_by("name")
        categories = [
            {"id": c.id, "name": c.name, "item_count": c.item_count}
            for c in categories_qs
        ]

        selected_raw = (request.GET.get("category_id") or "").strip()
        if not selected_raw or not selected_raw.isdigit():
            return Response({
                "status": "success",
                "categories": categories,
                "selected_category_id": None,
                "selected_category_name": None,
                "products": None,
            })

        selected_cat_id = int(selected_raw)
        cat_obj = Category.objects.filter(id=selected_cat_id).first()
        if not cat_obj:
            return Response(
                {"status": "error", "message": "Category not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        today = date.today()
        ninety_days_ago = today - timedelta(days=90)

        items = (
            InventoryItem.objects.filter(category_id=selected_cat_id)
            .select_related("category")
            .order_by("name")
        )
        item_ids = list(items.values_list("id", flat=True))

        raw_rows = (
            VoucherStockItem.objects.filter(
                voucher__voucher_type__iexact="TAX INVOICE",
                item_id__in=item_ids,
            )
            .select_related("voucher")
            .values("item_id", "quantity", "voucher__date", "voucher__party_name")
        )

        sales_map = defaultdict(list)
        for row in raw_rows:
            sales_map[row["item_id"]].append({
                "date": row["voucher__date"],
                "qty": float(row["quantity"] or 0),
                "party": row["voucher__party_name"] or "Unknown",
            })

        products_data = []
        for item in items:
            rows = sales_map.get(item.id, [])
            is_dead = not any(r["date"] and r["date"] >= ninety_days_ago for r in rows)
            growth_3m = _growth_3m(rows, today)
            avg_daily = _avg_daily(rows, today)
            recent_qty = sum(r["qty"] for r in rows if r["date"] and r["date"] >= ninety_days_ago)

            products_data.append({
                "id": item.id,
                "name": item.name,
                "unit": item.unit or "",
                "category": cat_obj.name,
                "current_stock": float(item.quantity or 0),
                "is_dead": is_dead,
                "growth_3m": growth_3m,
                "avg_daily": round(avg_daily, 2),
                "recent_qty": round(recent_qty, 1),
            })

        return Response({
            "status": "success",
            "categories": categories,
            "selected_category_id": selected_cat_id,
            "selected_category_name": cat_obj.name,
            "products": products_data,
        })


class InventoryProductAnalyticsDetailAPIView(APIView):
    """
    GET /api/inventory/analytics/product/<int:item_id>/
    Mirrors web ProductAnalyticsDetailView: 1m/3m/6m/1y growth, charts,
    Top, Churned, Declining, and Rising/New Customers.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, item_id):
        today = date.today()
        ninety_days_ago = today - timedelta(days=90)
        six_months_ago = today - timedelta(days=180)

        item = get_object_or_404(InventoryItem.objects.select_related("category"), pk=item_id)

        raw_rows = (
            VoucherStockItem.objects.filter(
                voucher__voucher_type__iexact="TAX INVOICE",
                item_id=item_id,
            )
            .select_related("voucher")
            .values("quantity", "voucher__date", "voucher__party_name", "voucher__voucher_number")
            .order_by("voucher__date")
        )

        sales_rows = [
            {
                "date": r["voucher__date"],
                "qty": float(r["quantity"] or 0),
                "party": r["voucher__party_name"] or "Unknown",
                "voucher": r["voucher__voucher_number"] or "",
            }
            for r in raw_rows
            if r["voucher__date"]
        ]

        by_month = defaultdict(float)
        for r in sales_rows:
            by_month[r["date"].strftime("%Y-%m")] += r["qty"]

        monthly_sales = [
            {"month": m, "qty": round(q, 2)}
            for m, q in sorted(by_month.items())
        ]

        by_day = defaultdict(float)
        for r in sales_rows:
            if r["date"] >= ninety_days_ago:
                by_day[r["date"].isoformat()] += r["qty"]

        daily_sales = [
            {"date": d, "qty": round(q, 2)}
            for d, q in sorted(by_day.items())
        ]

        def _sum_months(offset_start, count):
            total = 0.0
            for i in range(offset_start, offset_start + count):
                key = (today.replace(day=1) - relativedelta(months=i)).strftime("%Y-%m")
                total += by_month.get(key, 0)
            return total

        r1m, p1m = _sum_months(0, 1), _sum_months(1, 1)
        r3m, p3m = _sum_months(0, 3), _sum_months(3, 3)
        r6m, p6m = _sum_months(0, 6), _sum_months(6, 6)
        r1y, p1y = _sum_months(0, 12), _sum_months(12, 12)

        growth = {
            "g1m": _pct(r1m, p1m),
            "g3m": _pct(r3m, p3m),
            "g6m": _pct(r6m, p6m),
            "g1y": _pct(r1y, p1y),
            "r1m": round(r1m, 1), "p1m": round(p1m, 1),
            "r3m": round(r3m, 1), "p3m": round(p3m, 1),
            "r6m": round(r6m, 1), "p6m": round(p6m, 1),
            "r1y": round(r1y, 1), "p1y": round(p1y, 1),
        }

        avg_daily = _avg_daily(sales_rows, today)
        is_dead = not any(r["date"] >= ninety_days_ago for r in sales_rows)

        cust_recent = defaultdict(float)
        cust_prior = defaultdict(float)
        cust_alltime = defaultdict(float)
        cust_monthly = defaultdict(lambda: defaultdict(float))
        cust_last_date = {}

        for r in sales_rows:
            name = r["party"]
            d = r["date"]
            qty = r["qty"]
            cust_alltime[name] += qty
            cust_monthly[name][d.strftime("%Y-%m")] += qty
            if name not in cust_last_date or d > cust_last_date[name]:
                cust_last_date[name] = d
            if d >= ninety_days_ago:
                cust_recent[name] += qty
            elif d >= six_months_ago:
                cust_prior[name] += qty

        all_customers = set(cust_alltime.keys())

        churned = []
        for name in all_customers:
            if cust_recent[name] == 0:
                last_purchase = cust_last_date.get(name)
                days_since = (today - last_purchase).days if last_purchase else None
                churned.append({
                    "name": name,
                    "prior_qty": round(cust_prior[name], 1),
                    "alltime_qty": round(cust_alltime[name], 1),
                    "last_purchase": last_purchase.strftime("%d %b %Y") if last_purchase else "—",
                    "days_since": days_since,
                    "status": "Long-term churn" if (days_since and days_since > 180) else "Recent churn",
                })
        churned.sort(key=lambda x: x["alltime_qty"], reverse=True)

        declining = []
        for name in all_customers:
            r_qty = cust_recent[name]
            p_qty = cust_prior[name]
            if p_qty > 0 and r_qty > 0:
                drop_pct = (p_qty - r_qty) / p_qty * 100
                if drop_pct >= 50:
                    severity = "Critical" if drop_pct >= 80 else ("High" if drop_pct >= 65 else "Moderate")
                    declining.append({
                        "name": name,
                        "recent_qty": round(r_qty, 1),
                        "prior_qty": round(p_qty, 1),
                        "drop_pct": round(drop_pct, 1),
                        "severity": severity,
                    })
        declining.sort(key=lambda x: x["drop_pct"], reverse=True)

        rising = []
        for name in all_customers:
            r_qty = cust_recent[name]
            p_qty = cust_prior[name]
            at = cust_alltime[name]
            if p_qty > 0 and r_qty > 0:
                rise_pct = (r_qty - p_qty) / p_qty * 100
                if rise_pct >= 20:
                    rising.append({
                        "name": name,
                        "recent_qty": round(r_qty, 1),
                        "prior_qty": round(p_qty, 1),
                        "rise_pct": round(rise_pct, 1),
                        "is_new": False,
                        "type": "Rapid growth" if rise_pct >= 100 else "Growing",
                    })
            elif r_qty > 0 and p_qty == 0 and at == r_qty:
                rising.append({
                    "name": name,
                    "recent_qty": round(r_qty, 1),
                    "prior_qty": 0,
                    "rise_pct": None,
                    "is_new": True,
                    "type": "New customer",
                })
        rising.sort(key=lambda x: x["recent_qty"], reverse=True)

        top_customers_raw = sorted(cust_alltime.items(), key=lambda x: x[1], reverse=True)[:10]
        today_month = today.replace(day=1)
        last_12_months = [
            (today_month - relativedelta(months=i)).strftime("%Y-%m")
            for i in range(11, -1, -1)
        ]
        top_customers = []
        for name, total in top_customers_raw:
            top_customers.append({
                "name": name,
                "alltime_qty": round(total, 1),
                "recent_qty": round(cust_recent[name], 1),
                "prior_qty": round(cust_prior[name], 1),
                "monthly_trend": [
                    {"month": m, "qty": round(cust_monthly[name].get(m, 0), 1)}
                    for m in last_12_months
                ],
            })

        return Response({
            "status": "success",
            "item": {
                "id": item.id,
                "name": item.name,
                "category": item.category.name if item.category else "Uncategorized",
                "unit": item.unit or "",
                "quantity": float(item.quantity or 0),
            },
            "avg_daily": round(avg_daily, 2),
            "is_dead": is_dead,
            "growth": growth,
            "monthly_sales": monthly_sales,
            "daily_sales": daily_sales,
            "summary": {
                "total_customers_ever": len(all_customers),
                "active_customers_recent": sum(1 for n in all_customers if cust_recent[n] > 0),
                "churned_count": len(churned),
                "declining_count": len(declining),
                "rising_count": len(rising),
            },
            "top_customers": top_customers,
            "churned": churned,
            "declining": declining,
            "rising": rising,
        })


class InventorySalesComparisonAPIView(APIView):
    """
    GET /api/inventory/analytics/comparison/?from=&to=&search=
    Mirrors web SalesComparisonDashboardView: category-wise & product-wise
    previous vs current period sales comparison.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from_str = (request.GET.get("from") or "").strip()
        to_str = (request.GET.get("to") or "").strip()
        search = (request.GET.get("search") or "").strip().lower()

        if not from_str or not to_str:
            latest_daily = DailyStockData.objects.aggregate(m=Max("date"))["m"]
            to_date = latest_daily or date.today()
            from_date = to_date - timedelta(days=30)
        else:
            from_date = parse_date(from_str) or (date.today() - timedelta(days=30))
            to_date = parse_date(to_str) or date.today()

        days_diff = max((to_date - from_date).days, 1)
        prev_from = from_date - timedelta(days=days_diff)
        prev_to = from_date - timedelta(days=1)

        current_sales = (
            DailyStockData.objects.filter(date__range=[from_date, to_date])
            .values("product__name", "product__category__name")
            .annotate(total_sold=Sum("outwards_quantity"))
        )
        previous_sales = (
            DailyStockData.objects.filter(date__range=[prev_from, prev_to])
            .values("product__name", "product__category__name")
            .annotate(total_sold=Sum("outwards_quantity"))
        )

        prev_dict = {
            (p["product__category__name"] or "Uncategorized", p["product__name"]): float(p["total_sold"] or 0)
            for p in previous_sales
        }
        curr_dict = {
            (c["product__category__name"] or "Uncategorized", c["product__name"]): float(c["total_sold"] or 0)
            for c in current_sales
        }

        all_keys = set(curr_dict.keys()) | set(prev_dict.keys())
        grouped = defaultdict(list)

        total_curr = 0.0
        total_prev = 0.0

        for cat_name, prod_name in sorted(all_keys, key=lambda x: (x[0] or "", x[1] or "")):
            if search and search not in (cat_name or "").lower() and search not in (prod_name or "").lower():
                continue
            curr = curr_dict.get((cat_name, prod_name), 0.0)
            prev = prev_dict.get((cat_name, prod_name), 0.0)
            diff = curr - prev
            if curr == 0 and prev == 0:
                continue
            pct = round((diff / prev * 100), 2) if prev > 0 else None
            trend = "down" if diff < 0 else ("up" if diff > 0 else "same")

            total_curr += curr
            total_prev += prev

            grouped[cat_name].append({
                "name": prod_name,
                "previous": round(prev, 1),
                "current": round(curr, 1),
                "difference": round(diff, 1),
                "percent_change": pct,
                "trend": trend,
            })

        categories = []
        for cat_name, items in sorted(grouped.items()):
            up = sum(1 for i in items if i["trend"] == "up")
            down = sum(1 for i in items if i["trend"] == "down")
            same = sum(1 for i in items if i["trend"] == "same")
            if up > down and up > same:
                overall_trend = "up"
            elif down > up and down > same:
                overall_trend = "down"
            else:
                overall_trend = "same"

            cat_curr = sum(i["current"] for i in items)
            cat_prev = sum(i["previous"] for i in items)
            categories.append({
                "category": cat_name,
                "overall_trend": overall_trend,
                "product_count": len(items),
                "total_current": round(cat_curr, 1),
                "total_previous": round(cat_prev, 1),
                "total_diff": round(cat_curr - cat_prev, 1),
                "items": items,
            })

        overall_diff = total_curr - total_prev
        overall_pct = round((overall_diff / total_prev * 100), 1) if total_prev > 0 else None

        return Response({
            "status": "success",
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
            "prev_from": prev_from.isoformat(),
            "prev_to": prev_to.isoformat(),
            "summary": {
                "total_current": round(total_curr, 1),
                "total_previous": round(total_prev, 1),
                "total_diff": round(overall_diff, 1),
                "overall_pct": overall_pct,
                "categories_count": len(categories),
            },
            "categories": categories,
        })


class InventoryReportAPIView(APIView):
    """
    GET /api/inventory/analytics/report/?search=&category_id=&low_only=0|1
    Mirrors web InventoryReportView: category-wise products with all prediction columns
    (Nitin est, Closing, Linear Regression Outwards, GPT, Average, Last 3 Avg, entries, expected delivery/qty).
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        search = (request.GET.get("search") or "").strip().lower()
        category_id = (request.GET.get("category_id") or "").strip()
        low_only = (request.GET.get("low_only") or "0").strip() in ("1", "true", "True")

        all_cats = Category.objects.prefetch_related("inventoryitem_set").order_by("name")

        total_skus = 0
        total_units = 0
        low_stock_count = 0
        categories_index = []
        categories_data = []

        for cat in all_cats:
            all_items = list(cat.inventoryitem_set.all().order_by("name"))
            cat_low = sum(
                1 for it in all_items
                if (it.quantity or 0) < (it.min_quantity_outwards or 0)
            )
            categories_index.append({
                "id": cat.id,
                "name": cat.name,
                "total_items": len(all_items),
                "low_stock_items": cat_low,
            })

            total_skus += len(all_items)
            total_units += sum((it.quantity or 0) for it in all_items)
            low_stock_count += cat_low

            if category_id and category_id.isdigit() and cat.id != int(category_id):
                continue

            filtered_rows = []
            for it in all_items:
                if search and search not in (it.name or "").lower() and search not in (cat.name or "").lower():
                    continue
                qty = it.quantity if it.quantity is not None else 0
                min_out = it.min_quantity_outwards if it.min_quantity_outwards is not None else -1
                is_low = qty < min_out if min_out != -1 else False
                if low_only and not is_low:
                    continue

                filtered_rows.append({
                    "id": it.id,
                    "name": it.name,
                    "unit": it.unit or "",
                    "quantity": qty,
                    "is_low_stock": is_low,
                    "min_quantity_nitin": None if it.min_quantity_nitin == -1 else it.min_quantity_nitin,
                    "min_quantity_closing": None if it.min_quantity_closing == -1 else it.min_quantity_closing,
                    "min_quantity_outwards": None if it.min_quantity_outwards == -1 else it.min_quantity_outwards,
                    "min_quantity_gpt": None if it.min_quantity_gpt == -1 else it.min_quantity_gpt,
                    "min_quantity_average": None if it.min_quantity_average == -1 else it.min_quantity_average,
                    "min_quantity_average_three": None if it.min_quantity_average_three == -1 else it.min_quantity_average_three,
                    "total_historical_entries": it.total_historical_entries or 0,
                    "expected_delivery": it.expected_delivery.strftime("%d %b %Y") if it.expected_delivery else None,
                    "expected_quantity": it.expected_quantity,
                })

            if filtered_rows or (category_id and cat.id == int(category_id)):
                categories_data.append({
                    "id": cat.id,
                    "name": cat.name,
                    "item_count": len(filtered_rows),
                    "low_count": sum(1 for r in filtered_rows if r["is_low_stock"]),
                    "items": filtered_rows,
                })

        return Response({
            "status": "success",
            "summary": {
                "total_skus": total_skus,
                "total_units": total_units,
                "low_stock_count": low_stock_count,
                "healthy_count": max(0, total_skus - low_stock_count),
            },
            "categories_index": categories_index,
            "categories": categories_data,
        })


class InventorySalesAnalyticsAPIView(APIView):
    """
    GET /api/inventory/analytics/?days=90
    Legacy summary endpoint (fixed Decimal safety).
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        days = min(365, max(14, int(request.GET.get("days", 90))))
        latest_voucher_date = VoucherStockItem.objects.filter(
            voucher__voucher_type__iexact="TAX INVOICE"
        ).aggregate(m=Max("voucher__date"))["m"] or timezone.now().date()
        start_date = latest_voucher_date - timedelta(days=days)

        stock_qs = VoucherStockItem.objects.filter(
            voucher__voucher_type__iexact="TAX INVOICE",
            voucher__date__gte=start_date,
            voucher__date__lte=latest_voucher_date,
        )

        grand_total = float(stock_qs.aggregate(total=Sum("amount"))["total"] or 0)
        total_units = float(stock_qs.aggregate(total=Sum("quantity"))["total"] or 0)

        product_stats = (
            stock_qs.values("item__id", "item__name", "item__category__name")
            .annotate(sales=Sum("amount"), units=Sum("quantity"))
            .order_by("-sales")[:50]
        )

        products = []
        cumulative = 0.0
        for p in product_stats:
            val = float(p["sales"] or 0)
            pct = round((val / grand_total * 100), 2) if grand_total > 0 else 0.0
            cumulative += pct
            tier = "A" if cumulative <= 80 else ("B" if cumulative <= 95 else "C")

            products.append({
                "id": str(p["item__id"] or ""),
                "name": p["item__name"] or "Product",
                "category": p["item__category__name"] or "Uncategorized",
                "sales_value": val,
                "sales_value_display": format_inr(val),
                "units_sold": int(round(float(p["units"] or 0))),
                "percentage": pct,
                "cumulative_pct": round(cumulative, 1),
                "tier": tier,
            })

        cat_stats = (
            stock_qs.values("item__category__name")
            .annotate(sales=Sum("amount"), units=Sum("quantity"))
            .order_by("-sales")[:10]
        )

        categories = []
        for c in cat_stats:
            val = float(c["sales"] or 0)
            pct = round((val / grand_total * 100), 1) if grand_total > 0 else 0.0
            categories.append({
                "category": c["item__category__name"] or "Uncategorized",
                "sales_value": val,
                "sales_value_display": format_inr(val),
                "units_sold": int(round(float(c["units"] or 0))),
                "percentage": pct,
            })

        return Response({
            "status": "success",
            "period_days": days,
            "grand_total": grand_total,
            "grand_total_display": format_inr(grand_total),
            "total_units_sold": int(round(total_units)),
            "products": products,
            "categories": categories,
        })
