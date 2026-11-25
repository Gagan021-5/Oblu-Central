"""
Serializers for the Call Tracer API.
"""

from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import CallLog, CallStats, CallTrackingProfile

User = get_user_model()


def get_role(user):
    """Calculates user role dynamically based on group, attributes, or organizational flowchart."""
    # Check user groups first
    group = user.groups.first()
    if group and group.name:
        return group.name

    uname = user.username.lower()
    if uname in ["nitin_aggarwal", "akshay_narayan", "admin1", "infected"] or user.is_superuser:
        return "admin"
    if uname in ["bhavya_bhardwaj"]:
        return "sales_mgr"
    if uname in ["vibhuti_panwar"]:
        return "buss_mgr"
    if uname in ["vanshika", "anshika"]:
        return "hr"
    if uname in ["sujal_wadhwa", "neha_sharma", "sanyam_arora"] or getattr(user, "is_accountant", False):
        return "accounts_ops"
    if uname in ["vikas", "vivek"]:
        return "warehouse"
    if uname in ["ankush_oblu"]:
        return "rsm_ankush"
    if uname in ["aman_poddar"]:
        return "rsm_aman"
    if uname in ["kaushik_tiwari", "dhornala_rushikesh", "naveen_k", "satish_kumar"]:
        return "asm"
    if user.is_staff:
        return "admin"
    return "user"


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User details with aggregate call count and latest call time."""

    role = serializers.SerializerMethodField()
    device_id = serializers.SerializerMethodField()
    device_model = serializers.SerializerMethodField()
    app_version = serializers.SerializerMethodField()
    consent_given = serializers.SerializerMethodField()
    total_call_logs = serializers.IntegerField(read_only=True, default=0)
    last_call_timestamp = serializers.DateTimeField(read_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "role",
            "device_id",
            "device_model",
            "app_version",
            "consent_given",
            "date_joined",
            "last_login",
            "total_call_logs",
            "last_call_timestamp",
        ]
        read_only_fields = ["id", "date_joined", "last_login", "last_call_timestamp"]

    def get_role(self, obj):
        return get_role(obj)

    def _get_profile(self, obj):
        if not hasattr(obj, "_cached_call_profile"):
            try:
                obj._cached_call_profile = obj.call_tracking_profile
            except Exception:
                obj._cached_call_profile = None
        return obj._cached_call_profile

    def get_device_id(self, obj):
        p = self._get_profile(obj)
        return p.device_id if p else ""

    def get_device_model(self, obj):
        p = self._get_profile(obj)
        return p.device_model if p else ""

    def get_app_version(self, obj):
        p = self._get_profile(obj)
        return p.app_version if p else ""

    def get_consent_given(self, obj):
        p = self._get_profile(obj)
        return p.consent_given if p else False



class AdminProfileUpdateSerializer(serializers.Serializer):
    """Allows an admin to update their username, email, and password."""

    username = serializers.CharField(required=False, max_length=150)
    email = serializers.EmailField(required=False)
    password = serializers.CharField(required=False, min_length=8, write_only=True)
    password_confirm = serializers.CharField(required=False, min_length=8, write_only=True)

    def validate(self, attrs):
        if "password" in attrs and attrs["password"]:
            if attrs.get("password") != attrs.get("password_confirm"):
                raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return attrs


class CallLogItemSerializer(serializers.Serializer):
    """Validates individual call log entries inside a sync batch."""

    phone_number = serializers.CharField(max_length=20)
    call_type = serializers.ChoiceField(choices=CallLog.CALL_TYPE_CHOICES)
    duration = serializers.IntegerField(min_value=0)
    timestamp = serializers.DateTimeField()


class CallLogSyncSerializer(serializers.Serializer):
    """Validates a batch of call logs submitted for synchronization."""

    call_logs = serializers.ListField(
        child=CallLogItemSerializer(),
        allow_empty=False,
        max_length=500,
    )


class CallLogSerializer(serializers.ModelSerializer):
    """Full CallLog model serializer for admin list/detail views."""

    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = CallLog
        fields = [
            "id",
            "user",
            "username",
            "phone_number",
            "call_type",
            "duration",
            "timestamp",
            "synced_at",
        ]
        read_only_fields = ["id", "synced_at"]


class CallStatsSerializer(serializers.ModelSerializer):
    """CallStats model serializer for aggregated analytics."""

    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = CallStats
        fields = [
            "id",
            "user",
            "username",
            "date",
            "total_calls",
            "total_duration",
            "calls_by_type",
            "top_numbers",
        ]
