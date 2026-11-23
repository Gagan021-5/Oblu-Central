"""
Customer Dashboard — REST API URL routing for the employee mobile app.
Mounted at /api/customers/ and /api/dashboard/
"""

from django.urls import path
from .api_views import (
    CustomerListView,
    CustomerMapPointsView,
    CustomerDetailView,
    CustomerMobileEditView,
    CustomerRemarkCreateView,
    CustomerFollowUpListCreateView,
    CustomerPaymentTicketActionView,
    DashboardStatsView,
    CustomerChartsView,
    CustomerStateDistrictsView,
    CustomerWorkspaceToolsView,
    CustomerFilterOptionsView,
    CustomerExportExcelView,
)

urlpatterns = [
    path("", CustomerListView.as_view(), name="employee-customer-list"),
    path("filter-options/", CustomerFilterOptionsView.as_view(), name="employee-customer-filter-options"),
    path("export/", CustomerExportExcelView.as_view(), name="employee-customer-export-excel"),
    path("map/", CustomerMapPointsView.as_view(), name="employee-customer-map-points"),
    path("charts/", CustomerChartsView.as_view(), name="employee-customer-charts"),
    path("state-districts/", CustomerStateDistrictsView.as_view(), name="employee-customer-state-districts"),
    path("workspace/<str:tool>/", CustomerWorkspaceToolsView.as_view(), name="employee-customer-workspace-tool"),
    path("<int:pk>/", CustomerDetailView.as_view(), name="employee-customer-detail"),
    path("<int:pk>/edit/", CustomerMobileEditView.as_view(), name="employee-customer-edit"),
    path("<int:pk>/remarks/", CustomerRemarkCreateView.as_view(), name="employee-customer-remarks"),
    path("<int:pk>/followups/", CustomerFollowUpListCreateView.as_view(), name="employee-customer-followups"),
    path("<int:pk>/payment-ticket/", CustomerPaymentTicketActionView.as_view(), name="employee-customer-ticket"),
]
