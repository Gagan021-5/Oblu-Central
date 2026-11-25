# access_control/urls.py
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import MeProfileView, MobileLoginView, MyTeamListView

urlpatterns = [
    # 1. Mobile JWT auth endpoints
    path('login/', MobileLoginView.as_view(), name='auth-login'),
    path('refresh/', TokenRefreshView.as_view(), name='auth-refresh'),

    # 2. Essential profile & permissions endpoint for Mobile login and drawer
    path('me/', MeProfileView.as_view(), name='auth-me'),
    path('my-permissions/', MeProfileView.as_view(), name='access-control-my-permissions'),

    # 3. Hierarchy endpoint: returns the direct and indirect team reporting to the user
    path('my-team/', MyTeamListView.as_view(), name='my-team'),
]
