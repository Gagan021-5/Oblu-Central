"""
Mobile API Views for Proforma Invoice & Quotation Maker.
Provides dedicated REST JSON endpoints for the mobile application with
comprehensive Role-Based Access Control (RBAC) evaluation.
Mounted under /api/proforma/
"""

import logging
from decimal import Decimal
from django.utils import timezone
from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied

from access_control.services import can, scope_queryset
from customer_dashboard.models import Customer
from inventory.models import InventoryItem, Category

from .models import (
    ProformaInvoice,
    ProformaInvoiceItem,
    QuotationMaker,
    QuotationMakerItem,
    ProformaPriceChangeRequest,
    ProformaStockShortageRequest,
    DispatchRequest,
    DispatchStateHistory,
    DispatchPhoto,
    DocketPhoto,
    CourierCharge,
    ApprovedPriceMemory,
)
from .api_views import (
    is_accounts_user,
    is_warehouse_user,
    _fast_invoice_status,
    _fast_quotation_status,
    _format_inr,
)

logger = logging.getLogger(__name__)


class ProformaHubAPIView(APIView):
    """
    GET /api/proforma/hub/
    Returns the user's specific module permissions, operational badges,
    and high-level KPI metrics matching the web access control matrix.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # ── 1. Evaluate RBAC Permissions ────────────────────────────────
        is_super = bool(user.is_superuser)
        is_acc = is_accounts_user(user)
        is_wh = is_warehouse_user(user)

        can_create_proforma = is_super or can(user, "proforma.create")
        can_create_quotation = is_super or can(user, "proforma.create")
        can_view_proformas = is_super or can(user, "proforma.view") or can_create_proforma
        can_view_quotations = is_super or can(user, "proforma.view") or can_create_quotation
        can_view_products = is_super or can(user, "product_price.view") or not is_wh
        can_approve_price_change = is_super or can(user, "proforma.price_approval") or is_acc
        can_request_stock = is_super or can(user, "stock.request") or is_acc or can_create_proforma
        can_manage_dispatch = is_super or can(user, "dispatch.queue") or is_acc
        can_warehouse_dispatch = is_super or is_wh or is_acc or (can(user, "inventory.view") and not can_create_proforma)
        can_manage_tiers = is_super or can(user, "product_tier.manage") or is_acc

        permissions = {
            "can_create_proforma": can_create_proforma,
            "can_create_quotation": can_create_quotation,
            "can_view_proformas": can_view_proformas,
            "can_view_quotations": can_view_quotations,
            "can_view_products": can_view_products,
            "can_approve_price_change": can_approve_price_change,
            "can_request_stock": can_request_stock,
            "can_manage_dispatch": can_manage_dispatch,
            "can_warehouse_dispatch": can_warehouse_dispatch,
            "can_manage_tiers": can_manage_tiers,
            "is_admin": is_super or (getattr(user, "role", "") == "admin"),
            "is_accounts": is_acc,
            "is_warehouse": is_wh,
        }

        # ── 2. Calculate KPI Metrics & Counters ────────────────────────
        pi_qs = ProformaInvoice.objects.all()
        if not (is_super or is_acc):
            pi_qs = scope_queryset(user, "proforma.view", pi_qs)

        q_qs = QuotationMaker.objects.all()
        if not (is_super or is_acc):
            q_qs = scope_queryset(user, "proforma.view", q_qs)

        total_proformas = pi_qs.count()
        total_quotations = q_qs.count()

        pending_price_requests = ProformaPriceChangeRequest.objects.filter(status="pending").count()
        pending_stock_requests = ProformaStockShortageRequest.objects.filter(status="pending").count()

        pending_dispatch = DispatchRequest.objects.exclude(
            status__in=["completed", "cancelled"]
        ).count()

        stats = {
            "total_proformas": total_proformas,
            "total_quotations": total_quotations,
            "pending_price_requests": pending_price_requests,
            "pending_stock_requests": pending_stock_requests,
            "pending_dispatch": pending_dispatch,
        }

        user_info = {
            "id": user.id,
            "username": user.username,
            "name": user.get_full_name() or user.username,
            "role": getattr(user, "role", "Staff"),
            "is_superuser": user.is_superuser,
        }

        return Response({
            "success": True,
            "permissions": permissions,
            "stats": stats,
            "user": user_info,
        })


class ProformaCustomersLookupAPIView(APIView):
    """
    GET /api/proforma/customers/?search=
    Returns authorized customers for creating Proforma Invoices or Quotations.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        search = request.query_params.get("search", "").strip()

        qs = Customer.objects.all()
        if not (user.is_superuser or is_accounts_user(user)):
            qs = scope_queryset(user, "customer.view", qs)

        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(phone__icontains=search)
                | Q(city__icontains=search)
                | Q(id__icontains=search)
            )

        customers = []
        for c in qs.order_by("name")[:60]:
            customers.append({
                "id": c.id,
                "name": c.name,
                "phone": getattr(c, "phone", "") or "",
                "city": getattr(c, "city", "") or "",
                "state": getattr(c, "state", "") or "",
                "gstin": getattr(c, "gstin", "") or "",
                "has_overdue": getattr(c, "has_overdue_invoices", False),
            })

        return Response({"success": True, "customers": customers})


class PriceChangeRequestsListAPIView(APIView):
    """
    GET /api/proforma/price-requests/?status=all|pending|approved|rejected&search=
    Returns price change requests for sales heads, accounts, and admins.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (user.is_superuser or is_accounts_user(user) or can(user, "proforma.price_approval")):
            raise PermissionDenied("You do not have permission to view price change requests.")

        status_filter = request.query_params.get("status", "all").strip().lower()
        search = request.query_params.get("search", "").strip()

        qs = ProformaPriceChangeRequest.objects.select_related(
            "invoice",
            "quotation",
            "product",
            "product__category",
            "requested_by",
            "customer",
            "reviewed_by"
        ).order_by("-created_at")

        if status_filter != "all":
            qs = qs.filter(status=status_filter)

        if search:
            qs = qs.filter(
                Q(customer__name__icontains=search)
                | Q(product__name__icontains=search)
                | Q(requested_by__username__icontains=search)
            )

        results = []
        for r in qs[:80]:
            doc_id = r.invoice_id or r.quotation_id or 0
            doc_type = "proforma" if r.invoice_id else "quotation"
            doc_number = f"{'PI' if r.invoice_id else 'QT'}-{doc_id}"

            results.append({
                "id": r.id,
                "doc_type": doc_type,
                "doc_id": doc_id,
                "doc_number": doc_number,
                "customer_name": r.customer.name if r.customer else "Customer",
                "product_name": r.product.name if r.product else "Courier / Item",
                "product_sku": getattr(r.product, "sku", "") or "",
                "current_price": float(r.current_price or 0),
                "requested_price": float(r.requested_price or 0),
                "recommended_price": float(getattr(r, "recommended_courier_charge", 0) or 0),
                "difference": float((r.requested_price or 0) - (r.current_price or 0)),
                "status": r.status,
                "reason": getattr(r, "reason", "") or "",
                "sp_remark": getattr(r, "sp_remark", "") or "",
                "requested_by": r.requested_by.get_full_name() or r.requested_by.username if r.requested_by else "Rep",
                "reviewed_by": r.reviewed_by.get_full_name() or r.reviewed_by.username if r.reviewed_by else None,
                "created_at": r.created_at.strftime("%d %b %Y, %I:%M %p") if r.created_at else "",
                "reviewed_at": r.reviewed_at.strftime("%d %b %Y, %I:%M %p") if r.reviewed_at else None,
            })

        return Response({"success": True, "results": results})


class StockShortageRequestsListAPIView(APIView):
    """
    GET /api/proforma/stock-requests/?status=all|pending|approved|rejected
    Returns stock shortage requests submitted during proforma generation.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (user.is_superuser or is_accounts_user(user) or can(user, "stock.request") or can(user, "proforma.create")):
            raise PermissionDenied("You do not have permission to view stock requests.")

        status_filter = request.query_params.get("status", "all").strip().lower()
        search = request.query_params.get("search", "").strip()

        qs = ProformaStockShortageRequest.objects.select_related(
            "invoice",
            "invoice__customer",
            "product",
            "requested_by",
            "reviewed_by"
        ).order_by("-created_at")

        if not (user.is_superuser or is_accounts_user(user)):
            qs = qs.filter(requested_by=user)

        if status_filter != "all":
            qs = qs.filter(status=status_filter)

        if search:
            qs = qs.filter(
                Q(product__name__icontains=search)
                | Q(invoice__customer__name__icontains=search)
                | Q(requested_by__username__icontains=search)
            )

        results = []
        for s in qs[:80]:
            results.append({
                "id": s.id,
                "invoice_id": s.invoice_id,
                "invoice_number": f"PI-{s.invoice_id}",
                "customer_name": s.invoice.customer.name if s.invoice and s.invoice.customer else "Customer",
                "product_name": s.product.name if s.product else "Item",
                "product_sku": getattr(s.product, "sku", "") or "",
                "requested_quantity": s.requested_quantity,
                "available_quantity": s.available_quantity,
                "status": s.status,
                "requested_by": s.requested_by.get_full_name() or s.requested_by.username if s.requested_by else "Rep",
                "reviewed_by": s.reviewed_by.get_full_name() or s.reviewed_by.username if s.reviewed_by else None,
                "duration": s.get_duration(),
                "created_at": s.created_at.strftime("%d %b %Y, %I:%M %p") if s.created_at else "",
            })

        return Response({"success": True, "results": results})


class StockShortageRequestActionAPIView(APIView):
    """
    POST /api/proforma/stock-requests/<int:pk>/action/
    Body: {"action": "approve" | "reject"}
    Approve or reject a stock shortage request.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if not (user.is_superuser or is_accounts_user(user) or can(user, "stock.request")):
            raise PermissionDenied("You do not have permission to approve stock requests.")

        action = request.data.get("action", "approve").lower()
        req = get_object_or_404(ProformaStockShortageRequest, pk=pk)

        if action == "approve":
            req.status = "approved"
        else:
            req.status = "rejected"

        req.reviewed_by = user
        req.reviewed_at = timezone.now()
        req.save()

        return Response({
            "success": True,
            "status": req.status,
            "message": f"Stock request marked as {req.status}."
        })


class DispatchQueueListAPIView(APIView):
    """
    GET /api/proforma/dispatch-queue/?type=all|accounts|warehouse&status=&search=
    Lists dispatch items for Accounts verification or Warehouse packing execution.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        queue_type = request.query_params.get("type", "all").lower()
        search = request.query_params.get("search", "").strip()

        qs = DispatchRequest.objects.select_related(
            "invoice",
            "invoice__customer",
            "shipment_method",
            "requested_by"
        ).prefetch_related(
            "photos",
            "history",
            "invoice__items__product"
        ).order_by("-created_at")

        if queue_type == "warehouse":
            qs = qs.filter(status__in=["waiting_for_packing", "packing_approved", "packed_awaiting_approval"])
        elif queue_type == "accounts":
            qs = qs.exclude(status__in=["completed", "cancelled"])

        if search:
            qs = qs.filter(
                Q(invoice__customer__name__icontains=search)
                | Q(invoice_number__icontains=search)
                | Q(invoice__id__icontains=search)
            )

        results = []
        for d in qs[:60]:
            photos_count = d.photos.count()
            items_count = d.invoice.items.count() if d.invoice else 0

            latest_history = d.history.order_by("-changed_at").first()
            time_in_stage_display = "Active"
            if latest_history:
                delta = timezone.now() - latest_history.changed_at
                hours, remainder = divmod(int(delta.total_seconds()), 3600)
                minutes, _ = divmod(remainder, 60)
                time_in_stage_display = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"

            results.append({
                "id": d.id,
                "invoice_id": d.invoice.id if d.invoice else None,
                "invoice_number": d.invoice_number or f"PI-{d.invoice_id}",
                "customer_name": d.invoice.customer.name if d.invoice and d.invoice.customer else "Customer",
                "status": d.status,
                "status_display": d.get_status_display(),
                "shipment_method": d.shipment_method.name if d.shipment_method else "Surface Courier",
                "photos_count": photos_count,
                "items_count": items_count,
                "time_in_stage": time_in_stage_display,
                "created_at": d.created_at.strftime("%d %b %Y, %I:%M %p") if d.created_at else "",
            })

        return Response({"success": True, "results": results})


class ProformaCatalogAPIView(APIView):
    """
    GET /api/proforma/catalog/?category_id=&search=
    Returns full product catalog with pricing, GST rate, stock, and tiers.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        category_id = request.query_params.get("category_id")
        search = request.query_params.get("search", "").strip()

        qs = InventoryItem.objects.select_related(
            "category",
            "proforma_price"
        ).prefetch_related(
            "proforma_price__price_tiers"
        ).filter(proforma_price__isnull=False)

        if category_id and category_id.isdigit():
            qs = qs.filter(category_id=int(category_id))

        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(sku__icontains=search)
                | Q(category__name__icontains=search)
            )

        products = []
        for p in qs.order_by("name")[:100]:
            p_price = p.proforma_price
            base_price = float(p_price.price) if p_price and p_price.price else 0.0
            gst_pct = float(p_price.gst_rate) if p_price and p_price.gst_rate else 18.0

            tiers = []
            if p_price:
                for t in p_price.price_tiers.all().order_by("min_quantity"):
                    tiers.append({
                        "min_qty": t.min_quantity,
                        "discount_pct": float(t.discount_percentage),
                        "unit_price": float(t.unit_price) if getattr(t, "unit_price", None) else base_price,
                    })

            products.append({
                "id": p.id,
                "name": p.name,
                "sku": getattr(p, "sku", "") or "",
                "category": p.category.name if p.category else "General",
                "category_id": p.category_id,
                "base_price": base_price,
                "gst_percentage": gst_pct,
                "stock": getattr(p, "quantity", 0) or 0,
                "price_display": f"₹{int(base_price):,}",
                "tiers": tiers,
            })

        categories = list(
            Category.objects.values("id", "name").order_by("name")
        )

        return Response({
            "success": True,
            "categories": categories,
            "products": products,
        })
