"""
URL routing for the Call Tracking API.
"""

from django.urls import path

from .views import (
    AdminCallLogView,
    AdminProfileView,
    AdminStatsView,
    AdminUserListView,
    CallLogSyncView,
    ConsentView,
)

urlpatterns = [
    path(
        "consent/",
        ConsentView.as_view(),
        name="user-consent",
    ),
    path(
        "call-logs/sync/",
        CallLogSyncView.as_view(),
        name="call-logs-sync",
    ),
    path(
        "admin/profile/",
        AdminProfileView.as_view(),
        name="admin-profile",
    ),
    path(
        "admin/users/",
        AdminUserListView.as_view(),
        name="admin-users",
    ),
    path(
        "admin/call-logs/",
        AdminCallLogView.as_view(),
        name="admin-call-logs",
    ),
    path(
        "admin/stats/",
        AdminStatsView.as_view(),
        name="admin-stats",
    ),
    path(
        "admin/stats/<int:user_id>/",
        AdminStatsView.as_view(),
        name="user-admin-stats",
    ),
]
