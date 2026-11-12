"""
HRMS REST API views for the employee & HR mobile application.
Provides live access to workforce stats, pending leaves with approvals,
employee directory, and real-time attendance punching.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q

from .models import (
    Employee,
    Department,
    Designation,
    LeaveApplication,
    LeaveType,
    AttendanceRecord,
    CompanyNotice,
)


class HRMSDashboardAPIView(APIView):
    """
    GET /api/hrms/dashboard/
    Returns live workforce overview, attendance telemetry, and pending leaves queue.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        employees = Employee.objects.filter(status=Employee.Status.ACTIVE)
        total_employees = employees.count()

        # Today attendance
        today_records = AttendanceRecord.objects.filter(attendance_date=today).select_related(
            "employee__department"
        )
        present_count = today_records.count()
        absent_count = max(0, total_employees - present_count)

        # Pending Leaves
        pending_leaves_qs = LeaveApplication.objects.filter(
            status=LeaveApplication.Status.PENDING
        ).select_related("employee__department", "leave_type").order_by("start_date")
        pending_leaves_count = pending_leaves_qs.count()

        pending_leaves_data = []
        for l in pending_leaves_qs[:10]:
            pending_leaves_data.append({
                "id": l.id,
                "employee_id": l.employee.id,
                "employee_name": l.employee.full_name,
                "employee_code": l.employee.employee_code,
                "department": l.employee.department.name if l.employee.department else "General",
                "leave_type": l.leave_type.name if l.leave_type else "Leave",
                "start_date": l.start_date.strftime("%d %b %Y"),
                "end_date": l.end_date.strftime("%d %b %Y"),
                "total_days": l.total_days or 1,
                "reason": l.reason or "Personal leave",
                "status": l.status,
                "applied_on": l.applied_on.strftime("%d %b") if l.applied_on else "",
            })

        # Recent attendance feed
        recent_attendance_data = []
        for a in today_records.order_by("-check_in")[:10]:
            recent_attendance_data.append({
                "id": a.id,
                "employee_name": a.employee.full_name,
                "employee_code": a.employee.employee_code,
                "department": a.employee.department.name if a.employee.department else "General",
                "check_in": a.check_in.strftime("%I:%M %p") if a.check_in else "Checked In",
                "status": a.status or "present",
                "mode": "Office" if a.punch_source != "mobile" else "Remote Field",
            })

        # Department breakdown
        depts_data = []
        for d in Department.objects.annotate(emp_count=Count("employees", filter=Q(employees__status="active"))):
            depts_data.append({
                "id": d.id,
                "name": d.name,
                "count": d.emp_count,
            })

        # Current user's punch status today
        current_emp = getattr(request.user, "employee_profile", None)
        user_punch_status = {
            "has_punched_in": False,
            "has_punched_out": False,
            "punch_in_time": None,
            "punch_out_time": None,
        }
        if current_emp:
            user_today_att = AttendanceRecord.objects.filter(employee=current_emp, attendance_date=today).first()
            if user_today_att:
                user_punch_status["has_punched_in"] = bool(user_today_att.check_in)
                user_punch_status["has_punched_out"] = bool(user_today_att.check_out)
                user_punch_status["punch_in_time"] = user_today_att.check_in.strftime("%I:%M %p") if user_today_att.check_in else None
                user_punch_status["punch_out_time"] = user_today_att.check_out.strftime("%I:%M %p") if user_today_att.check_out else None

        return Response({
            "stats": {
                "total_employees": total_employees,
                "present_today": present_count,
                "absent_today": absent_count,
                "pending_leaves": pending_leaves_count,
                "total_departments": len(depts_data),
            },
            "user_punch": user_punch_status,
            "pending_leaves": pending_leaves_data,
            "recent_attendance": recent_attendance_data,
            "departments": depts_data,
        })


class HRMSEmployeeListAPIView(APIView):
    """
    GET /api/hrms/employees/?search=&department=
    Returns real employee directory for mobile staff lookup.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Employee.objects.filter(status=Employee.Status.ACTIVE).select_related(
            "department", "designation"
        ).order_by("first_name", "last_name")

        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(employee_code__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
                | Q(department__name__icontains=search)
            )

        dept_id = request.query_params.get("department")
        if dept_id:
            qs = qs.filter(department_id=dept_id)

        data = []
        for e in qs:
            data.append({
                "id": e.id,
                "employee_code": e.employee_code,
                "name": e.full_name,
                "department": e.department.name if e.department else "General",
                "designation": e.designation.title if e.designation else "Staff",
                "email": e.email or "",
                "phone": e.phone or "",
                "status": e.status,
                "date_of_joining": e.date_of_joining.strftime("%d %b %Y") if e.date_of_joining else "",
            })

        return Response(data)


class HRMSSelfProfileAPIView(APIView):
    """Return only the authenticated account's linked HR employee record."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = getattr(request.user, "employee_profile", None)
        if not employee and getattr(request.user, "email", None):
            employee = Employee.objects.filter(
                email__iexact=request.user.email.strip()
            ).first()
        if not employee:
            return Response({"employee": None})

        employee = Employee.objects.select_related(
            "department", "designation", "company"
        ).get(pk=employee.pk)
        return Response({
            "employee": {
                "id": employee.pk,
                "employee_code": employee.employee_code,
                "name": employee.full_name,
                "gender": employee.gender or "",
                "department": employee.department.name if employee.department else "",
                "designation": employee.designation.title if employee.designation else "",
                "email": employee.email or "",
                "company": employee.company.name if employee.company else "",
                "status": employee.status,
                "date_of_joining": employee.date_of_joining.isoformat() if employee.date_of_joining else None,
            }
        })


class HRMSLeaveActionAPIView(APIView):
    """
    POST /api/hrms/leaves/<int:pk>/action/
    Payload: {"action": "approve" | "reject", "reason": "optional"}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        leave = get_object_or_404(LeaveApplication, pk=pk)
        action = request.data.get("action", "").lower().strip()
        if action not in ["approve", "reject"]:
            return Response(
                {"error": "Valid action is 'approve' or 'reject'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if action == "approve":
            leave.status = LeaveApplication.Status.APPROVED
            leave.approved_by = request.user
            leave.approved_on = timezone.now()
        else:
            leave.status = LeaveApplication.Status.REJECTED
            leave.rejection_reason = request.data.get("reason", "Rejected by HR")

        leave.save(update_fields=["status", "approved_by", "approved_on", "rejection_reason", "updated_at"])

        return Response({
            "success": True,
            "id": leave.id,
            "status": leave.status,
            "message": f"Leave application #{leave.id} has been {leave.status}.",
        })


class HRMSAttendancePunchAPIView(APIView):
    """
    POST /api/hrms/punch/
    Payload: {"action": "punch_in" | "punch_out", "mode": "mobile"}
    Records attendance punch in / punch out.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response(
                {"error": "No Employee profile linked to this account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = timezone.localdate()
        att, created = AttendanceRecord.objects.get_or_create(
            employee=emp,
            attendance_date=today,
            defaults={
                "status": "present",
                "punch_source": "mobile",
            }
        )

        now = timezone.now()
        action_performed = "punch_in"

        if not att.check_in:
            att.check_in = now
            att.status = "present"
            att.save(update_fields=["check_in", "status", "updated_at"])
            action_performed = "punch_in"
            msg = f"Good day {emp.first_name}! Punched IN at {now.strftime('%I:%M %p')}."
        elif not att.check_out:
            att.check_out = now
            # Compute total hours
            delta = att.check_out - att.check_in
            att.total_hours = round(delta.total_seconds() / 3600, 2)
            att.save(update_fields=["check_out", "total_hours", "updated_at"])
            action_performed = "punch_out"
            msg = f"Punched OUT at {now.strftime('%I:%M %p')}. Total shift: {att.total_hours} hrs."
        else:
            # Already punched in and out
            msg = f"You have already completed your shift today (Checked in: {att.check_in.strftime('%I:%M %p')}, Out: {att.check_out.strftime('%I:%M %p')})."

        return Response({
            "success": True,
            "action": action_performed,
            "message": msg,
            "check_in": att.check_in.strftime("%I:%M %p") if att.check_in else None,
            "check_out": att.check_out.strftime("%I:%M %p") if att.check_out else None,
        })
