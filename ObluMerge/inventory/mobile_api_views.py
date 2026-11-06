"""
Inventory REST API Views for Mobile App.
Provides live executive dashboard metrics (matching the website inventory intelligence)
and live searchable catalog items from PostgreSQL.
"""

from datetime import timedelta, date, datetime
import calendar
from django.utils import timezone
from django.db.models import Sum, Count, Q, F, Max
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.authentication import SessionAuthentication

from .models import InventoryItem, DailyStockData, PurchaseOrderTracking
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
        try:
            page = max(1, int(request.GET.get("page", 1)))
        except (ValueError, TypeError):
            page = 1
        try:
            page_size = min(100, max(10, int(request.GET.get("page_size", 30))))
        except (ValueError, TypeError):
            page_size = 30

        qs = InventoryItem.objects.select_related("category").all()

        if q:
            qs = qs.filter(
                Q(name__icontains=q) |
                Q(category__name__icontains=q)
            )

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
