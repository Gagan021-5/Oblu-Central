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
    InventorySalesAnalyticsAPIView,
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
    path("purchase-orders/", InventoryPurchaseOrdersAPIView.as_view(), name="mobile-inventory-purchase-orders"),
    path("analytics/", InventorySalesAnalyticsAPIView.as_view(), name="mobile-inventory-analytics"),
]
