"""
Customer Dashboard — REST API serializers for employee mobile app.
Bridges real PostgreSQL / Tally voucher data seamlessly to the React Native CRM.
"""

from rest_framework import serializers
from decimal import Decimal
from django.utils import timezone
from access_control.services import can
from .models import Customer, CustomerRemark, CustomerFollowUp, CustomerCreditProfile, CustomerVoucherStatus, PaymentDiscussionThread


class CustomerRemarkSerializer(serializers.ModelSerializer):
    salesperson_name = serializers.CharField(
        source="salesperson.name", read_only=True, default=""
    )
    date = serializers.SerializerMethodField()
    time = serializers.SerializerMethodField()
    text = serializers.CharField(source="remark", read_only=True)
    author = serializers.SerializerMethodField()

    class Meta:
        model = CustomerRemark
        fields = ["id", "remark", "text", "salesperson_name", "author", "date", "time", "created_at"]
        read_only_fields = ["id", "salesperson_name", "author", "date", "time", "created_at"]

    def get_date(self, obj):
        return obj.created_at.strftime("%d %b %Y") if obj.created_at else ""

    def get_time(self, obj):
        return obj.created_at.strftime("%I:%M %p") if obj.created_at else ""

    def get_author(self, obj):
        return obj.salesperson.name if obj.salesperson else "Sales Rep"


class CustomerFollowUpSerializer(serializers.ModelSerializer):
    salesperson_name = serializers.CharField(
        source="salesperson.name", read_only=True, default=""
    )
    customer_name = serializers.CharField(
        source="customer.name", read_only=True, default=""
    )
    date = serializers.SerializerMethodField()
    time = serializers.SerializerMethodField()
    purpose = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    notes = serializers.CharField(source="note", read_only=True)

    class Meta:
        model = CustomerFollowUp
        fields = [
            "id",
            "customer",
            "customer_name",
            "salesperson_name",
            "note",
            "notes",
            "date",
            "time",
            "purpose",
            "status",
            "followup_date",
            "is_completed",
            "created_at",
            "completed_at",
        ]
        read_only_fields = [
            "id",
            "customer_name",
            "salesperson_name",
            "date",
            "time",
            "purpose",
            "status",
            "created_at",
            "completed_at",
        ]

    def get_date(self, obj):
        if not obj.followup_date:
            return ""
        if isinstance(obj.followup_date, str):
            return obj.followup_date
        return obj.followup_date.strftime("%d %b %Y")

    def get_time(self, obj):
        note = obj.note or ""
        marker = "| Time:"
        return note.split(marker, 1)[1].strip() if marker in note else ""

    def get_purpose(self, obj):
        return obj.note or "Follow-up"

    def get_status(self, obj):
        return "completed" if obj.is_completed else "scheduled"


class CustomerPaymentSerializer(serializers.ModelSerializer):
    """Serializes Tally voucher statuses into mobile CustomerPayment shape."""
    invoiceNumber = serializers.SerializerMethodField()
    amount = serializers.SerializerMethodField()
    dueDate = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    isDateCrossed = serializers.BooleanField(source="is_credit_period_crossed", read_only=True)
    ticketStatus = serializers.SerializerMethodField()
    ticketRaisedAt = serializers.SerializerMethodField()
    emailSent = serializers.SerializerMethodField()
    emailRecipient = serializers.SerializerMethodField()
    expectedDate = serializers.SerializerMethodField()

    class Meta:
        model = CustomerVoucherStatus
        fields = [
            "id",
            "invoiceNumber",
            "amount",
            "dueDate",
            "status",
            "isDateCrossed",
            "ticketStatus",
            "ticketRaisedAt",
            "emailSent",
            "emailRecipient",
            "expectedDate",
        ]

    def get_invoiceNumber(self, obj):
        return obj.voucher.voucher_number if obj.voucher else f"INV-{obj.id}"

    def get_amount(self, obj):
        amt = abs(obj.voucher_amount or 0)
        return f"₹{int(amt):,}"

    def get_dueDate(self, obj):
        if not obj.voucher_date:
            return ""
        if isinstance(obj.voucher_date, str):
            return obj.voucher_date
        return obj.voucher_date.strftime("%d %b %Y")

    def get_status(self, obj):
        if obj.is_credit_period_crossed:
            return "overdue"
        if obj.is_unpaid or obj.is_partially_paid:
            return "pending"
        return "paid"

    def get_ticketStatus(self, obj):
        try:
            return obj.payment_thread.ticket_status
        except Exception:
            return "NONE"

    def get_ticketRaisedAt(self, obj):
        try:
            thread = obj.payment_thread
            if thread.raised_at:
                return thread.raised_at.strftime("%d %b %Y, %I:%M %p")
        except Exception:
            pass
        return ""

    def get_emailSent(self, obj):
        # Email delivery is returned by the action API; it is not persisted in
        # the current payment-thread schema, so ticket state must not imply email.
        return False

    def get_emailRecipient(self, obj):
        return obj.customer.email or ""

    def get_expectedDate(self, obj):
        try:
            expected = obj.payment_thread.expected_date_history.first()
            return expected.expected_date.strftime("%d %b %Y") if expected else ""
        except Exception:
            return ""


class CustomerListSerializer(serializers.ModelSerializer):
    """
    Compact customer list item matching both React Native Customer interface
    and standard REST CRM consumers.
    """
    contactPerson = serializers.SerializerMethodField()
    city = serializers.SerializerMethodField()
    assignedSalesperson = serializers.SerializerMethodField()
    unitId = serializers.SerializerMethodField()
    unitName = serializers.SerializerMethodField()
    totalOrders = serializers.SerializerMethodField()
    totalOrderValue = serializers.SerializerMethodField()
    lastOrderDate = serializers.SerializerMethodField()
    customerSince = serializers.SerializerMethodField()
    creditPeriod = serializers.SerializerMethodField()
    outstandingPayment = serializers.SerializerMethodField()
    outstandingPaymentNum = serializers.SerializerMethodField()
    paymentStatus = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    portfolioStatus = serializers.SerializerMethodField()
    lastContactTime = serializers.SerializerMethodField()
    nextFollowUp = serializers.SerializerMethodField()
    followups_due = serializers.SerializerMethodField()
    remarks_count = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            "id",
            "name",
            "contactPerson",
            "phone",
            "email",
            "city",
            "state",
            "district",
            "address",
            "pincode",
            "latitude",
            "longitude",
            "assignedSalesperson",
            "unitId",
            "unitName",
            "totalOrders",
            "totalOrderValue",
            "lastOrderDate",
            "customerSince",
            "creditPeriod",
            "outstandingPayment",
            "outstandingPaymentNum",
            "paymentStatus",
            "status",
            "portfolioStatus",
            "lastContactTime",
            "nextFollowUp",
            "followups_due",
            "remarks_count",
            "created_at",
            "updated_at",
        ]

    def get_contactPerson(self, obj):
        # The Customer model has no contact-person column; don't fabricate one
        # from the company name.
        return ""

    def get_city(self, obj):
        return obj.district or obj.state or "Office"

    def get_assignedSalesperson(self, obj):
        return obj.salesperson.name if obj.salesperson else "Unassigned"

    def get_unitId(self, obj):
        membership = getattr(obj, "unit_membership", None)
        return membership.unit_id if membership else None

    def get_unitName(self, obj):
        membership = getattr(obj, "unit_membership", None)
        return membership.unit.name if membership else ""

    def get_totalOrders(self, obj):
        val = getattr(obj, "portfolio_total_orders", None)
        if val is not None:
            return int(val or 0)
        return 0

    def get_totalOrderValue(self, obj):
        val = getattr(obj, "portfolio_total_order_value", None)
        if val is not None:
            return str(val or 0)
        return "0"

    def get_lastOrderDate(self, obj):
        val = getattr(obj, "portfolio_last_order_date", None)
        if val:
            if hasattr(val, "strftime"):
                return val.strftime("%d %b %Y")
            return str(val)
        return ""







    def get_customerSince(self, obj):
        return obj.created_at.strftime("%b %Y") if obj.created_at else ""

    def get_creditPeriod(self, obj):
        try:
            return f"{obj.credit_profile.credit_period_days} Days"
        except Exception:
            return ""

    def get_outstandingPayment(self, obj):
        num = self.get_outstandingPaymentNum(obj)
        if num < 0:
            return f"-₹{int(abs(num)):,}"
        return f"₹{int(num):,}"

    def get_outstandingPaymentNum(self, obj):
        try:
            return float(obj.credit_profile.outstanding_balance or 0)
        except Exception:
            return 0.0

    def get_paymentStatus(self, obj):
        if hasattr(obj, "api_has_overdue"):
            if obj.api_has_overdue:
                return "overdue"
            return "pending" if self.get_outstandingPaymentNum(obj) > 0 else "paid"
        prefetched = getattr(obj, "api_voucher_statuses", None)
        if prefetched is not None:
            if any(item.is_credit_period_crossed for item in prefetched):
                return "overdue"
            return "pending" if self.get_outstandingPaymentNum(obj) > 0 else "paid"
        try:
            has_overdue = obj.voucher_statuses.filter(is_credit_period_crossed=True).exists()
            if has_overdue:
                return "overdue"
        except Exception:
            pass
        bal = self.get_outstandingPaymentNum(obj)
        if bal > 0:
            return "pending"
        return "paid"

    def get_status(self, obj):
        bal = self.get_outstandingPaymentNum(obj)
        if bal > 500000:
            return "VIP"
        if hasattr(obj, "api_has_recent_voucher"):
            return "Active" if obj.api_has_recent_voucher else "Inactive"
        prefetched = getattr(obj, "api_voucher_statuses", None)
        if prefetched is not None:
            cutoff = timezone.now().date() - timezone.timedelta(days=90)
            return "Active" if any(item.voucher_date and item.voucher_date >= cutoff for item in prefetched) else "Inactive"
        try:
            cutoff = timezone.now().date() - timezone.timedelta(days=90)
            has_recent = obj.voucher_statuses.filter(voucher_date__gte=cutoff).exists()
            return "Active" if has_recent else "Inactive"
        except Exception:
            return "Active"

    def get_portfolioStatus(self, obj):
        # The website's unit table marks a ledger active when it has a tax
        # invoice in the last 90 days; keep that separate from the VIP label.
        if hasattr(obj, "api_has_recent_tax_invoice"):
            return "Active" if obj.api_has_recent_tax_invoice else "Inactive"
        statuses = getattr(obj, "api_voucher_statuses", None)
        if statuses is not None:
            cutoff = timezone.now().date() - timezone.timedelta(days=90)
            return "Active" if any(
                item.voucher_type and item.voucher_type.lower() == "tax invoice"
                and item.voucher_date and item.voucher_date >= cutoff
                for item in statuses
            ) else "Inactive"
        cutoff = timezone.now().date() - timezone.timedelta(days=90)
        has_recent = obj.voucher_statuses.filter(
            voucher_type__iexact="TAX INVOICE", voucher_date__gte=cutoff
        ).exists()
        return "Active" if has_recent else "Inactive"

    def get_lastContactTime(self, obj):
        if hasattr(obj, "api_last_remark_at"):
            created_at = obj.api_last_remark_at
            if not created_at:
                return ""
            delta = timezone.now() - created_at
            if delta.days == 0:
                return "Today"
            if delta.days == 1:
                return "Yesterday"
            if delta.days < 7:
                return f"{delta.days}d ago"
            return created_at.strftime("%d %b")
        prefetched = getattr(obj, "api_recent_remarks", None)
        if prefetched is not None:
            remark = prefetched[0] if prefetched else None
        else:
            remark = obj.remarks.order_by("-created_at").first()
        if remark and remark.created_at:
            delta = timezone.now() - remark.created_at
            if delta.days == 0:
                return "Today"
            elif delta.days == 1:
                return "Yesterday"
            elif delta.days < 7:
                return f"{delta.days}d ago"
            return remark.created_at.strftime("%d %b")
        return ""

    def get_nextFollowUp(self, obj):
        today = timezone.now().date()
        if hasattr(obj, "api_next_followup_date"):
            return obj.api_next_followup_date.strftime("%d %b") if obj.api_next_followup_date else ""
        prefetched = getattr(obj, "api_followups", None)
        if prefetched is not None:
            fu = next((item for item in prefetched if not item.is_completed and item.followup_date and item.followup_date >= today), None)
            return fu.followup_date.strftime("%d %b") if fu else ""
        fu = obj.followups.filter(is_completed=False, followup_date__gte=today).order_by("followup_date").first()
        if fu and fu.followup_date:
            return fu.followup_date.strftime("%d %b")
        return ""

    def get_followups_due(self, obj):
        today = timezone.now().date()
        if hasattr(obj, "api_followups_due"):
            return obj.api_followups_due
        prefetched = getattr(obj, "api_followups", None)
        if prefetched is not None:
            return sum(1 for item in prefetched if not item.is_completed and item.followup_date and item.followup_date <= today)
        return obj.followups.filter(
            followup_date__lte=today,
            is_completed=False,
        ).count()

    def get_remarks_count(self, obj):
        count = getattr(obj, "api_remarks_count", None)
        if count is not None:
            return int(count or 0)
        return obj.remarks.count()


class CustomerDetailSerializer(CustomerListSerializer):
    """Full customer detail with nested remarks, followups, and real Tally voucher payments."""
    remarks = serializers.SerializerMethodField()
    followUps = serializers.SerializerMethodField()
    payments = serializers.SerializerMethodField()
    purchases = serializers.SerializerMethodField()

    class Meta(CustomerListSerializer.Meta):
        fields = CustomerListSerializer.Meta.fields + [
            "remarks",
            "followUps",
            "payments",
            "purchases",
        ]

    def get_remarks(self, obj):
        recent = obj.remarks.order_by("-created_at")[:30]
        return CustomerRemarkSerializer(recent, many=True).data

    def get_followUps(self, obj):
        recent = obj.followups.order_by("-followup_date")[:20]
        return CustomerFollowUpSerializer(recent, many=True).data

    def get_payments(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not (
            user.is_superuser or user.is_staff or getattr(user, "is_accountant", False)
            or user.groups.filter(name="Admin").exists() or can(user, "payment.view")
        ):
            return []
        vouchers = obj.voucher_statuses.select_related("voucher").order_by("-voucher_date")[:30]
        return CustomerPaymentSerializer(vouchers, many=True).data

    def get_purchases(self, obj):
        """Return the same invoice-item purchase summary shown on the website."""
        from tally_voucher.models import VoucherStockItem

        stock_items = VoucherStockItem.objects.filter(
            voucher__party_name__iexact=obj.name,
            voucher__voucher_type__iexact="TAX INVOICE",
        ).select_related("voucher", "item").order_by("voucher__date")

        grouped = {}
        for stock_item in stock_items:
            product_name = (stock_item.item.name if stock_item.item else "") or stock_item.item_name_text or "Unknown item"
            row = grouped.setdefault(product_name, {
                "product": product_name,
                "quantity": 0,
                "amount": 0,
                "entries": [],
            })
            quantity = stock_item.quantity or 0
            amount = stock_item.amount or 0
            row["quantity"] += quantity
            row["amount"] += amount
            row["entries"].append({
                "date": stock_item.voucher.date.isoformat() if stock_item.voucher.date else "",
                "quantity": str(quantity),
            })
        ordered = sorted(grouped.values(), key=lambda row: row["quantity"], reverse=True)
        return [{**row, "quantity": str(row["quantity"]), "amount": str(row["amount"])} for row in ordered]
