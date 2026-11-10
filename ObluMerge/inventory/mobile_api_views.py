"""
Inventory REST API Views for Mobile App.
Provides live executive dashboard metrics (matching the website inventory intelligence)
and live searchable catalog items from PostgreSQL.
"""

from datetime import timedelta, date, datetime
import calendar
import re
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from dateutil.relativedelta import relativedelta
from django.utils import timezone
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
from tally_voucher.models import Voucher, VoucherStockItem


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
        category = None
        if category_id:
            try:
                category = Category.objects.get(id=int(category_id))
            except (Category.DoesNotExist, ValueError):
                pass

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
            sold_30 = recent_sales.get(item.id, 0) or 0
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


class InventoryPurchaseOrdersAPIView(APIView):
    """
    GET /api/inventory/purchase-orders/
    Returns Tally purchase orders and tracked shipments with live stages and arrival quantities.
    """
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tracked_qs = (
            PurchaseOrderTracking.objects.select_related("tally_voucher")
            .prefetch_related("items", "stage_logs__stage")
            .order_by("-order_date")[:40]
        )

        tracked_list = []
        for po in tracked_qs:
            items = []
            total_ordered = 0
            total_arrived = 0

            for it in po.items.all():
                ord_qty = it.ordered_quantity or 0
                arr_qty = it.arrived_quantity or 0
                total_ordered += ord_qty
                total_arrived += arr_qty
                items.append({
                    "id": it.id,
                    "item_name": it.item_name_text or (it.inventory_item.name if it.inventory_item else "Item"),
                    "ordered_quantity": ord_qty,
                    "arrived_quantity": arr_qty,
                })

            stages = []
            for sl in po.stage_logs.all():
                stages.append({
                    "stage_name": sl.stage.name if sl.stage else "Stage",
                    "status": sl.status,
                    "notes": sl.notes,
                    "timestamp": sl.created_at.strftime("%d %b %Y, %I:%M %p") if sl.created_at else None,
                })

            completion_pct = round((total_arrived / total_ordered * 100), 1) if total_ordered > 0 else 0

            v = po.tally_voucher
            tracked_list.append({
                "id": po.id,
                "voucher_number": v.voucher_number if v else f"PO-{po.id:04d}",
                "party_name": v.party_name if v else "Supplier",
                "order_date": po.order_date.strftime("%d %b %Y") if po.order_date else "N/A",
                "expected_delivery": po.expected_delivery.strftime("%d %b %Y") if po.expected_delivery else "TBD",
                "total_ordered": total_ordered,
                "total_arrived": total_arrived,
                "completion_pct": completion_pct,
                "items": items,
                "stage_history": stages,
            })

        tally_pos = (
            Voucher.objects.filter(voucher_category__iexact="Purchase Order")
            .prefetch_related("stock_rows")
            .order_by("-date")[:30]
        )

        tally_list = []
        for tpo in tally_pos:
            total_val = sum(r.amount or 0 for r in tpo.stock_rows.all())
            total_qty = sum(r.quantity or 0 for r in tpo.stock_rows.all())
            tally_list.append({
                "id": tpo.id,
                "voucher_number": tpo.voucher_number or "N/A",
                "party_name": tpo.party_name or "Supplier",
                "date": tpo.date.strftime("%d %b %Y") if tpo.date else "N/A",
                "total_value": float(total_val),
                "total_value_display": format_inr(total_val),
                "total_quantity": float(total_qty),
                "item_count": tpo.stock_rows.count(),
            })

        stages_qs = PurchaseOrderStage.objects.filter(is_active=True).order_by("sort_order")
        stages_list = [
            {
                "id": s.id,
                "name": s.name,
                "estimated_days": s.estimated_days,
                "is_final_stage": s.is_final_stage,
                "active_pos_count": PurchaseOrderTracking.objects.filter(stage_logs__stage=s, status="active").distinct().count(),
            }
            for s in stages_qs
        ]

        planner_qs = (
            InventoryItem.objects.filter(
                quantity__lt=F("min_quantity_outwards"),
                min_quantity_outwards__gt=0,
            )
            .select_related("category")
            .order_by("quantity")[:30]
        )
        planner_list = []
        for p in planner_qs:
            threshold = p.min_quantity_outwards or p.min_quantity or 10
            qty = p.quantity or 0
            suggested_order = max(threshold * 2 - qty, 10)
            planner_list.append({
                "id": p.id,
                "name": p.name,
                "category": p.category.name if p.category else "Uncategorized",
                "current_stock": qty,
                "min_threshold": threshold,
                "suggested_order": suggested_order,
                "unit": p.unit or "pcs",
                "status": "Out of Stock" if qty <= 0 else "Low Stock",
            })

        return Response({
            "status": "success",
            "tracked_orders_count": len(tracked_list),
            "tracked_orders": tracked_list,
            "tally_orders_count": len(tally_list),
            "tally_orders": tally_list,
            "stages_count": len(stages_list),
            "stages": stages_list,
            "planner_count": len(planner_list),
            "planner_items": planner_list,
        })


class InventorySalesAnalyticsAPIView(APIView):
    """
    GET /api/inventory/analytics/?days=90
    Returns product revenue contributions (Pareto 80/20 ABC classification) and category shares.
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

        grand_total = stock_qs.aggregate(total=Sum("amount"))["total"] or 0
        total_units = stock_qs.aggregate(total=Sum("quantity"))["total"] or 0

        product_stats = (
            stock_qs.values("item__id", "item__name", "item__category__name")
            .annotate(sales=Sum("amount"), units=Sum("quantity"))
            .order_by("-sales")[:50]
        )

        products = []
        cumulative = 0
        for p in product_stats:
            val = float(p["sales"] or 0)
            pct = round((val / grand_total * 100), 2) if grand_total > 0 else 0
            cumulative += pct
            tier = "A" if cumulative <= 80 else ("B" if cumulative <= 95 else "C")

            products.append({
                "id": str(p["item__id"] or ""),
                "name": p["item__name"] or "Product",
                "category": p["item__category__name"] or "Uncategorized",
                "sales_value": val,
                "sales_value_display": format_inr(val),
                "units_sold": int(round(p["units"] or 0)),
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
            pct = round((val / grand_total * 100), 1) if grand_total > 0 else 0
            categories.append({
                "category": c["item__category__name"] or "Uncategorized",
                "sales_value": val,
                "sales_value_display": format_inr(val),
                "units_sold": int(round(c["units"] or 0)),
                "percentage": pct,
            })

        # Sales Comparison (current period vs prior period)
        prev_start_date = start_date - timedelta(days=days)
        prev_end_date = start_date - timedelta(days=1)
        prev_stock_qs = VoucherStockItem.objects.filter(
            voucher__voucher_type__iexact="TAX INVOICE",
            voucher__date__gte=prev_start_date,
            voucher__date__lte=prev_end_date,
        )
        prev_grand_total = float(prev_stock_qs.aggregate(total=Sum("amount"))["total"] or 0)
        prev_total_units = int(round(prev_stock_qs.aggregate(total=Sum("quantity"))["total"] or 0))

        growth_pct = round(((grand_total - prev_grand_total) / prev_grand_total * 100), 1) if prev_grand_total > 0 else 0
        units_growth_pct = round(((total_units - prev_total_units) / prev_total_units * 100), 1) if prev_total_units > 0 else 0

        sales_comparison = {
            "current_period_label": f"Last {days} Days",
            "previous_period_label": f"Prior {days} Days",
            "current_revenue": float(grand_total),
            "current_revenue_display": format_inr(grand_total),
            "previous_revenue": prev_grand_total,
            "previous_revenue_display": format_inr(prev_grand_total),
            "growth_pct": abs(growth_pct),
            "is_growth_positive": growth_pct >= 0,
            "current_units": int(round(total_units)),
            "previous_units": prev_total_units,
            "units_growth_pct": abs(units_growth_pct),
            "is_units_growth_positive": units_growth_pct >= 0,
        }

        # Inventory Report summary
        total_skus = InventoryItem.objects.count()
        total_physical_units = InventoryItem.objects.aggregate(total=Sum("quantity"))["total"] or 0
        healthy_skus = InventoryItem.objects.filter(quantity__gte=F("min_quantity_outwards")).count()
        low_skus = InventoryItem.objects.filter(quantity__gt=0, quantity__lt=F("min_quantity_outwards"), min_quantity_outwards__gt=0).count()
        out_skus = InventoryItem.objects.filter(Q(quantity__lte=0) | Q(quantity__isnull=True)).count()

        inventory_report = {
            "total_skus": total_skus,
            "total_units": int(round(total_physical_units)),
            "healthy_skus": healthy_skus,
            "low_skus": low_skus,
            "out_of_stock_skus": out_skus,
            "healthy_pct": round((healthy_skus / total_skus * 100), 1) if total_skus > 0 else 0,
            "low_pct": round((low_skus / total_skus * 100), 1) if total_skus > 0 else 0,
            "out_pct": round((out_skus / total_skus * 100), 1) if total_skus > 0 else 0,
        }

        return Response({
            "status": "success",
            "period_days": days,
            "grand_total": float(grand_total),
            "grand_total_display": format_inr(grand_total),
            "total_units_sold": int(round(total_units)),
            "products": products,
            "categories": categories,
            "sales_comparison": sales_comparison,
            "inventory_report": inventory_report,
        })
