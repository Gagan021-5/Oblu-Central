"""
Inventory REST API URL routing for mobile app.
Mounted at /api/inventory/
"""

from django.urls import path
from .mobile_api_views import (
    InventoryExecutiveDashboardAPIView,
    InventoryItemListAPIView,
    InventoryItemDetailAPIView,
    InventoryItemForecastAPIView,
    InventoryItemTrendsAPIView,
    InventoryItemLedgerAPIView,
    InventoryCategoryListAPIView,
    InventoryLowStockAlertsAPIView,
    InventoryDeadStockAPIView,
    InventoryPurchaseOrdersAPIView,
    InventoryPOPlannerAPIView,
    InventoryToggleNewProductAPIView,
    InventoryPOPlannerTopCustomersAPIView,
    InventoryStartPOTrackingAPIView,
    InventoryTrackedPODetailAPIView,
    InventoryUpdateArrivedQtyAPIView,
    InventoryStageLogCreateAPIView,
    InventoryStageLogUpdateAPIView,
    InventoryStageListCreateAPIView,
    InventoryStageUpdateAPIView,
    InventorySalesAnalyticsAPIView,
    InventorySalesContributionAPIView,
    InventorySalesContributionDetailAPIView,
    InventoryCategoryAnalyticsAPIView,
    InventoryProductAnalyticsDetailAPIView,
    InventorySalesComparisonAPIView,
    InventoryReportAPIView,
)

urlpatterns = [
    path("dashboard/", InventoryExecutiveDashboardAPIView.as_view(), name="mobile-inventory-dashboard"),
    path("items/", InventoryItemListAPIView.as_view(), name="mobile-inventory-items"),
    path("items/<int:pk>/", InventoryItemDetailAPIView.as_view(), name="mobile-inventory-item-detail"),
    path("items/<int:pk>/forecast/", InventoryItemForecastAPIView.as_view(), name="mobile-inventory-item-forecast"),
    path("items/<int:pk>/trends/", InventoryItemTrendsAPIView.as_view(), name="mobile-inventory-item-trends"),
    path("items/<int:pk>/ledger/", InventoryItemLedgerAPIView.as_view(), name="mobile-inventory-item-ledger"),
    path("categories/", InventoryCategoryListAPIView.as_view(), name="mobile-inventory-categories"),
    path("alerts/low-stock/", InventoryLowStockAlertsAPIView.as_view(), name="mobile-inventory-alerts-low-stock"),
    path("alerts/dead-stock/", InventoryDeadStockAPIView.as_view(), name="mobile-inventory-alerts-dead-stock"),
    # Procurement & Purchase Orders
    path("purchase-orders/", InventoryPurchaseOrdersAPIView.as_view(), name="mobile-inventory-purchase-orders"),
    path("po-planner/", InventoryPOPlannerAPIView.as_view(), name="mobile-inventory-po-planner"),
    path("po-planner/toggle-new-product/<int:pk>/", InventoryToggleNewProductAPIView.as_view(), name="mobile-inventory-toggle-new-product"),
    path("po-planner/top-customers/", InventoryPOPlannerTopCustomersAPIView.as_view(), name="mobile-inventory-po-top-customers"),
    path("tally-po/<int:voucher_id>/start-tracking/", InventoryStartPOTrackingAPIView.as_view(), name="mobile-inventory-start-po-tracking"),
    path("tracked-po/<int:pk>/", InventoryTrackedPODetailAPIView.as_view(), name="mobile-inventory-tracked-po-detail"),
    path("tracked-po/<int:pk>/update-quantities/", InventoryUpdateArrivedQtyAPIView.as_view(), name="mobile-inventory-update-arrived-qty"),
    path("tracked-po/<int:pk>/stages/add/", InventoryStageLogCreateAPIView.as_view(), name="mobile-inventory-stage-log-add"),
    path("stage-logs/<int:log_id>/edit/", InventoryStageLogUpdateAPIView.as_view(), name="mobile-inventory-stage-log-edit"),
    path("stages/", InventoryStageListCreateAPIView.as_view(), name="mobile-inventory-stages"),
    path("stages/<int:pk>/", InventoryStageUpdateAPIView.as_view(), name="mobile-inventory-stage-update"),
    # Analytics & BI
    path("analytics/", InventorySalesAnalyticsAPIView.as_view(), name="mobile-inventory-analytics"),
    path("analytics/contribution/", InventorySalesContributionAPIView.as_view(), name="mobile-inventory-analytics-contribution"),
    path("analytics/contribution/<int:item_id>/", InventorySalesContributionDetailAPIView.as_view(), name="mobile-inventory-analytics-contribution-detail"),
    path("analytics/category/", InventoryCategoryAnalyticsAPIView.as_view(), name="mobile-inventory-analytics-category"),
    path("analytics/product/<int:item_id>/", InventoryProductAnalyticsDetailAPIView.as_view(), name="mobile-inventory-analytics-product-detail"),
    path("analytics/comparison/", InventorySalesComparisonAPIView.as_view(), name="mobile-inventory-analytics-comparison"),
    path("analytics/report/", InventoryReportAPIView.as_view(), name="mobile-inventory-analytics-report"),
]
