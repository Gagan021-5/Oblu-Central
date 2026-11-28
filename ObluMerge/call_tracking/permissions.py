"""
Custom permissions for the Call Tracer API.
"""

from rest_framework.permissions import BasePermission
from access_control.roles import is_admin, get_subordinate_salesperson_ids
from access_control.hierarchy import get_downline_user_ids
from access_control.services import can


class IsAdminRole(BasePermission):
    """
    Allows access to RBAC admins (or users with wildcard '*' / admin role assignment).
    """

    message = "Only administrative accounts may access this resource."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and is_admin(request.user)
        )


class CanAccessCallTracking(BasePermission):
    """
    Allows access to admins, users with RBAC call_logs/security permissions,
    and managers who have downline subordinates in the org hierarchy.
    """

    message = "You do not have permission to access team call tracking."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if is_admin(user) or can(user, "call_logs.view") or can(user, "security.view"):
            return True
        if get_downline_user_ids(user) or get_subordinate_salesperson_ids(user):
            return True
        return False

