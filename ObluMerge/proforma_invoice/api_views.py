"""
Proforma Invoice — REST API views for the employee mobile app.
Provides real-time access to Proforma Invoices, Quotations, Line Items, Approvals,
and Full Warehouse Dispatch Photo & Docket Upload Workflows.
"""

from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from django.db.models import Q, Count, Sum
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.exceptions import PermissionDenied

from access_control.services import can, scope_queryset
from access_control.roles import is_admin, is_finance
from customer_dashboard.models import Customer
from inventory.models import InventoryItem, Category

from .models import (
    ProformaInvoice,
    ProformaInvoiceItem,
    QuotationMaker,
    QuotationMakerItem,
    ProformaPriceChangeRequest,
    ProductPrice,
    ApprovedPriceMemory,
    ShipmentMethod,
    DispatchRequest,
    DispatchPhoto,
    WarehouseDispatch,
    DocketPhoto,
    DispatchRemark,
    DispatchStateHistory,
    DispatchInvoice,
)


def is_accounts_user(user):
    if not user.is_authenticated:
        return False
    emp = getattr(user, "employee_profile", None)
    user_roles = [a.role.role_key for a in emp.role_assignments.filter(is_active=True)] if emp else []
    return bool(
        user.is_superuser
        or getattr(user, "is_accountant", False)
        or any(r in user_roles for r in ["admin", "accounts_operations"])
        or user.username.lower() in ["accounts", "accountant", "finance", "infected"]
        or can(user, "dispatch.queue")
    )


def is_warehouse_user(user):
    if not user.is_authenticated:
        return False
    emp = getattr(user, "employee_profile", None)
    user_roles = [a.role.role_key for a in emp.role_assignments.filter(is_active=True)] if emp else []
    return bool(
        user.is_superuser
        or "warehouse" in user_roles
        or user.username.lower() in ["warehouse", "infected"]
        or can(user, "proforma.dispatch")
    )


def _format_inr(val):
    if not val:
        return "₹0"
    try:
        v = float(val)
    except (ValueError, TypeError):
        return "₹0"
    if abs(v) >= 10000000:
        return f"₹{v / 10000000:.2f} Cr"
    elif abs(v) >= 100000:
        return f"₹{v / 100000:.1f} L"
    elif abs(v) >= 1000:
        return f"₹{v:,.0f}"
    else:
        return f"₹{v:.2f}"


def _get_invoice_status(inv):
    """Determine unified status for mobile display: Approved | Pending | Billed."""
    if getattr(inv, "dispatch_status", "") == "dispatched":
        return "Billed"

    # Check pending price requests
    if hasattr(inv, "price_requests"):
        if inv.price_requests.filter(status="pending").exists():
            return "Pending"

    # Check pending stock requests
    if hasattr(inv, "stock_requests"):
        if inv.stock_requests.filter(status="pending").exists():
            return "Pending"

    return "Approved"


def _get_quotation_status(q):
    if getattr(q, "is_converted_to_proforma", False):
        return "Billed"
    if hasattr(q, "price_requests"):
        if q.price_requests.filter(status="pending").exists():
            return "Pending"
    return "Approved"


class ProformaListCreateAPIView(APIView):
    """
    GET /api/proforma/?search=&type=all|proforma|quotation&status=all|approved|pending|billed&page=1
    POST /api/proforma/ -> Create a new Proforma or Quotation
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (user.is_superuser or is_admin(user) or is_finance(user) or can(user, "proforma.view") or can(user, "proforma.create")):
            raise PermissionDenied("You do not have permission to view proforma invoices.")

        search_query = request.query_params.get("search", "").strip()
        doc_type = request.query_params.get("type", "all").strip().lower()
        status_filter = request.query_params.get("status", "all").strip().lower()
        page = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 40))

        # ── 1. Query Proformas ──────────────────────────────────────────
        pi_qs = ProformaInvoice.objects.select_related("customer").prefetch_related("price_requests", "items")
        if not (user.is_superuser or is_admin(user) or is_finance(user)):
            pi_qs = scope_queryset(user, "proforma.view", pi_qs)

        # ── 2. Query Quotations ─────────────────────────────────────────
        q_qs = QuotationMaker.objects.select_related("customer").prefetch_related("price_requests", "items")
        if not (user.is_superuser or is_admin(user) or is_finance(user)):
            q_qs = scope_queryset(user, "proforma.view", q_qs)

        # ── 3. Search Filter ───────────────────────────────────────────
        if search_query:
            pi_qs = pi_qs.filter(
                Q(customer__name__icontains=search_query)
                | Q(created_by__icontains=search_query)
                | Q(id__icontains=search_query.replace("PI-", "").replace("pi-", ""))
            )
            q_qs = q_qs.filter(
                Q(customer__name__icontains=search_query)
                | Q(created_by__icontains=search_query)
                | Q(id__icontains=search_query.replace("QT-", "").replace("qt-", ""))
            )

        items_list = []

        # Include Proformas
        if doc_type in ["all", "proforma"]:
            for pi in pi_qs.order_by("-date_created")[:150]:
                status = _get_invoice_status(pi)
                if status_filter != "all" and status.lower() != status_filter:
                    continue

                try:
                    total_amt = float(pi.calculate_final_total() or 0)
                except Exception:
                    total_amt = 0.0

                try:
                    gst_amt = float(pi.courier_gst() or 0)
                except Exception:
                    gst_amt = 0.0

                items_list.append({
                    "id": str(pi.id),
                    "doc_type": "proforma",
                    "piNumber": f"PI-{pi.date_created.strftime('%Y') if pi.date_created else '2026'}-{str(pi.id).zfill(4)}",
                    "clientName": pi.customer.name if pi.customer else "Customer",
                    "customerId": pi.customer_id,
                    "amount": f"₹{int(total_amt):,}",
                    "amountNum": total_amt,
                    "gstAmount": f"₹{int(gst_amt):,}",
                    "date": pi.date_created.strftime("%d %b %Y") if pi.date_created else "",
                    "rep": pi.created_by or "Sales Rep",
                    "status": status,
                    "dispatch_status": pi.dispatch_status,
                    "items_count": pi.items.count() if hasattr(pi, "items") else 0,
                    "created_at": pi.date_created.isoformat() if pi.date_created else "",
                })

        # Include Quotations
        if doc_type in ["all", "quotation"]:
            for q in q_qs.order_by("-date_created")[:150]:
                status = _get_quotation_status(q)
                if status_filter != "all" and status.lower() != status_filter:
                    continue

                try:
                    total_amt = float(q.grand_total() or 0)
                except Exception:
                    total_amt = 0.0

                try:
                    gst_amt = float(q.courier_gst() or 0)
                except Exception:
                    gst_amt = 0.0

                items_list.append({
                    "id": str(q.id),
                    "doc_type": "quotation",
                    "piNumber": f"QT-{q.date_created.strftime('%Y') if q.date_created else '2026'}-{str(q.id).zfill(4)}",
                    "clientName": q.customer.name if q.customer else "Customer",
                    "customerId": q.customer_id,
                    "amount": f"₹{int(total_amt):,}",
                    "amountNum": total_amt,
                    "gstAmount": f"₹{int(gst_amt):,}",
                    "date": q.date_created.strftime("%d %b %Y") if q.date_created else "",
                    "rep": q.created_by or "Sales Rep",
                    "status": status,
                    "dispatch_status": "quotation",
                    "items_count": q.items.count() if hasattr(q, "items") else 0,
                    "created_at": q.date_created.isoformat() if q.date_created else "",
                })

        # Sort combined list newest first
        items_list.sort(key=lambda x: x["created_at"], reverse=True)

        # ── 4. Calculate Stats ──────────────────────────────────────────
        pipeline_sum = sum(item["amountNum"] for item in items_list)
        pending_count = sum(1 for item in items_list if item["status"] == "Pending")
        approved_count = sum(1 for item in items_list if item["status"] == "Approved")
        billed_count = sum(1 for item in items_list if item["status"] == "Billed")

        # Pagination slice
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_results = items_list[start_idx:end_idx]

        return Response({
            "stats": {
                "pipeline_value": _format_inr(pipeline_sum),
                "pipeline_value_num": pipeline_sum,
                "pending_approvals": pending_count,
                "approved_count": approved_count,
                "billed_count": billed_count,
                "total_count": len(items_list),
            },
            "count": len(items_list),
            "page": page,
            "next_page": page + 1 if end_idx < len(items_list) else None,
            "results": paginated_results,
        })

    def post(self, request):
        user = request.user
        if not (user.is_superuser or is_admin(user) or is_finance(user) or can(user, "proforma.create")):
            raise PermissionDenied("You do not have permission to create proforma invoices.")

        data = request.data
        doc_type = data.get("doc_type", "proforma").lower()
        customer_id = data.get("customer_id")
        courier_mode = data.get("courier_mode", "surface").lower()
        items_data = data.get("items", [])

        if not customer_id:
            return Response({"error": "Customer is required."}, status=400)
        if not items_data or not isinstance(items_data, list):
            return Response({"error": "At least one item is required."}, status=400)

        customer = get_object_or_404(Customer, pk=customer_id)

        with transaction.atomic():
            if doc_type == "quotation":
                doc = QuotationMaker.objects.create(
                    customer=customer,
                    created_by=user.username,
                    courier_mode=courier_mode,
                )
                item_model = QuotationMakerItem
                fk_name = "quotation"
            else:
                doc = ProformaInvoice.objects.create(
                    customer=customer,
                    created_by=user.username,
                    courier_mode=courier_mode,
                )
                item_model = ProformaInvoiceItem
                fk_name = "invoice"

            for item in items_data:
                product_id = item.get("product_id")
                qty = int(item.get("quantity", 1))
                requested_price = item.get("requested_price")

                product = get_object_or_404(InventoryItem, pk=product_id)
                current_price = getattr(getattr(product, "proforma_price", None), "price", Decimal("0.00"))

                item_kwargs = {
                    fk_name: doc,
                    "product": product,
                    "quantity": qty,
                    "current_price": current_price or Decimal("0.00"),
                }
                if requested_price:
                    item_kwargs["requested_price"] = Decimal(str(requested_price))

                item_model.objects.create(**item_kwargs)

        return Response({
            "success": True,
            "id": doc.id,
            "doc_type": doc_type,
            "number": f"{'QT' if doc_type == 'quotation' else 'PI'}-{doc.date_created.strftime('%Y')}-{str(doc.id).zfill(4)}",
            "message": f"{'Quotation' if doc_type == 'quotation' else 'Proforma Invoice'} created successfully.",
        }, status=201)


class ProformaDetailAPIView(APIView):
    """
    GET /api/proforma/<int:pk>/?type=proforma|quotation
    Returns full details with item list, breakdown, and action flags.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        user = request.user
        doc_type = request.query_params.get("type", "proforma").strip().lower()

        if doc_type == "quotation":
            doc = get_object_or_404(
                QuotationMaker.objects.select_related("customer").prefetch_related("items__product", "price_requests"),
                pk=pk
            )
            if not (user.is_superuser or is_admin(user) or is_finance(user) or can(user, "proforma.view", doc)):
                raise PermissionDenied("You do not have permission to view this quotation.")

            status = _get_quotation_status(doc)
            prefix = "QT"
            items_qs = doc.items.select_related("product")
            can_convert = not getattr(doc, "is_converted_to_proforma", False) and can(user, "proforma.create")
            web_url = f"/proforma/quotation/{doc.id}/"
        else:
            doc = get_object_or_404(
                ProformaInvoice.objects.select_related("customer").prefetch_related("items__product", "price_requests"),
                pk=pk
            )
            if not (user.is_superuser or is_admin(user) or is_finance(user) or can(user, "proforma.view", doc)):
                raise PermissionDenied("You do not have permission to view this proforma invoice.")

            status = _get_invoice_status(doc)
            prefix = "PI"
            items_qs = doc.items.select_related("product")
            can_convert = False
            web_url = f"/proforma/{doc.id}/"

        items_list = []
        for itm in items_qs.all():
            p = itm.product
            unit_price = float(getattr(itm, "unit_price", lambda: 0)() if callable(getattr(itm, "unit_price", None)) else getattr(itm, "current_price", 0) or 0)
            total_price = float(getattr(itm, "total_price", lambda: 0)() if callable(getattr(itm, "total_price", None)) else (unit_price * itm.quantity))

            items_list.append({
                "id": itm.id,
                "product_id": p.id if p else None,
                "product_name": p.name if p else "Product",
                "sku": getattr(p, "sku", "") or getattr(p, "part_number", "") or "",
                "category": p.category.name if (p and p.category) else "General",
                "quantity": itm.quantity,
                "unit_price": f"₹{int(unit_price):,}",
                "unit_price_num": unit_price,
                "total_price": f"₹{int(total_price):,}",
                "total_price_num": total_price,
                "requested_price": str(itm.requested_price) if getattr(itm, "requested_price", None) else None,
            })

        # Calculate Totals
        try:
            grand_total_num = float(doc.calculate_final_total() if hasattr(doc, "calculate_final_total") else doc.grand_total() or 0)
        except Exception:
            grand_total_num = sum(i["total_price_num"] for i in items_list)

        try:
            taxable_num = float(doc.taxable_total() or 0)
        except Exception:
            taxable_num = grand_total_num * 0.847

        try:
            courier_amt = float(doc.courier_charge() or 0)
        except Exception:
            courier_amt = 0.0

        try:
            courier_gst_amt = float(doc.courier_gst() or 0)
        except Exception:
            courier_gst_amt = 0.0

        gst_num = max(0.0, grand_total_num - taxable_num)

        # Price Requests
        price_requests_list = []
        if hasattr(doc, "price_requests"):
            for pr in doc.price_requests.all():
                price_requests_list.append({
                    "id": pr.id,
                    "product_name": pr.product.name if pr.product else "Item",
                    "requested_price": str(pr.requested_price or 0),
                    "recommended_price": str(pr.recommended_price or 0),
                    "status": pr.status,
                    "reason": pr.reason or "",
                })

        can_approve = bool(user.is_superuser or is_admin(user) or is_finance(user) or can(user, "proforma.price_approval"))

        cust = doc.customer
        return Response({
            "id": doc.id,
            "doc_type": doc_type,
            "number": f"{prefix}-{doc.date_created.strftime('%Y') if doc.date_created else '2026'}-{str(doc.id).zfill(4)}",
            "date": doc.date_created.strftime("%d %b %Y") if doc.date_created else "",
            "created_by": doc.created_by or "Sales Rep",
            "status": status,
            "dispatch_status": getattr(doc, "dispatch_status", "processing"),
            "courier_mode": getattr(doc, "courier_mode", "surface"),
            "customer": {
                "id": cust.id if cust else None,
                "name": cust.name if cust else "Unknown",
                "phone": cust.phone if cust else "",
                "email": cust.email if cust else "",
                "city": cust.district or cust.state or "",
                "state": cust.state if cust else "",
                "address": getattr(cust, "address", "") or "",
                "gstin": getattr(cust, "gstin", "") or getattr(cust, "gst_number", "") or "",
            },
            "items": items_list,
            "totals": {
                "taxable_total": f"₹{int(taxable_num):,}",
                "courier_charge": f"₹{int(courier_amt):,}",
                "courier_gst": f"₹{int(courier_gst_amt):,}",
                "gst_total": f"₹{int(gst_num):,}",
                "grand_total": f"₹{int(grand_total_num):,}",
                "grand_total_num": grand_total_num,
            },
            "price_requests": price_requests_list,
            "can_approve_price": can_approve,
            "can_convert_to_pi": can_convert,
            "web_url": web_url,
        })


class PriceChangeRequestActionAPIView(APIView):
    """
    POST /api/proforma/price-requests/<int:pk>/
    Body: {"action": "approve" | "reject", "reason": "optional reason"}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if not (user.is_superuser or is_admin(user) or is_finance(user) or can(user, "proforma.price_approval")):
            raise PermissionDenied("You do not have permission to approve or reject price requests.")

        price_request = get_object_or_404(ProformaPriceChangeRequest, pk=pk)
        action = request.data.get("action", "").lower()
        reason = request.data.get("reason", "")

        if price_request.status != "pending":
            return Response({"error": "Price change request has already been reviewed."}, status=400)

        if action == "approve":
            price_request.status = "approved"
            price_request.reviewed_by = user
            price_request.reviewed_at = timezone.now()
            price_request.save()
            return Response({"success": True, "message": "Price change request approved."})

        elif action == "reject":
            price_request.status = "rejected"
            price_request.reviewed_by = user
            price_request.reviewed_at = timezone.now()
            if reason:
                price_request.reason = f"{price_request.reason or ''}\nRejection Note: {reason}".strip()
            price_request.save()
            return Response({"success": True, "message": "Price change request rejected."})

        return Response({"error": "Invalid action. Use 'approve' or 'reject'."}, status=400)


class ConvertQuotationToPIAPIView(APIView):
    """
    POST /api/proforma/quotations/<int:pk>/convert/
    Converts a quotation into a live Proforma Invoice.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if not (user.is_superuser or is_admin(user) or is_finance(user) or can(user, "proforma.create")):
            raise PermissionDenied("You do not have permission to convert quotations.")

        quotation = get_object_or_404(QuotationMaker, pk=pk)
        if quotation.is_converted_to_proforma:
            return Response({"error": "This quotation has already been converted to a Proforma Invoice."}, status=400)

        with transaction.atomic():
            pi = ProformaInvoice.objects.create(
                customer=quotation.customer,
                shipping_customer=quotation.shipping_customer,
                created_by=user.username,
                courier_mode=quotation.courier_mode,
            )

            for q_item in quotation.items.all():
                ProformaInvoiceItem.objects.create(
                    invoice=pi,
                    product=q_item.product,
                    quantity=q_item.quantity,
                    current_price=q_item.current_price,
                    requested_price=q_item.requested_price,
                    made_by=user.username,
                )

            quotation.is_converted_to_proforma = True
            quotation.converted_at = timezone.now()
            quotation.save(update_fields=["is_converted_to_proforma", "converted_at"])

        return Response({
            "success": True,
            "proforma_id": pi.id,
            "proforma_number": f"PI-{pi.date_created.strftime('%Y')}-{str(pi.id).zfill(4)}",
            "message": "Quotation converted to Proforma Invoice successfully.",
        })


class ProformaProductsLookupAPIView(APIView):
    """
    GET /api/proforma/products/?search=&category=
    Returns available products with live pricing for the invoice builder.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        search = request.query_params.get("search", "").strip()
        cat_id = request.query_params.get("category", "").strip()

        qs = InventoryItem.objects.select_related("category", "proforma_price").order_by("name")

        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(sku__icontains=search) | Q(part_number__icontains=search))
        if cat_id and cat_id.isdigit():
            qs = qs.filter(category_id=int(cat_id))

        results = []
        for item in qs[:100]:
            price = getattr(getattr(item, "proforma_price", None), "price", Decimal("0.00")) or Decimal("0.00")
            results.append({
                "id": item.id,
                "name": item.name,
                "sku": getattr(item, "sku", "") or getattr(item, "part_number", "") or "",
                "category": item.category.name if item.category else "General",
                "price": float(price),
                "price_formatted": f"₹{int(price):,}",
            })

        return Response({"products": results})


# =========================================================================
# WAREHOUSE DISPATCH, CAMERA PHOTO CAPTURE & COURIER DOCKET APIS
# =========================================================================

class DispatchDetailAPIView(APIView):
    """
    GET /api/proforma/dispatch/<int:invoice_id>/
    Returns full dispatch state, packing photos, docket number and history.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, invoice_id):
        user = request.user
        invoice = get_object_or_404(ProformaInvoice, pk=invoice_id)

        dispatch_req, _ = DispatchRequest.objects.get_or_create(
            invoice=invoice,
            defaults={
                "requested_by": user,
                "status": "waiting_for_packing" if invoice.dispatch_status != "dispatched" else "dispatched_by_warehouse",
            }
        )

        photos_list = []
        for p in dispatch_req.photos.all().order_by("-uploaded_at"):
            try:
                img_url = request.build_absolute_uri(p.image.url)
            except Exception:
                img_url = ""
            photos_list.append({
                "id": p.id,
                "url": img_url,
                "uploaded_by": p.uploaded_by.username if p.uploaded_by else "",
                "uploaded_at": p.uploaded_at.strftime("%d %b %Y, %I:%M %p") if p.uploaded_at else "",
            })

        remarks_list = []
        for r in dispatch_req.remarks.all().order_by("-created_at"):
            remarks_list.append({
                "id": r.id,
                "user": r.user.username if r.user else "",
                "message": r.message,
                "created_at": r.created_at.strftime("%d %b %Y, %I:%M %p") if r.created_at else "",
            })

        docket_info = None
        warehouse_dispatch = getattr(dispatch_req, "warehousedispatch", None)
        if warehouse_dispatch:
            docket_photos = []
            for dp in DocketPhoto.objects.filter(warehouse_dispatch=warehouse_dispatch).order_by("-uploaded_at"):
                try:
                    dp_url = request.build_absolute_uri(dp.image.url)
                except Exception:
                    dp_url = ""
                docket_photos.append({
                    "id": dp.id,
                    "url": dp_url,
                })

            docket_info = {
                "docket_number": warehouse_dispatch.docket_number,
                "dispatched_at": warehouse_dispatch.dispatched_at.strftime("%d %b %Y, %I:%M %p") if warehouse_dispatch.dispatched_at else "",
                "dispatched_by": warehouse_dispatch.dispatched_by.username if warehouse_dispatch.dispatched_by else "",
                "photos": docket_photos,
            }

        return Response({
            "dispatch_id": dispatch_req.id,
            "invoice_id": invoice.id,
            "invoice_number": f"PI-{invoice.date_created.strftime('%Y') if invoice.date_created else '2026'}-{str(invoice.id).zfill(4)}",
            "status": dispatch_req.status,
            "status_display": dict(DispatchRequest.STATUS_CHOICES).get(dispatch_req.status, dispatch_req.status) if hasattr(DispatchRequest, "STATUS_CHOICES") else dispatch_req.status.replace("_", " ").title(),
            "shipment_method": dispatch_req.shipment_method.name if dispatch_req.shipment_method else "Surface",
            "photos": photos_list,
            "remarks": remarks_list,
            "docket": docket_info,
            "can_submit_packing": is_warehouse_user(user),
            "can_approve_packing": is_accounts_user(user),
            "can_dispatch": is_warehouse_user(user),
        })


class DispatchPackingSubmitAPIView(APIView):
    """
    POST /api/proforma/dispatch/<int:invoice_id>/packing/
    Uploads packing photos (from camera or gallery) and optional warehouse remark.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, invoice_id):
        user = request.user
        if not is_warehouse_user(user):
            raise PermissionDenied("Only Warehouse staff can submit packing photos.")

        invoice = get_object_or_404(ProformaInvoice, pk=invoice_id)
        dispatch_req, _ = DispatchRequest.objects.get_or_create(invoice=invoice)

        photos = request.FILES.getlist("photos")
        if not photos:
            # Check single file fallback
            single = request.FILES.get("photo")
            if single:
                photos = [single]

        if not photos:
            return Response({"error": "Please provide at least one packing photo."}, status=400)

        remark = request.data.get("remark", "").strip()

        with transaction.atomic():
            for photo in photos:
                DispatchPhoto.objects.create(
                    dispatch_request=dispatch_req,
                    image=photo,
                    uploaded_by=user
                )

            if remark:
                DispatchRemark.objects.create(
                    dispatch_request=dispatch_req,
                    user=user,
                    message=remark
                )

            old_status = dispatch_req.status
            dispatch_req.status = "packed_awaiting_approval"
            dispatch_req.save()

            DispatchStateHistory.objects.create(
                dispatch_request=dispatch_req,
                from_status=old_status,
                to_status="packed_awaiting_approval",
                changed_by=user
            )

        return Response({
            "success": True,
            "status": "packed_awaiting_approval",
            "message": f"Successfully uploaded {len(photos)} packing photo(s). Sent to Accounts for clearance.",
        })


class DispatchApprovePackingAPIView(APIView):
    """
    POST /api/proforma/dispatch/<int:invoice_id>/approve-packing/
    Accounts verifies packing photos and clears for dispatch.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        user = request.user
        if not is_accounts_user(user):
            raise PermissionDenied("Only Accounts and Super Admin can approve packing.")

        invoice = get_object_or_404(ProformaInvoice, pk=invoice_id)
        dispatch_req = get_object_or_404(DispatchRequest, invoice=invoice)

        if dispatch_req.status != "packed_awaiting_approval":
            return Response({"error": "Dispatch is not awaiting packing approval."}, status=400)

        old_status = dispatch_req.status
        dispatch_req.status = "packing_approved"
        dispatch_req.save()

        DispatchStateHistory.objects.create(
            dispatch_request=dispatch_req,
            from_status=old_status,
            to_status="packing_approved",
            changed_by=user
        )

        return Response({
            "success": True,
            "status": "packing_approved",
            "message": "Packing approved. Warehouse can now hand over to carrier.",
        })


class DispatchRejectPackingAPIView(APIView):
    """
    POST /api/proforma/dispatch/<int:invoice_id>/reject-packing/
    Accounts rejects packaging with remark and sends back to warehouse.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        user = request.user
        if not is_accounts_user(user):
            raise PermissionDenied("Only Accounts and Super Admin can reject packing.")

        invoice = get_object_or_404(ProformaInvoice, pk=invoice_id)
        dispatch_req = get_object_or_404(DispatchRequest, invoice=invoice)

        rejection_remark = request.data.get("remark", "").strip()

        if rejection_remark:
            DispatchRemark.objects.create(
                dispatch_request=dispatch_req,
                user=user,
                message=f"PACKING REJECTED: {rejection_remark}"
            )

        old_status = dispatch_req.status
        dispatch_req.status = "waiting_for_packing"
        dispatch_req.save()

        DispatchStateHistory.objects.create(
            dispatch_request=dispatch_req,
            from_status=old_status,
            to_status="waiting_for_packing",
            changed_by=user
        )

        return Response({
            "success": True,
            "status": "waiting_for_packing",
            "message": "Packing rejected and sent back to warehouse for re-packing.",
        })


class DispatchWarehouseSendAPIView(APIView):
    """
    POST /api/proforma/dispatch/<int:invoice_id>/send/
    Warehouse enters docket number and uploads courier receipt photo.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, invoice_id):
        user = request.user
        if not is_warehouse_user(user):
            raise PermissionDenied("Only Warehouse staff can complete courier dispatch.")

        invoice = get_object_or_404(ProformaInvoice, pk=invoice_id)
        dispatch_req = get_object_or_404(DispatchRequest, invoice=invoice)

        docket_number = request.data.get("docket_number", "").strip()
        if not docket_number:
            return Response({"error": "Docket tracking number is required."}, status=400)

        docket_photos = request.FILES.getlist("docket_photos")
        if not docket_photos:
            single = request.FILES.get("docket_photo")
            if single:
                docket_photos = [single]

        if not docket_photos:
            return Response({"error": "Please take or upload at least one photo of the courier receipt."}, status=400)

        with transaction.atomic():
            warehouse_dispatch, _ = WarehouseDispatch.objects.update_or_create(
                dispatch_request=dispatch_req,
                defaults={
                    "docket_number": docket_number,
                    "dispatched_at": timezone.now(),
                    "dispatched_by": user,
                }
            )

            for photo in docket_photos:
                DocketPhoto.objects.create(
                    warehouse_dispatch=warehouse_dispatch,
                    image=photo,
                    uploaded_by=user
                )

            old_status = dispatch_req.status
            dispatch_req.status = "dispatched_by_warehouse"
            dispatch_req.save()

            invoice.dispatch_status = "dispatched"
            invoice.dispatched_at = timezone.now()
            invoice.save(update_fields=["dispatch_status", "dispatched_at"])

            DispatchStateHistory.objects.create(
                dispatch_request=dispatch_req,
                from_status=old_status,
                to_status="dispatched_by_warehouse",
                changed_by=user
            )

        return Response({
            "success": True,
            "status": "dispatched_by_warehouse",
            "message": f"Dispatched successfully with Docket #{docket_number} and {len(docket_photos)} receipt photo(s).",
        })
