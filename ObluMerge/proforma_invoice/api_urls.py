"""
Proforma Invoice — REST API URL routing for mobile app.
Mounted at /api/proforma/
"""

from django.urls import path
from .api_views import (
    ProformaListCreateAPIView,
    ProformaDetailAPIView,
    PriceChangeRequestActionAPIView,
    ConvertQuotationToPIAPIView,
    ProformaProductsLookupAPIView,
    DispatchDetailAPIView,
    DispatchPackingSubmitAPIView,
    DispatchApprovePackingAPIView,
    DispatchRejectPackingAPIView,
    DispatchWarehouseSendAPIView,
)

urlpatterns = [
    # Proforma & Quotation Document APIs
    path("", ProformaListCreateAPIView.as_view(), name="mobile-proforma-list"),
    path("<int:pk>/", ProformaDetailAPIView.as_view(), name="mobile-proforma-detail"),
    path("price-requests/<int:pk>/", PriceChangeRequestActionAPIView.as_view(), name="mobile-price-request-action"),
    path("quotations/<int:pk>/convert/", ConvertQuotationToPIAPIView.as_view(), name="mobile-quotation-convert"),
    path("products/", ProformaProductsLookupAPIView.as_view(), name="mobile-proforma-products"),

    # Warehouse Dispatch & Camera Photo Capture APIs
    path("dispatch/<int:invoice_id>/", DispatchDetailAPIView.as_view(), name="mobile-dispatch-detail"),
    path("dispatch/<int:invoice_id>/packing/", DispatchPackingSubmitAPIView.as_view(), name="mobile-dispatch-packing-submit"),
    path("dispatch/<int:invoice_id>/approve-packing/", DispatchApprovePackingAPIView.as_view(), name="mobile-dispatch-approve-packing"),
    path("dispatch/<int:invoice_id>/reject-packing/", DispatchRejectPackingAPIView.as_view(), name="mobile-dispatch-reject-packing"),
    path("dispatch/<int:invoice_id>/send/", DispatchWarehouseSendAPIView.as_view(), name="mobile-dispatch-warehouse-send"),
]
