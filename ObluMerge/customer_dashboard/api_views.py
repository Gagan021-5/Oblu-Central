"""
Customer Dashboard — REST API views for the employee mobile app.
Provides real-time access to Customers, Remarks, Follow-ups, and Tally Voucher status.
"""

from django.utils import timezone
from django.db import transaction
from django.db.models import Count, DateField, DateTimeField, Exists, IntegerField, OuterRef, Prefetch, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce, Lower, TruncDate
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.shortcuts import get_object_or_404

from access_control.roles import (
    is_admin,
    is_finance,
)
from access_control.services import can, scope_queryset
from .models import (
    SalesPerson,
    Customer,
    CustomerCreditProfile,
    CustomerUnit,
    CustomerRemark,
    CustomerFollowUp,
    CustomerVoucherStatus,
    CrossSellingRemark,
    PaymentDiscussionThread,
    PaymentRemark,
    PaymentExpectedDateHistory,
    PaymentTicketEvent,
)
from .api_serializers import (
    CustomerListSerializer,
    CustomerDetailSerializer,
    CustomerRemarkSerializer,
    CustomerFollowUpSerializer,
    CustomerPaymentSerializer,
)
from .forms import CustomerCreditForm, CustomerReassignForm


def get_visible_customer_queryset(user):
    """Return customer rows inside the active customer.view RBAC scope."""
    return _customer_scope(user, "customer.view", "customer.view_all", "payment.view")


def _has_customer_permission(user, *permission_keys):
    return bool(
        user.is_superuser or user.is_staff or is_admin(user) or is_finance(user)
        or any(can(user, key) for key in permission_keys)
    )


def _customer_scope(user, *permission_keys):
    """Union the records visible through the user's active database RBAC grants."""
    from functools import reduce
    from operator import or_

    # Admin / finance / staff users always see all customers -- check this FIRST
    # so we never fall through to the empty-queryset branch for privileged users.
    if user.is_superuser or user.is_staff or is_admin(user) or is_finance(user):
        return Customer.objects.all()
    querysets = [scope_queryset(user, key, Customer.objects.all()) for key in permission_keys if can(user, key)]
    if not querysets:
        return Customer.objects.none()
    return reduce(or_, querysets)


def _payment_scope(user, *permission_keys):
    from functools import reduce
    from operator import or_

    base = CustomerVoucherStatus.objects.all()
    querysets = [scope_queryset(user, key, base) for key in permission_keys if can(user, key)]
    if user.is_superuser or user.is_staff or is_admin(user) or is_finance(user):
        return base
    if not querysets:
        return base.none()
    return reduce(or_, querysets)


def _get_customer_for_user(user, customer_id, *permission_keys):
    if not _has_customer_permission(user, *permission_keys):
        raise PermissionDenied("You do not have permission to view customer records.")
    return get_object_or_404(
        _customer_scope(user, *permission_keys).select_related("salesperson", "credit_profile"),
        pk=customer_id,
    )


def _annotate_portfolio_metrics(queryset):
    """Attach the voucher metrics using the fast indexed CustomerVoucherStatus table."""
    from django.db.models import DecimalField, IntegerField
    from decimal import Decimal

    tax_invoices = CustomerVoucherStatus.objects.filter(
        customer_id=OuterRef("pk"),
        voucher_type__iexact="TAX INVOICE",
    )
    order_count = tax_invoices.order_by().values("customer_id").annotate(
        total=Count("id")
    ).values("total")[:1]
    order_value = tax_invoices.order_by().values("customer_id").annotate(
        total=Sum("voucher_amount")
    ).values("total")[:1]
    last_order = tax_invoices.order_by("-voucher_date").values("voucher_date")[:1]
    return queryset.annotate(
        portfolio_total_orders=Coalesce(Subquery(order_count, output_field=IntegerField()), Value(0)),
        portfolio_total_order_value=Coalesce(Subquery(order_value, output_field=DecimalField(max_digits=14, decimal_places=2)), Value(Decimal("0.00"))),
        portfolio_last_order_date=Subquery(last_order, output_field=DateField()),
    )


def _annotate_customer_list_activity(queryset):
    """Compute list-card activity fields in SQL instead of querying per row."""
    today = timezone.now().date()
    cutoff = today - timezone.timedelta(days=90)
    due_followups = CustomerFollowUp.objects.filter(
        customer_id=OuterRef("pk"), followup_date__lte=today, is_completed=False
    ).values("customer_id").annotate(total=Count("id")).values("total")[:1]
    next_followup = CustomerFollowUp.objects.filter(
        customer_id=OuterRef("pk"), followup_date__gte=today, is_completed=False
    ).order_by("followup_date").values("followup_date")[:1]
    last_remark = CustomerRemark.objects.filter(
        customer_id=OuterRef("pk")
    ).order_by("-created_at").values("created_at")[:1]
    return queryset.annotate(
        api_followups_due=Coalesce(Subquery(due_followups, output_field=IntegerField()), Value(0)),
        api_next_followup_date=Subquery(next_followup, output_field=DateField()),
        api_last_remark_at=Subquery(last_remark, output_field=DateTimeField()),
        api_has_overdue=Exists(CustomerVoucherStatus.objects.filter(
            customer_id=OuterRef("pk"), is_credit_period_crossed=True
        )),
        api_has_recent_voucher=Exists(CustomerVoucherStatus.objects.filter(
            customer_id=OuterRef("pk"), voucher_date__gte=cutoff
        )),
        api_has_recent_tax_invoice=Exists(CustomerVoucherStatus.objects.filter(
            customer_id=OuterRef("pk"), voucher_type__iexact="TAX INVOICE", voucher_date__gte=cutoff
        )),
    )


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class CustomerMapPointsView(APIView):
    """Return only geocoded customers visible under the user's customer viewing scope."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _has_customer_permission(request.user, "customer.view_all", "customer.view"):
            raise PermissionDenied("Detailed customer map access is not enabled for this account.")

        points = _customer_scope(
            request.user,
            "customer.view_all",
            "customer.view",
        ).filter(
            latitude__isnull=False,
            longitude__isnull=False,
        ).order_by("name", "pk").values(
            "id", "name", "state", "district", "latitude", "longitude",
        )
        return Response(list(points))

#Authentication , RBAC , Pagination , Filteration
class CustomerListView(generics.ListAPIView):
    """
    GET /api/customers/?search=&filter=&page=
    Lists customers with live credit profile and voucher status.
    """
    serializer_class = CustomerListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        user = self.request.user
        if not _has_customer_permission(user, "customer.view", "customer.view_all", "payment.view"):
            raise PermissionDenied("Customer Directory access is not enabled for this account.")
        qs = _annotate_customer_list_activity(
            _annotate_portfolio_metrics(
                _customer_scope(user, "customer.view", "customer.view_all", "payment.view")
            )
        ).select_related("salesperson", "unit_membership__unit", "credit_profile")

        # Search
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(phone__icontains=search)
                | Q(state__icontains=search)
                | Q(district__icontains=search)
            )

        # Filter tab
        active_filter = self.request.query_params.get("filter", "all").strip().lower()
        today = timezone.now().date()
        if active_filter == "followup_due":
            qs = qs.filter(
                followups__followup_date__lte=today,
                followups__is_completed=False,
            ).distinct()
        elif active_filter == "payment_pending":
            qs = qs.filter(
                Q(credit_profile__outstanding_balance__gt=0)
                | Q(voucher_statuses__is_credit_period_crossed=True)
            ).distinct()
        elif active_filter == "recently_contacted":
            qs = qs.filter(remarks__isnull=False).distinct()

        payment_status = self.request.query_params.get("payment_status", "all").strip().lower()
        has_overdue = Q(voucher_statuses__is_credit_period_crossed=True)
        has_balance = Q(credit_profile__outstanding_balance__gt=0)
        if payment_status == "overdue":
            qs = qs.filter(has_overdue).distinct()
        elif payment_status == "pending":
            qs = qs.filter(has_balance).exclude(has_overdue).distinct()
        elif payment_status == "paid":
            qs = qs.exclude(has_overdue).filter(Q(credit_profile__outstanding_balance__lte=0) | Q(credit_profile__isnull=True)).distinct()
        elif payment_status == "no_payment":
            qs = qs.filter(voucher_statuses__isnull=True).distinct()

        if self.request.query_params.get("has_outstanding", "").lower() == "true":
            qs = qs.filter(has_balance)

        ordering = {
            "name_asc": "name",
            "name_desc": "-name",
            "outstanding_high": "-credit_profile__outstanding_balance",
            "outstanding_low": "credit_profile__outstanding_balance",
        }.get(self.request.query_params.get("ordering", "default"), "name")
        return qs.order_by(ordering, "pk")


class CustomerDetailView(generics.RetrieveAPIView):
    """
    GET /api/customers/{id}/
    Returns full customer detail with remarks, followups, and Tally vouchers.
    """
    serializer_class = CustomerDetailSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        user = self.request.user
        keys = tuple(key for key in ("customer.view", "customer.view_all") if can(user, key))
        if not _has_customer_permission(user, *keys):
            return Customer.objects.none()
        return _customer_scope(user, *keys).select_related("salesperson", "credit_profile").prefetch_related(
            "voucher_statuses__voucher", "remarks__salesperson", "followups__salesperson",
            "voucher_statuses__payment_thread__expected_date_history",
        )


class CustomerMobileEditView(APIView):
    """JWT API bridge for the existing customer contact and credit forms."""
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication, SessionAuthentication]

    def _get_customer(self, request, pk):
        return _get_customer_for_user(request.user, pk, "customer.view", "customer.view_all")

    def get(self, request, pk):
        customer = self._get_customer(request, pk)
        can_edit_contact = can(request.user, "customer.edit", customer)
        can_edit_credit = can(request.user, "customer.edit_credit", customer)
        if not can_edit_contact and not can_edit_credit:
            raise PermissionDenied("Customer edit access is not enabled for this account.")

        profile = getattr(customer, "credit_profile", None)
        return Response({
            "customer": {
                "id": customer.pk,
                "phone": customer.phone or "",
                "email": customer.email or "",
                "salesperson_id": customer.salesperson_id,
                "assignedSalesperson": customer.salesperson.name if customer.salesperson else "Unassigned",
                "credit_period_days": profile.credit_period_days if profile else 7,
            },
            "salespersons": list(SalesPerson.objects.order_by("name").values("id", "name")) if can_edit_contact else [],
            "can_edit_contact": can_edit_contact,
            "can_edit_credit": can_edit_credit,
        })

    def patch(self, request, pk):
        customer = self._get_customer(request, pk)
        contact_fields = {"phone", "email", "salesperson"}
        edits_contact = any(field in request.data for field in contact_fields)
        edits_credit = "credit_period_days" in request.data
        if not edits_contact and not edits_credit:
            return Response({"error": "No customer fields were provided."}, status=status.HTTP_400_BAD_REQUEST)
        if edits_contact and not can(request.user, "customer.edit", customer):
            raise PermissionDenied("Contact editing is not enabled for this account.")
        if edits_credit and not can(request.user, "customer.edit_credit", customer):
            raise PermissionDenied("Credit period editing is not enabled for this account.")

        with transaction.atomic():
            # Use of=('self',) to avoid PostgreSQL error with outer joins on nullable fields
            customer = Customer.objects.select_for_update(of=('self',)).select_related("salesperson", "credit_profile").get(pk=customer.pk)
            contact_form = None
            if edits_contact:
                contact_data = {
                    "phone": request.data.get("phone", customer.phone or ""),
                    "email": request.data.get("email", customer.email or ""),
                    "salesperson": request.data.get("salesperson", customer.salesperson_id or ""),
                }
                contact_form = CustomerReassignForm(contact_data, instance=customer)

            credit_form = None
            profile = None
            if edits_credit:
                profile, _ = CustomerCreditProfile.objects.get_or_create(customer=customer)
                credit_form = CustomerCreditForm(
                    {"credit_period_days": request.data.get("credit_period_days")},
                    instance=profile,
                )

            errors = {}
            if contact_form is not None and not contact_form.is_valid():
                errors["contact"] = contact_form.errors
            if credit_form is not None and not credit_form.is_valid():
                errors["credit"] = credit_form.errors
            if errors:
                return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

            if contact_form is not None:
                customer = contact_form.save()
            if credit_form is not None:
                profile = credit_form.save()
                # Synchronize overdue status across unpaid vouchers
                today = timezone.localdate()
                new_days = profile.credit_period_days or 7
                for vs in customer.voucher_statuses.filter(is_fully_paid=False).select_related("voucher"):
                    if vs.voucher and vs.voucher.date:
                        elapsed = (today - vs.voucher.date).days
                        vs.credit_days_elapsed = elapsed
                        vs.is_credit_period_crossed = elapsed > new_days
                        vs.save(update_fields=["credit_days_elapsed", "is_credit_period_crossed"])

        customer.refresh_from_db()
        profile = CustomerCreditProfile.objects.filter(customer=customer).first()
        return Response({
            "success": True,
            "customer": CustomerListSerializer(customer, context={"request": request}).data,
            "credit_period_days": profile.credit_period_days if profile else 7,
        })


class CustomerRemarkCreateView(APIView):
    """
    POST /api/customers/{id}/remarks/
    Add a new remark to a customer.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        customer = _get_customer_for_user(request.user, pk, "customer.view", "customer.view_all")
        salesperson = SalesPerson.objects.filter(user=request.user).first() or customer.salesperson
        if not salesperson:
            return Response({"error": "Link a salesperson to your account or assign one to this customer before adding remarks."}, status=400)

        remark_text = request.data.get("remark", "").strip() or request.data.get("text", "").strip()
        if not remark_text:
            return Response(
                {"error": "Remark text is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        remark = CustomerRemark.objects.create(
            customer=customer,
            salesperson=salesperson,
            remark=remark_text,
        )

        return Response(
            CustomerRemarkSerializer(remark).data,
            status=status.HTTP_201_CREATED,
        )


class CustomerFollowUpListCreateView(APIView):
    """
    GET  /api/customers/{id}/followups/
    POST /api/customers/{id}/followups/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        customer = _get_customer_for_user(request.user, pk, "customer.view", "customer.view_all")
        followups = CustomerFollowUp.objects.filter(customer=customer).order_by("-followup_date")
        return Response(CustomerFollowUpSerializer(followups, many=True).data)

    def post(self, request, pk):
        customer = _get_customer_for_user(request.user, pk, "customer.view", "customer.view_all")
        salesperson = SalesPerson.objects.filter(user=request.user).first() or customer.salesperson
        if not salesperson:
            return Response({"error": "Link a salesperson to your account or assign one to this customer before scheduling follow-ups."}, status=400)

        date_val = request.data.get("followup_date") or request.data.get("date")
        note = request.data.get("note") or request.data.get("notes") or request.data.get("purpose", "")

        if not date_val:
            date_val = timezone.now().date() + timezone.timedelta(days=1)
        elif isinstance(date_val, str):
            try:
                from datetime import datetime
                date_val = datetime.strptime(date_val, "%Y-%m-%d").date()
            except Exception:
                try:
                    from datetime import datetime
                    date_val = datetime.strptime(date_val, "%d %b %Y").date()
                except Exception:
                    date_val = timezone.now().date() + timezone.timedelta(days=1)

        followup = CustomerFollowUp.objects.create(
            customer=customer,
            salesperson=salesperson,
            followup_date=date_val,
            note=note,
        )

        return Response(
            CustomerFollowUpSerializer(followup).data,
            status=status.HTTP_201_CREATED,
        )


class CustomerPaymentTicketActionView(APIView):
    """
    POST /api/customers/{id}/payment-ticket/
    Raise or resolve a payment discussion ticket on a voucher status.
    Payload: {"payment_id": 123, "action": "raise" | "solve"}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        customer = _get_customer_for_user(request.user, pk, "payment.view")
        payment_id = request.data.get("payment_id")
        action = request.data.get("action", "raise").lower()

        voucher_status = get_object_or_404(
            _payment_scope(request.user, "payment.view"), id=payment_id, customer=customer
        )

        thread, _ = PaymentDiscussionThread.objects.get_or_create(
            voucher_status=voucher_status
        )
        email_sent = False

        if action == "raise":
            thread.raise_ticket(request.user)
            PaymentTicketEvent.objects.create(thread=thread, event_type="RAISED", performed_by=request.user)
            from django.conf import settings
            from django.core.mail import EmailMultiAlternatives
            salesperson = customer.salesperson
            salesperson_email = salesperson.user.email if salesperson and salesperson.user else ""
            recipients = [salesperson_email] if salesperson_email else []
            cc = [address for address in ("abhijay.obluhc@gmail.com", request.user.email) if address]
            if recipients or cc:
                invoice = voucher_status.voucher.voucher_number if voucher_status.voucher else f"INV-{voucher_status.pk}"
                message = EmailMultiAlternatives(
                    subject=f"Payment ticket raised for {customer.name}",
                    body=(f"{request.user.username} raised a payment ticket.\n\n"
                          f"Customer: {customer.name}\nInvoice: {invoice}\n"
                          "Please review the payment thread in the CRM."),
                    from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
                    to=recipients,
                    cc=cc,
                )
                try:
                    email_sent = message.send(fail_silently=False) == 1
                except Exception:
                    email_sent = False
            else:
                email_sent = False
        elif action == "solve":
            thread.solve_ticket(request.user)
            PaymentTicketEvent.objects.create(thread=thread, event_type="SOLVED", performed_by=request.user)
            email_sent = False
        elif action == "expected":
            expected_date = request.data.get("expected_date")
            if not expected_date:
                return Response({"error": "expected_date is required."}, status=400)
            try:
                from datetime import date as date_type
                expected_date = date_type.fromisoformat(expected_date)
            except (TypeError, ValueError):
                return Response({"error": "expected_date must use YYYY-MM-DD format."}, status=400)
            PaymentExpectedDateHistory.objects.create(thread=thread, expected_date=expected_date, set_by=request.user)
            email_sent = False
        elif action == "remark":
            remark = str(request.data.get("remark") or "").strip()
            if not remark:
                return Response({"error": "remark is required."}, status=400)
            PaymentRemark.objects.create(thread=thread, remark=remark, created_by=request.user)
            email_sent = False
        elif action == "email":
            recipient = (customer.email or "").strip()
            if not recipient:
                return Response({"error": "This customer does not have an email address."}, status=400)
            from django.conf import settings
            from django.core.mail import EmailMultiAlternatives
            invoice = voucher_status.voucher.voucher_number if voucher_status.voucher else f"INV-{voucher_status.pk}"
            email = EmailMultiAlternatives(
                subject=f"Payment reminder for invoice {invoice}",
                body=(f"Dear {customer.name},\n\nThis is a reminder regarding invoice {invoice}. "
                      f"Outstanding amount: ₹{voucher_status.unpaid_amount or 0}.\n\n"
                      "Please contact our accounts team if you have already made this payment."),
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
                to=[recipient],
                cc=["finance@oblutools.com"],
            )
            if email.send(fail_silently=False) != 1:
                return Response({"error": "The reminder email could not be sent."}, status=502)
            email_sent = True
        else:
            return Response({"error": "Unsupported payment action."}, status=400)

        voucher_status.refresh_from_db()

        return Response(
            {
                "success": True,
                "ticket_status": thread.ticket_status,
                "email_sent": email_sent,
                "payment": CustomerPaymentSerializer(voucher_status).data,
            },
            status=status.HTTP_200_OK,
        )


class DashboardStatsView(APIView):
    """
    GET /api/dashboard/stats/
    Returns live CRM overview KPIs for the employee / admin mobile dashboard.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cust_qs = get_visible_customer_queryset(request.user)

        total_customers = cust_qs.count()

        # Follow-ups due
        today = timezone.now().date()
        active_cutoff = today - timezone.timedelta(days=90)
        active_customers_count = cust_qs.filter(
            voucher_statuses__voucher_type__iexact="TAX INVOICE",
            voucher_statuses__voucher_date__gte=active_cutoff,
        ).distinct().count()
        followups_due = CustomerFollowUp.objects.filter(
            followup_date__lte=today, is_completed=False
        )
        followups_due = followups_due.filter(customer__in=cust_qs)
        followups_due_count = followups_due.count()

        # Overdue payment vouchers
        overdue_qs = CustomerVoucherStatus.objects.filter(is_credit_period_crossed=True)
        overdue_qs = overdue_qs.filter(customer__in=cust_qs)
        overdue_count = overdue_qs.count()
        pending_customers_count = cust_qs.filter(
            credit_profile__outstanding_balance__gt=0
        ).distinct().count()

        # A real seven-day activity series for the same customers the user may
        # see. Remarks are touchpoints; scheduled follow-ups are counted by
        # their scheduled date. Empty days stay zero rather than using samples.
        week_start = today - timezone.timedelta(days=6)
        day_dates = [week_start + timezone.timedelta(days=offset) for offset in range(7)]
        remark_counts = {
            row["day"]: row["total"]
            for row in CustomerRemark.objects.filter(
                customer__in=cust_qs,
                created_at__date__range=(week_start, today),
            ).annotate(day=TruncDate("created_at")).values("day").annotate(total=Count("id"))
        }
        followup_counts = {
            row["followup_date"]: row["total"]
            for row in CustomerFollowUp.objects.filter(
                customer__in=cust_qs,
                followup_date__range=(week_start, today),
            ).values("followup_date").annotate(total=Count("id"))
        }
        weekly_activity = [{
            "date": day.isoformat(),
            "day": day.strftime("%a"),
            "interactions": remark_counts.get(day, 0),
            "followups": followup_counts.get(day, 0),
        } for day in day_dates]

        # Total outstanding
        total_balance = cust_qs.aggregate(
            total=Sum("credit_profile__outstanding_balance")
        )["total"] or 0

        # Leads count
        from leads.models import Lead
        leads_count = scope_queryset(request.user, "lead.view", Lead.objects.all()).count() if can(request.user, "lead.view") else 0

        return Response(
            {
                "totalCustomers": total_customers,
                "activeCustomersCount": active_customers_count,
                "followUpsDueCount": followups_due_count,
                "pendingPaymentsCount": pending_customers_count,
                "overduePaymentsCount": overdue_count,
                "weeklyCustomerActivity": weekly_activity,
                "totalOutstandingNum": float(abs(total_balance)),
                "totalOutstandingFormatted": f"₹{int(abs(total_balance)):,}",
                "totalLeadsCount": leads_count,
                "syncHealth": "100% Live",
            }
        )


class CustomerChartsView(APIView):
    """
    GET /api/customers/charts/
    Returns distribution data for charts in the mobile app.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Count, Q
        if not _has_customer_permission(request.user, "customer.view_all"):
            raise PermissionDenied("Customer analytics access is not enabled for this account.")
        cust_qs = _customer_scope(request.user, "customer.view_all")

        sp_counts = (
            cust_qs.values("salesperson__name")
            .annotate(count=Count("id"))
            .order_by("-count")[:10]
        )
        salesperson_dist = [
            {"name": s["salesperson__name"] or "Unassigned", "customers": s["count"]}
            for s in sp_counts
        ]

        state_counts = (
            cust_qs.values("state")
            .annotate(count=Count("id"))
            .order_by("-count")[:10]
        )
        state_dist = [
            {"state": s["state"] or "Other", "count": s["count"]}
            for s in state_counts
        ]

        voucher_qs = CustomerVoucherStatus.objects.filter(customer__in=cust_qs)
        vouchers_total = voucher_qs.count()
        vouchers_overdue = voucher_qs.filter(is_credit_period_crossed=True).count()
        vouchers_pending = voucher_qs.filter(
            Q(is_unpaid=True) | Q(is_partially_paid=True)
        ).count()
        vouchers_paid = voucher_qs.filter(is_fully_paid=True).count()

        total_balance = cust_qs.aggregate(
            total=Sum("credit_profile__outstanding_balance")
        )["total"] or 0

        return Response({
            "totalCustomers": cust_qs.count(),
            "salespersonDistribution": salesperson_dist,
            "stateDistribution": state_dist,
            "vouchers": {
                "total": vouchers_total,
                "overdue": vouchers_overdue,
                "pending": vouchers_pending,
                "paid": vouchers_paid,
            },
            "totalOutstanding": float(abs(total_balance)),
            "totalOutstandingFormatted": f"₹{int(abs(total_balance)):,}",
        })


class CustomerWorkspaceToolsView(APIView):
    """Small mobile endpoints for the customer workspace tools.

    Every customer-facing result is scoped to the authenticated user's existing
    customer visibility. Administrative actions remain limited to staff/admin.
    """
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _role_keys(user):
        try:
            return {assignment.role.role_key.lower() for assignment in user.employee_profile.role_assignments.filter(is_active=True)}
        except Exception:
            return set()

    @classmethod
    def _has_role(cls, user, *keys):
        return bool(cls._role_keys(user).intersection(keys))

    def get(self, request, tool):
        from datetime import date
        from calendar import monthrange
        from django.db.models import Q

        if tool == "team-customers":
            if not _has_customer_permission(request.user, "customer.view", "customer.view_all"):
                raise PermissionDenied("Team customer access is not enabled for this account.")
            base_scope = _customer_scope(request.user, "customer.view", "customer.view_all")
            sp_names = sorted(list(set(
                base_scope.exclude(salesperson__isnull=True).values_list("salesperson__name", flat=True)
            )))

            target_scope = base_scope
            sp_param = request.query_params.get("salesperson")
            if sp_param and sp_param != "All Salespeople":
                if str(sp_param).isdigit():
                    target_scope = target_scope.filter(salesperson_id=int(sp_param))
                else:
                    target_scope = target_scope.filter(salesperson__name__iexact=str(sp_param).strip())

            q_search = request.query_params.get("search", "").strip()
            if q_search:
                target_scope = target_scope.filter(
                    Q(name__icontains=q_search) |
                    Q(phone__icontains=q_search) |
                    Q(district__icontains=q_search) |
                    Q(state__icontains=q_search)
                )

            # Query all matching customers in target_scope with complete metrics
            annotated_qs = _annotate_customer_list_activity(
                _annotate_portfolio_metrics(target_scope)
            ).select_related("salesperson", "unit_membership__unit", "credit_profile").order_by("name")

            raw_customers = list(annotated_qs)
            serialized_members = CustomerListSerializer(raw_customers, many=True, context={"request": request}).data
            member_dict = {row["id"]: row for row in serialized_members}

            # Group into Units and Standalone accounts identical to website's AdminSalesPersonCustomersView
            unit_map = {}
            standalone_rows = []

            for cust in raw_customers:
                cust_data = member_dict.get(cust.id) or CustomerListSerializer(cust, context={"request": request}).data
                membership = getattr(cust, "unit_membership", None)
                if membership:
                    uid = membership.unit_id
                    if uid not in unit_map:
                        unit_map[uid] = {
                            "unit_obj": membership.unit,
                            "members_models": [],
                            "members": [],
                        }
                    unit_map[uid]["members_models"].append(cust)
                    unit_map[uid]["members"].append(cust_data)
                else:
                    cust_data["is_unit"] = False
                    standalone_rows.append(cust_data)

            enriched_units = []
            for uid, data in unit_map.items():
                unit_obj = data["unit_obj"]
                members_models = data["members_models"]
                members = data["members"]

                is_red_flag = all(getattr(m, "is_red_flag", not getattr(m, "api_has_recent_tax_invoice", False)) for m in members_models)
                total_orders = sum(getattr(m, "portfolio_total_orders", 0) for m in members_models)
                total_value = sum(float(getattr(m, "portfolio_total_order_value", 0) or 0) for m in members_models)
                outstanding_sum = sum(
                    float(m.credit_profile.outstanding_balance or 0)
                    for m in members_models
                    if getattr(m, "credit_profile", None) and (m.credit_profile.outstanding_balance or 0) > 0
                )
                last_order_dates = [getattr(m, "portfolio_last_order_date", None) for m in members_models if getattr(m, "portfolio_last_order_date", None)]
                latest_order_date = max(last_order_dates).isoformat() if last_order_dates else None

                sp_name = members_models[0].salesperson.name if members_models[0].salesperson else "Unassigned"

                enriched_units.append({
                    "id": f"unit-{uid}",
                    "is_unit": True,
                    "unit_id": uid,
                    "name": unit_obj.name,
                    "assignedSalesperson": sp_name,
                    "members_count": len(members),
                    "members": members,
                    "is_red_flag": is_red_flag,
                    "portfolioStatus": "Inactive" if is_red_flag else "Active",
                    "status": "Inactive" if is_red_flag else "Active",
                    "total_orders": total_orders,
                    "totalOrders": total_orders,
                    "total_order_value": total_value,
                    "totalOrderValue": f"₹{total_value:,.2f}",
                    "outstandingPayment": f"₹{outstanding_sum:,.2f}" if outstanding_sum > 0 else "₹0.00",
                    "outstandingPaymentNum": outstanding_sum,
                    "last_order_date": latest_order_date,
                    "lastOrder": latest_order_date,
                })

            # Combined cards matching website
            all_cards = enriched_units + standalone_rows
            total_display = len(all_cards)

            active_count = sum(1 for x in all_cards if x.get("portfolioStatus") == "Active" or x.get("status") == "Active")
            inactive_count = sum(1 for x in all_cards if x.get("portfolioStatus") == "Inactive" or x.get("status") == "Inactive")
            due_accounts = sum(1 for x in all_cards if (x.get("outstandingPaymentNum") or 0) > 0)
            total_exposure = sum(float(x.get("outstandingPaymentNum") or 0) for x in all_cards)

            stats = {
                "total_accounts": total_display,
                "raw_total_accounts": len(raw_customers),
                "active_clients": active_count,
                "inactive_dormant": inactive_count,
                "due_accounts": due_accounts,
                "total_exposure": float(total_exposure),
            }

            page_size = int(request.query_params.get("page_size", 50)) if str(request.query_params.get("page_size", "")).isdigit() else 50
            page_num = int(request.query_params.get("page", 1)) if str(request.query_params.get("page", "")).isdigit() else 1
            offset = (page_num - 1) * page_size
            paged_cards = all_cards[offset : offset + page_size]

            return Response({
                "rows": paged_cards,
                "units_count": len(enriched_units),
                "standalone_count": len(standalone_rows),
                "total_display": total_display,
                "total_count": total_display,
                "salespersons": sp_names,
                "stats": stats,
                "page": page_num,
                "page_size": page_size,
                "total_pages": (total_display + page_size - 1) // page_size if total_display > 0 else 1,
            })

        if tool == "payment-followups":
            if not _has_customer_permission(request.user, "payment.view"):
                raise PermissionDenied("Payment follow-up access is not enabled for this account.")
            qs = CustomerVoucherStatus.objects.filter(
                Q(is_unpaid=True) | Q(is_partially_paid=True),
                pk__in=_payment_scope(request.user, "payment.view").values("pk"),
            ).select_related(
                "customer", "customer__salesperson", "customer__credit_profile",
                "voucher", "payment_thread",
            ).prefetch_related(
                "payment_thread__remarks__created_by",
                "payment_thread__expected_date_history__set_by",
                "payment_thread__ticket_events__performed_by",
            ).order_by("customer__name", "voucher_date")

            today = timezone.localdate()
            rows = []
            for row in qs[:300]:
                thread = getattr(row, "payment_thread", None)
                credit_days = (
                    row.customer.credit_profile.credit_period_days
                    if hasattr(row.customer, "credit_profile") and row.customer.credit_profile
                    else 7
                )
                days_elapsed = row.credit_days_elapsed or 0
                if row.is_credit_period_crossed:
                    credit_status = f"Crossed by {days_elapsed} days"
                else:
                    credit_status = f"{max(credit_days - days_elapsed, 0)} days remaining"

                remarks_list = []
                expected_list = []
                ticket_events = []
                ticket_status = "OPEN"
                if thread:
                    ticket_status = thread.ticket_status or "OPEN"
                    for r in thread.remarks.all().order_by("-created_at"):
                        remarks_list.append({
                            "id": r.id,
                            "text": r.remark,
                            "user": r.created_by.username if r.created_by else "Unknown",
                            "time": r.created_at.strftime("%d %b %H:%M"),
                        })
                    for e in thread.expected_date_history.all().order_by("-created_at"):
                        expected_list.append({
                            "id": e.id,
                            "date": str(e.expected_date),
                            "user": e.set_by.username if e.set_by else "Unknown",
                            "time": e.created_at.strftime("%d %b %Y %H:%M"),
                        })
                    for ev in thread.ticket_events.all().order_by("-performed_at"):
                        ticket_events.append({
                            "id": ev.id,
                            "event_type": ev.event_type,
                            "user": ev.performed_by.username if ev.performed_by else "Unknown",
                            "time": ev.performed_at.strftime("%d %b %Y %H:%M") if ev.performed_at else "",
                        })

                rows.append({
                    "id": row.id,
                    "voucher_status_id": row.id,
                    "customer": row.customer.name,
                    "customer_id": row.customer_id,
                    "salesperson": row.customer.salesperson.name if row.customer.salesperson else "Unassigned",
                    "sp": row.customer.salesperson.name if row.customer.salesperson else "Unassigned",
                    "invoice": row.voucher.voucher_number if row.voucher else "",
                    "voucher": row.voucher.voucher_number if row.voucher else "",
                    "date": row.voucher_date.strftime("%d-%m-%Y") if row.voucher_date else "",
                    "amount": str(row.voucher_amount or 0),
                    "total": row.voucher_amount or 0,
                    "unpaid": str(row.unpaid_amount or 0),
                    "pending": row.unpaid_amount or 0,
                    "overdue": bool(row.is_credit_period_crossed),
                    "is_credit_period_crossed": bool(row.is_credit_period_crossed),
                    "credit_days_elapsed": days_elapsed,
                    "credit_status": credit_status,
                    "credit": credit_status,
                    "ticket_status": ticket_status,
                    "remarks": remarks_list,
                    "remarks_count": len(remarks_list),
                    "expected_dates": expected_list,
                    "latest_expected_date": expected_list[0]["date"] if expected_list else None,
                    "ticket_events": ticket_events,
                })
            return Response(rows)

        if tool == "monthly-sales":
            if not _has_customer_permission(request.user, "customer.view", "customer.view_all", "payment.view"):
                raise PermissionDenied("Monthly sales access is not enabled for this account.")
            month = request.query_params.get("month", date.today().strftime("%Y-%m"))
            try:
                year, month_num = (int(x) for x in month.split("-", 1))
                start = date(year, month_num, 1)
                end = date(year, month_num, monthrange(year, month_num)[1])
            except (ValueError, TypeError):
                return Response({"error": "month must use YYYY-MM format"}, status=400)
            permitted_statuses = _payment_scope(request.user, "customer.view", "customer.view_all", "payment.view")
            status_qs = permitted_statuses.filter(
                voucher_type__iexact="TAX INVOICE", voucher_date__range=(start, end)
            ).select_related("customer", "voucher").order_by("voucher_date", "customer__name")
            selected_salesperson = request.query_params.get("salesperson")
            if selected_salesperson:
                status_qs = status_qs.filter(sold_by_id=selected_salesperson)

            from tally_voucher.models import VoucherStockItem
            voucher_ids = status_qs.values_list("voucher_id", flat=True)
            stock_items = VoucherStockItem.objects.filter(voucher_id__in=voucher_ids).select_related(
                "voucher", "item"
            ).order_by("voucher__date", "voucher_id", "id")
            status_by_voucher = {item.voucher_id: item for item in status_qs}
            rows = []
            total = 0
            counted_vouchers = set()
            for line in stock_items:
                vs = status_by_voucher.get(line.voucher_id)
                if not vs:
                    continue
                if line.voucher_id not in counted_vouchers:
                    party_row = line.voucher.rows.filter(ledger__iexact=line.voucher.party_name).first()
                    total += party_row.amount if party_row else (vs.voucher_amount or 0)
                    counted_vouchers.add(line.voucher_id)
                rows.append({
                    "id": f"{line.voucher_id}-{line.pk}",
                    "date": line.voucher.date,
                    "customer": line.voucher.party_name,
                    "voucher": line.voucher.voucher_number,
                    "product": line.item.name if line.item else "",
                    "quantity": line.quantity,
                    "amount": str(line.amount or 0),
                    "status": "paid" if vs.is_fully_paid or (vs.unpaid_amount or 0) == 0 else "pending",
                })
            return Response({"rows": rows, "total": str(total), "month": start.strftime("%Y-%m")})

        if tool == "cross-selling":
            if not _has_customer_permission(request.user, "customer.view"):
                raise PermissionDenied("Cross-Selling Matrix access is not enabled for this account.")
            from .views import (
                CROSS_SELLING_CATEGORIES, get_cross_selling_mobile_dataset,
                get_cross_selling_user_permissions, filter_cross_selling_customers,
                compute_cross_selling_stats,
            )
            category_names = {item["id"]: item["name"] for item in CROSS_SELLING_CATEGORIES}
            permissions = get_cross_selling_user_permissions(request.user)
            dataset = get_cross_selling_mobile_dataset()
            base_accessible, visible_items = filter_cross_selling_customers(dataset["customers"], permissions)
            stats = compute_cross_selling_stats(base_accessible)

            salesperson_filter = request.query_params.get("salesperson", "").strip().casefold()
            if salesperson_filter and salesperson_filter != "all salespeople":
                visible_items = [
                    item for item in visible_items
                    if (item["customer"].salesperson.name if item["customer"].salesperson else "Unassigned").casefold()
                    == salesperson_filter
                ]

            search_query = request.query_params.get("q", "").strip().casefold()
            if search_query:
                visible_items = [
                    item for item in visible_items
                    if any(search_query in str(value or "").casefold() for value in (
                        item["customer"].name,
                        item["customer"].phone,
                        item["customer"].state,
                        item["customer"].district,
                        getattr(item["customer"], "city", "") or getattr(item["customer"], "district", ""),
                        item["customer"].salesperson.name if item["customer"].salesperson else "Unassigned",
                    ))
                ]

            missing_filter = request.query_params.get("missing_cat", "").strip().casefold()
            if missing_filter and missing_filter != "all missing categories":
                missing_id = next(
                    (key for key, name in category_names.items() if key == missing_filter or name.casefold() == missing_filter),
                    missing_filter,
                )
                visible_items = [item for item in visible_items if missing_id in item["missing_cat_ids"]]

            score_filter = request.query_params.get("score", "").strip()
            if score_filter.isdigit():
                score = int(score_filter)
                visible_items = [item for item in visible_items if item["bought_count"] == score]

            try:
                page_size = max(1, min(50, int(request.query_params.get("page_size", 25))))
            except (TypeError, ValueError):
                page_size = 25
            paginator = PageNumberPagination()
            paginator.page_size = page_size
            paginator.page_size_query_param = None
            paged_items = paginator.paginate_queryset(visible_items, request, view=self)
            customer_ids = [item["customer"].pk for item in paged_items]

            remark_counts = {
                entry["customer_id"]: entry["total"]
                for entry in CrossSellingRemark.objects.filter(customer_id__in=customer_ids)
                .values("customer_id")
                .annotate(total=Count("id"))
            }
            remarks_by_customer = {}
            for remark in CrossSellingRemark.objects.filter(customer_id__in=customer_ids).select_related(
                "salesperson"
            ).order_by("customer_id", "-created_at"):
                customer_remarks = remarks_by_customer.setdefault(remark.customer_id, [])
                if len(customer_remarks) < 2:
                    customer_remarks.append({
                        "id": remark.pk,
                        "salesperson": remark.salesperson.name if remark.salesperson else "System",
                        "text": remark.remark,
                        "created_at": remark.created_at.strftime("%d %b %Y, %I:%M %p") if remark.created_at else "",
                    })

            rows = []
            for item in paged_items:
                customer = item.get("customer")
                if customer:
                    checklist_data = []
                    for chk in item.get("checklist_items", []):
                        checklist_data.append({
                            "category_id": chk.get("category_id"),
                            "category_name": chk.get("category_name"),
                            "bought": bool(chk.get("bought")),
                            "product_name": chk.get("product_name", ""),
                            "total_qty": chk.get("total_qty", 0),
                            "total_amt": chk.get("total_amt", 0),
                        })

                    vouchers_data = [
                        {
                            "id": voucher.get("id"),
                            "number": voucher.get("number"),
                            "date": voucher.get("date").isoformat() if hasattr(voucher.get("date"), "isoformat") else str(voucher.get("date", "")),
                            "is_recent": bool(voucher.get("is_recent")),
                            "is_overdue": bool(voucher.get("is_overdue")),
                        }
                        for voucher in item.get("vouchers", [])
                    ]

                    rows.append({
                        "id": customer.pk,
                        "customer": customer.name,
                        "customer_id": customer.pk,
                        "city": customer.district or getattr(customer, "city", "") or "",
                        "state": customer.state or "",
                        "phone": customer.phone or "",
                        "salesperson": customer.salesperson.name if customer.salesperson else "Unassigned",
                        "is_active": bool(item.get("is_active")),
                        "bought": item.get("bought_count", 0),
                        "bought_count": item.get("bought_count", 0),
                        "missing": [category_names.get(key, key) for key in item.get("missing_cat_ids", [])],
                        "missing_cat_ids": item.get("missing_cat_ids", []),
                        "checklist": checklist_data,
                        "vouchers": vouchers_data,
                        "remarks": remarks_by_customer.get(customer.pk, []),
                        "remark_count": remark_counts.get(customer.pk, 0),
                    })

            sp_names = sorted(list(set(
                p.name for p in permissions.get("allowed_salespersons", []) if p and p.name
            )))

            return Response({
                "rows": rows,
                "stats": stats,
                "salespersons": sp_names,
                "page": paginator.page.number,
                "page_size": page_size,
                "total_count": paginator.page.paginator.count,
                "total_pages": paginator.page.paginator.num_pages,
                "has_next": paginator.page.has_next(),
                "has_prev": paginator.page.has_previous(),
            })

        if tool in {"my-incentives", "rsm-incentives", "sales-head-incentives"}:
            from datetime import date
            from django.test import RequestFactory
            month = request.query_params.get("month_picker") or date.today().strftime("%Y-%m")

            def website_context(view_class, **query):
                website_request = RequestFactory().get("/", {"month_picker": month, **query})
                website_request.user = request.user
                website_view = view_class()
                website_view.setup(website_request)
                return website_view.get_context_data()

            allowed = is_admin(request.user) or request.user.is_staff or request.user.is_superuser or self._has_role(request.user, "sales_head", "business", "admin")
            if tool == "my-incentives":
                # Use the website calculator as the source of truth. It applies
                # the same employee identity, month, product rules and payment
                # logic without requiring pre-created payout ledger rows.
                from incentive_calculator.views import ASMIncentiveCalculatorPaidOnlyView5

                context = website_context(ASMIncentiveCalculatorPaidOnlyView5)
                rows = [{
                    "id": f"{row.get('voucher_id')}-{index}",
                    "date": row["date"].isoformat() if hasattr(row.get("date"), "isoformat") else str(row.get("date", "")),
                    "customer": row.get("customer", ""),
                    "voucher": row.get("voucher_no", ""),
                    "product": row.get("product", ""),
                    "quantity": str(row.get("quantity", 0)),
                    "amount": str(row.get("amount", 0)),
                    "paid": bool(row.get("is_fully_paid")),
                    "has_incentive": bool(row.get("has_incentive")),
                } for index, row in enumerate(context.get("rows", []))]
                product_totals = context.get("product_totals", {})
                return Response({
                    "rows": rows,
                    "month": month,
                    "summary": {
                        "potential": str(context.get("grand_total_incentive", 0)),
                        "payable": str(context.get("payable_incentive", 0)),
                        "pending": str(context.get("unpayable_incentive", 0)),
                        "total_sales": str(context.get("total_sales", 0)),
                    },
                    "products": [{
                        "name": name,
                        "quantity": str(values.get("paid_qty", 0)),
                        "rate": str(values.get("rate", 0)),
                        "potential": str(values.get("potential_payout", 0)),
                        "payable": str(values.get("ready_payout", 0)),
                    } for name, values in product_totals.items()],
                })
            elif tool == "rsm-incentives":
                if not (request.user.is_superuser or getattr(request.user, "is_accountant", False) or request.user.groups.filter(name="Accountant").exists() or self._has_role(request.user, "rsm", "sales_head", "admin")):
                    return Response({"error": "Team incentive access is not available for this account."}, status=403)
                from incentive_calculator.views import RSMTeamIncentiveDashboardView
                from customer_dashboard.models import SalesPerson as DashboardSalesPerson

                requested_rsm = request.query_params.get("rsm")
                linked_salesperson = DashboardSalesPerson.objects.filter(user=request.user).first()
                if not requested_rsm and linked_salesperson:
                    requested_rsm = str(linked_salesperson.pk)
                context = website_context(RSMTeamIncentiveDashboardView, **({"rsm": requested_rsm} if requested_rsm else {}))
                allowed_rsms = context.get("rsms")
                team_rows = []
                for asm in context.get("team_report", []):
                    for item in asm.get("items", []):
                        team_rows.append({
                            "id": f"{asm['asm_name']}-{len(team_rows)}",
                            "employee": asm["asm_name"],
                            "product": item.get("name", ""),
                            "quantity": str(item.get("qty", 0)),
                            "asm_incentive": str(item.get("asm_incentive", 0)),
                            "rsm_incentive": str(item.get("rsm_incentive", 0)),
                            "paid": bool(item.get("is_paid")),
                            "trigger_on": bool(item.get("is_trigger_on")),
                        })
                return Response({
                    "rows": team_rows,
                    "month": month,
                    "rsm": getattr(context.get("selected_rsm"), "name", ""),
                    "rsm_id": getattr(context.get("selected_rsm"), "pk", None),
                    "rsms": [{"id": person.pk, "name": person.name} for person in allowed_rsms] if allowed_rsms is not None else [],
                    "summary": {
                        "potential": str(context.get("grand_rsm_potential", 0)),
                        "payable": str(context.get("grand_rsm_paid", 0)),
                        "pending": str(context.get("grand_rsm_pending", 0)),
                        "blocked": str(context.get("grand_rsm_triggered_off", 0)),
                    },
                })

            elif tool == "sales-head-incentives":
                if not allowed or (not self._has_role(request.user, "sales_head", "business", "admin") and not (request.user.is_staff or request.user.is_superuser or is_admin(request.user) or can(request.user, "*"))):
                    return Response({"error": "Administrator access required."}, status=403)

                # Keep mobile Sales Head Incentives in sync with the website. The
                # website calculates the override from invoice line items; it does
                # not read IncentivePaymentStatus (which is the ASM payout ledger).
                from incentive_calculator.views import SalesHeadDashboardView

                dashboard = SalesHeadDashboardView()
                dashboard.setup(request)
                context = dashboard.get_context_data()
                rows = []
                for salesperson_report in context.get("report", []):
                    for item in salesperson_report.get("items", []):
                        rows.append({
                            "id": len(rows) + 1,
                            "employee": salesperson_report["name"],
                            "role": salesperson_report["role"],
                            "customer": item["customer"],
                            "product": item["product"],
                            "date": item["date"].isoformat() if hasattr(item["date"], "isoformat") else str(item["date"]),
                            "quantity": item["qty"],
                            "asm_incentive": str(item["asm"]),
                            "amount": str(item["head"]),
                            "status": item["status"],
                        })

                totals = context.get("totals", {})
                return Response({
                    "rows": rows,
                    "month": context.get("month_picker"),
                    "display_month": context.get("display_month"),
                    "summary": {
                        "potential": str(totals.get("potential", 0)),
                        "payable": str(totals.get("payable", 0)),
                        "pending": str(totals.get("pending", 0)),
                        "blocked": str(totals.get("blocked", 0)),
                    },
                })
            return Response([])

        if tool == "unassigned":
            if not _has_customer_permission(request.user, "customer.view_all"):
                raise PermissionDenied("Unassigned customer access requires customer.view_all permission.")
            unassigned_qs = Customer.objects.filter(salesperson__isnull=True).order_by("name")
            q_search = request.query_params.get("search", "").strip()
            if q_search:
                unassigned_qs = unassigned_qs.filter(
                    Q(name__icontains=q_search) |
                    Q(state__icontains=q_search) |
                    Q(district__icontains=q_search) |
                    Q(phone__icontains=q_search)
                )

            salespersons = list(SalesPerson.objects.order_by("name").values("id", "name"))
            rows = [{
                "id": c.id,
                "name": c.name,
                "state": c.state or "",
                "district": c.district or "",
                "address": c.address or "",
                "phone": c.phone or "",
                "email": c.email or "",
            } for c in unassigned_qs[:200]]

            return Response({
                "rows": rows,
                "total_count": unassigned_qs.count(),
                "salespersons": salespersons,
            })

        if tool == "voucher-approvals":
            if not (request.user.is_staff or request.user.is_superuser or is_admin(request.user) or self._has_role(request.user, "accounts_operations", "sales_head") or can(request.user, "customer.view_all")):
                return Response({"error": "Administrator or Sales Head access required."}, status=403)
            qs = CustomerVoucherStatus.objects.filter(claim_status="PENDING").select_related("customer", "voucher", "claim_requested_by")
            return Response([{"id": row.id, "customer": row.customer.name,
                "voucher": row.voucher.voucher_number if row.voucher else "",
                "requested_by": row.claim_requested_by.name if row.claim_requested_by else "",
                "date": row.voucher_date} for row in qs.order_by("-voucher_date")[:300]])

        return Response({"error": "Unknown customer workspace tool."}, status=404)

    def post(self, request, tool):
        if tool == "payment-followups":
            if not _has_customer_permission(request.user, "payment.view"):
                raise PermissionDenied("Payment follow-up access is not enabled for this account.")
            vs_id = request.data.get("voucher_status_id") or request.data.get("id")
            if not vs_id:
                return Response({"error": "voucher_status_id is required"}, status=400)

            vs = get_object_or_404(CustomerVoucherStatus, id=vs_id)
            thread, _ = PaymentDiscussionThread.objects.get_or_create(voucher_status=vs)
            action = request.data.get("action", "remark")

            if action == "remark":
                remark_text = request.data.get("remark", "").strip()
                if not remark_text:
                    return Response({"error": "remark text is required"}, status=400)
                obj = PaymentRemark.objects.create(
                    thread=thread,
                    remark=remark_text,
                    created_by=request.user,
                )
                return Response({
                    "status": "ok",
                    "id": obj.id,
                    "text": remark_text,
                    "user": request.user.username,
                    "time": obj.created_at.strftime("%d %b %H:%M"),
                })

            elif action == "expected":
                exp_date = request.data.get("expected_date")
                if not exp_date:
                    return Response({"error": "expected_date is required"}, status=400)
                obj = PaymentExpectedDateHistory.objects.create(
                    thread=thread,
                    expected_date=exp_date,
                    set_by=request.user,
                )
                return Response({
                    "status": "ok",
                    "id": obj.id,
                    "date": str(exp_date),
                    "user": request.user.username,
                })

            elif action == "raise":
                thread.ticket_status = "RAISED"
                thread.raised_by = request.user
                thread.raised_at = timezone.now()
                thread.save()
                PaymentTicketEvent.objects.create(
                    thread=thread,
                    event_type="RAISED",
                    performed_by=request.user,
                )
                return Response({"status": "ok", "ticket_status": "RAISED"})

            elif action == "solve":
                thread.ticket_status = "SOLVED"
                thread.solved_by = request.user
                thread.solved_at = timezone.now()
                thread.save()
                PaymentTicketEvent.objects.create(
                    thread=thread,
                    event_type="SOLVED",
                    performed_by=request.user,
                )
                return Response({"status": "ok", "ticket_status": "SOLVED"})

            return Response({"error": "Unknown payment follow-up action."}, status=400)

        if tool == "unassigned":
            if not _has_customer_permission(request.user, "customer.view_all"):
                raise PermissionDenied("Reassigning customers requires customer.view_all permission.")
            customer_id = request.data.get("customer_id")
            salesperson_id = request.data.get("salesperson_id")
            if not customer_id or not salesperson_id:
                return Response({"error": "customer_id and salesperson_id are required"}, status=400)
            customer = get_object_or_404(Customer, id=customer_id)
            salesperson = get_object_or_404(SalesPerson, id=salesperson_id)
            customer.salesperson = salesperson
            customer.save(update_fields=["salesperson"])
            return Response({
                "status": "ok",
                "customer_id": customer.id,
                "salesperson": salesperson.name,
            })

        if tool == "voucher-approvals":
            if not (request.user.is_staff or request.user.is_superuser or is_admin(request.user) or self._has_role(request.user, "accounts_operations", "sales_head") or can(request.user, "customer.view_all")):
                return Response({"error": "Administrator or Sales Head access required."}, status=403)
            row = get_object_or_404(CustomerVoucherStatus, pk=request.data.get("id"), claim_status="PENDING")
            action = request.data.get("action")
            if action not in {"approve", "reject"}:
                return Response({"error": "action must be approve or reject"}, status=400)
            if action == "approve":
                row.sold_by = row.claim_requested_by
            row.claim_status = "APPROVED" if action == "approve" else "REJECTED"
            row.claim_requested_by = None
            row.save(update_fields=["sold_by", "claim_status", "claim_requested_by", "updated_at"])
            return Response({"success": True, "id": row.pk, "status": row.claim_status})

        if tool != "team-customers":
            return Response({"error": "This customer action is not available."}, status=404)
        user = request.user
        if not (user.is_superuser or user.is_staff or is_admin(user) or can(user, "customer.edit")):
            raise PermissionDenied("Customer edit access is not enabled for this account.")

        action = str(request.data.get("action", "")).strip().lower()
        unit_id = request.data.get("unit_id")
        visible_customers = _customer_scope(user, "customer.view", "customer.view_all")
        editable_customers = _customer_scope(user, "customer.edit")
        unit = get_object_or_404(
            CustomerUnit.objects.filter(memberships__customer__in=visible_customers).distinct(),
            pk=unit_id,
        )
        member_ids = list(unit.memberships.values_list("customer_id", flat=True))
        if not member_ids or editable_customers.filter(pk__in=member_ids).count() != len(member_ids):
            raise PermissionDenied("You can edit only units whose ledgers are inside your edit scope.")

        if action == "rename_unit":
            name = str(request.data.get("unit_name", "")).strip()
            if not name:
                return Response({"error": "Enter a name for this customer unit."}, status=400)
            if len(name) > 255:
                return Response({"error": "Unit names can be up to 255 characters."}, status=400)
            if CustomerUnit.objects.filter(salesperson_id=unit.salesperson_id, name__iexact=name).exclude(pk=unit.pk).exists():
                return Response({"error": "This salesperson already has a customer unit with that name."}, status=400)
            unit.name = name
            unit.save(update_fields=["name", "updated_at"])
            return Response({"success": True, "unit_id": unit.pk, "unit_name": unit.name})

        if action == "delete_unit":
            unit.delete()
            return Response({"success": True, "deleted": True})

        return Response({"error": "Unsupported customer unit action."}, status=400)

