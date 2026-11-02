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
)

urlpatterns = [
    path("", ProformaListCreateAPIView.as_view(), name="mobile-proforma-list"),
    path("<int:pk>/", ProformaDetailAPIView.as_view(), name="mobile-proforma-detail"),
    path("price-requests/<int:pk>/", PriceChangeRequestActionAPIView.as_view(), name="mobile-price-request-action"),
    path("quotations/<int:pk>/convert/", ConvertQuotationToPIAPIView.as_view(), name="mobile-quotation-convert"),
    path("products/", ProformaProductsLookupAPIView.as_view(), name="mobile-proforma-products"),
]

