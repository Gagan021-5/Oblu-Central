"""
Views for the Call Tracer API.

Consent:
- ConsentView: sets consent_given=True for authenticated employee

Call Log Operations:
- CallLogSyncView: bulk deduplicated sync with ignore_conflicts

Admin Operations (IsAdminRole):
- AdminProfileView: returns admin's own profile
- AdminUserListView: list team employees
- AdminCallLogView: filtered call logs for employees
- AdminStatsView: daily & aggregate stats
"""

from collections import Counter
from datetime import datetime, timedelta
from django.contrib.auth import get_user_model
from django.db.models import Count, Sum, Max, Q
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CallLog, CallStats, CallTrackingProfile, normalize_phone
from .permissions import CanAccessCallTracking, IsAdminRole
from access_control.roles import is_admin, get_subordinate_salesperson_ids
from access_control.hierarchy import get_downline_user_ids
from access_control.services import get_user_effective_permissions
from .serializers import (
    CallLogSerializer,
    CallLogSyncSerializer,
    CallStatsSerializer,
    UserSerializer,
    AdminProfileUpdateSerializer,
    get_role,
)

User = get_user_model()


# ── Standard Pagination ──────────────────────────────────────────────────

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


# ── Consent & Sync Views ─────────────────────────────────────────────────

class ConsentView(APIView):
    """
    POST /api/consent/
    Mark the authenticated employee as having accepted the monitoring disclosure.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        profile, _ = CallTrackingProfile.objects.get_or_create(user=user)
        profile.consent_given = True
        profile.save(update_fields=["consent_given"])
        return Response(
            {
                "message": "Consent recorded successfully.",
                "consent_given": True,
            },
            status=status.HTTP_200_OK,
        )



# ── Call Log Sync (Employee) ─────────────────────────────────────────────

class CallLogSyncView(APIView):
    """
    POST /api/call-logs/sync/
    Receives a batch of call logs from an employee device.
    Uses bulk_create with ignore_conflicts=True for deduplication.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CallLogSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        call_logs_data = serializer.validated_data["call_logs"]
        user = request.user

        # Build CallLog instances
        instances = [
            CallLog(
                user=user,
                phone_number=entry["phone_number"],
                call_type=entry["call_type"],
                duration=entry["duration"],
                timestamp=entry["timestamp"],
            )
            for entry in call_logs_data
        ]

        # Bulk insert with conflict ignore based on unique (user, phone_number, timestamp)
        created = CallLog.objects.bulk_create(instances, ignore_conflicts=True)
        synced_count = len(created)
        skipped_count = len(instances) - synced_count

        return Response(
            {
                "message": "Sync completed successfully.",
                "synced": synced_count,
                "skipped_duplicates": skipped_count,
                "total_received": len(instances),
            },
            status=status.HTTP_200_OK,
        )


class CallRecordingUploadView(APIView):
    """
    POST /api/call-logs/upload-recording/
    Accepts multipart audio file from employee device and attaches it to the matching CallLog.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        audio_file = request.FILES.get("file")
        if not audio_file:
            return Response(
                {"error": "No audio file provided under 'file'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        call_log_id = request.data.get("call_log_id")
        phone_number = (request.data.get("phone_number") or "").strip()
        raw_ts = request.data.get("timestamp")
        call_type = (request.data.get("call_type") or "outgoing").lower()
        if call_type not in ("incoming", "outgoing", "missed"):
            call_type = "outgoing"
        try:
            duration = max(0, int(request.data.get("duration") or 0))
        except (TypeError, ValueError):
            duration = 0

        target_dt = None
        if raw_ts:
            target_dt = parse_datetime(str(raw_ts))
            if target_dt is None:
                try:
                    ms = float(raw_ts)
                    if ms > 1e11:
                        ms = ms / 1000.0
                    target_dt = datetime.fromtimestamp(ms, tz=timezone.get_current_timezone())
                except (TypeError, ValueError):
                    target_dt = None
        if target_dt is None:
            target_dt = timezone.now()
        elif timezone.is_naive(target_dt):
            target_dt = timezone.make_aware(target_dt, timezone.get_current_timezone())

        call_log = None
        if call_log_id:
            call_log = CallLog.objects.filter(id=call_log_id, user=user).first()

        if call_log is None:
            window_start = target_dt - timedelta(minutes=5)
            window_end = target_dt + timedelta(minutes=5)
            qs = CallLog.objects.filter(
                user=user,
                timestamp__gte=window_start,
                timestamp__lte=window_end,
            )
            if phone_number:
                norm = normalize_phone(phone_number)
                matched = qs.filter(
                    Q(normalized_phone=norm) | Q(phone_number=phone_number)
                ).order_by("-timestamp").first()
                call_log = matched
            if call_log is None:
                call_log = qs.filter(duration__gt=0).order_by("-timestamp").first()

        if call_log is None:
            if not phone_number:
                phone_number = "Recorded Call"
            call_log = CallLog.objects.create(
                user=user,
                phone_number=phone_number,
                call_type=call_type,
                duration=duration,
                timestamp=target_dt,
            )

        call_log.audio_file = audio_file
        call_log.recording_filename = audio_file.name or "recording.m4a"
        call_log.save(update_fields=["audio_file", "recording_filename"])

        audio_url = request.build_absolute_uri(call_log.audio_file.url)
        return Response(
            {
                "status": "uploaded",
                "call_log_id": call_log.id,
                "audio_url": audio_url,
                "recording_filename": call_log.recording_filename,
            },
            status=status.HTTP_200_OK,
        )


def _get_visible_call_users(user):
    """
    Hierarchy-based user visibility for call tracking:
    - Admins / org-wide call_logs.view -> all non-staff/non-superuser employees
    - Managers (HRMS downline or SalesPerson downline) -> self + downline user IDs
    - Individual -> self only
    """
    effective = get_user_effective_permissions(user)
    if (
        is_admin(user)
        or "*" in effective
        or "all" in effective.get("call_logs.view", set())
    ):
        return User.objects.filter(is_staff=False, is_superuser=False)

    visible_ids = {user.id}
    downline_ids = get_downline_user_ids(user) or []
    visible_ids.update(downline_ids)

    sub_sp_ids = get_subordinate_salesperson_ids(user) or []
    if sub_sp_ids:
        from customer_dashboard.models import SalesPerson
        sp_uids = SalesPerson.objects.filter(
            id__in=sub_sp_ids, user_id__isnull=False
        ).values_list("user_id", flat=True)
        visible_ids.update(sp_uids)

    return User.objects.filter(id__in=list(visible_ids))


class CallRecordingStreamView(APIView):
    """
    GET /api/call-logs/<int:pk>/audio/
    Streams the uploaded call recording audio file directly (works even with DEBUG=False).
    """

    permission_classes = [CanAccessCallTracking]

    def get(self, request, pk):
        call_log = get_object_or_404(CallLog, pk=pk)
        visible_users = _get_visible_call_users(request.user)
        if call_log.user_id != request.user.id and not visible_users.filter(id=call_log.user_id).exists():
            raise PermissionDenied("You do not have permission to access this recording.")
        if not call_log.audio_file:
            raise Http404("No recording attached to this call.")
        try:
            f = call_log.audio_file.open("rb")
        except Exception:
            raise Http404("Recording file not found on storage.")
        name = (call_log.recording_filename or "recording.m4a").lower()
        content_type = "audio/mpeg" if name.endswith(".mp3") else "audio/mp4"
        resp = FileResponse(f, content_type=content_type)
        resp["Accept-Ranges"] = "bytes"
        return resp


# ── Admin Dashboard Views ────────────────────────────────────────────────

class AdminProfileView(APIView):
    """
    GET /api/admin/profile/ -> returns admin profile & stats.
    PATCH /api/admin/profile/ -> updates admin username, email, and password.
    """

    permission_classes = [IsAdminRole]

    def get(self, request):
        admin = request.user
        total_employees = User.objects.filter(is_staff=False, is_superuser=False).count()
        return Response(
            {
                "id": admin.id,
                "username": admin.username,
                "email": admin.email,
                "role": get_role(admin),
                "total_employees": total_employees,
            },
            status=status.HTTP_200_OK,
        )

    def patch(self, request):
        admin = request.user
        serializer = AdminProfileUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        if "username" in data and data["username"]:
            new_username = data["username"].strip()
            if User.objects.filter(username=new_username).exclude(id=admin.id).exists():
                return Response(
                    {"username": "This username is already taken."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            admin.username = new_username

        if "email" in data and data["email"]:
            admin.email = data["email"].strip()

        if "password" in data and data["password"]:
            admin.set_password(data["password"])

        admin.save()

        total_employees = User.objects.filter(is_staff=False, is_superuser=False).count()
        return Response(
            {
                "message": "Admin profile updated successfully.",
                "id": admin.id,
                "username": admin.username,
                "email": admin.email,
                "role": get_role(admin),
                "total_employees": total_employees,
            },
            status=status.HTTP_200_OK,
        )


class AdminUserListView(generics.ListAPIView):
    """
    GET /api/admin/users/
    Lists employees visible to the authenticated user based on RBAC & hierarchy.
    """

    serializer_class = UserSerializer
    permission_classes = [CanAccessCallTracking]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        return (
            _get_visible_call_users(self.request.user)
            .annotate(
                total_call_logs=Count("call_logs"),
                last_call_timestamp=Max("call_logs__timestamp"),
            )
            .order_by("-date_joined")
        )


class AdminCallLogView(generics.ListAPIView):
    """
    GET /api/admin/call-logs/?user_id=&start_date=&end_date=
    Lists synced call logs scoped by RBAC & organizational hierarchy.
    """

    serializer_class = CallLogSerializer
    permission_classes = [CanAccessCallTracking]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        visible_users = _get_visible_call_users(self.request.user)
        queryset = CallLog.objects.filter(
            user__in=visible_users
        ).select_related("user")

        user_id = self.request.query_params.get("user_id")
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        search = self.request.query_params.get("search") or self.request.query_params.get("q")
        if search:
            search = search.strip()
            queryset = queryset.filter(
                Q(phone_number__icontains=search)
                | Q(normalized_phone__icontains=search)
                | Q(user__username__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(customer__company_name__icontains=search)
            )

        call_type = self.request.query_params.get("call_type")
        if call_type in ["incoming", "outgoing", "missed"]:
            queryset = queryset.filter(call_type=call_type)

        start_date = self.request.query_params.get("start_date")
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                queryset = queryset.filter(timestamp__gte=start_dt)
            except ValueError:
                pass

        end_date = self.request.query_params.get("end_date")
        if end_date:
            try:
                end_dt = datetime.strptime(f"{end_date} 23:59:59", "%Y-%m-%d %H:%M:%S")
                queryset = queryset.filter(timestamp__lte=end_dt)
            except ValueError:
                pass

        return queryset.order_by("-timestamp")


class AdminStatsView(APIView):
    """
    GET /api/admin/stats/ or GET /api/admin/stats/<user_id>/
    Returns real-time aggregated stats and daily trend directly from CallLog,
    scoped by RBAC & organizational hierarchy.
    """

    permission_classes = [CanAccessCallTracking]

    def get(self, request, user_id=None):
        from django.db.models.functions import TruncDate

        visible_users = _get_visible_call_users(request.user)
        user_param = user_id or request.query_params.get("user_id")

        if user_param and str(user_param) not in ["0", "all"]:
            target_user = get_object_or_404(User, id=user_param)
            if not visible_users.filter(id=target_user.id).exists():
                raise PermissionDenied("You do not have permission to view stats for this user.")
            logs = CallLog.objects.filter(user=target_user)
            username = target_user.username
            profile, _ = CallTrackingProfile.objects.get_or_create(user=target_user)
            device_id = profile.device_id
            device_model = profile.device_model
            uid = target_user.id
        else:
            # Visible team aggregated stats
            logs = CallLog.objects.filter(user__in=visible_users)
            total_emp = visible_users.count()
            username = "Entire Team"
            device_id = "All Devices"
            device_model = f"{total_emp} Employees"
            uid = 0

        total_calls = logs.count()
        total_duration = logs.aggregate(total=Sum("duration"))["total"] or 0

        # Type breakdown
        calls_by_type = {
            "incoming": logs.filter(call_type="incoming").count(),
            "outgoing": logs.filter(call_type="outgoing").count(),
            "missed": logs.filter(call_type="missed").count(),
        }

        # Top 5 contacted numbers
        phone_counts = Counter(logs.values_list("phone_number", flat=True))
        top_numbers = [
            {"phone_number": number, "count": count}
            for number, count in phone_counts.most_common(5)
        ]

        # Real-time daily trend directly from CallLog table
        daily_query = (
            logs.annotate(date=TruncDate("timestamp"))
            .values("date")
            .annotate(
                calls=Count("id"),
                duration=Sum("duration"),
            )
            .order_by("date")
        )
        daily_trend = [
            {
                "date": str(item["date"]),
                "calls": item["calls"],
                "duration": item["duration"] or 0,
            }
            for item in daily_query
        ]

        return Response(
            {
                "user_id": uid,
                "username": username,
                "device_id": device_id,
                "device_model": device_model,
                "total_calls": total_calls,
                "total_duration": total_duration,
                "calls_by_type": calls_by_type,
                "top_numbers": top_numbers,
                "daily_trend": daily_trend,
            },
            status=status.HTTP_200_OK,
        )


