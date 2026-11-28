"""
Models for the Call Tracer API.

- User: extends AbstractUser with role, device info, and consent
- CallLog: individual call log entries synced from employee devices
- CallStats: aggregated daily per-user call statistics
"""

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models



class CallTrackingProfile(models.Model): #call tracing model
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="call_tracking_profile",
    )

    device_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    device_model = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    app_version = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    consent_given = models.BooleanField(default=False)

    def __str__(self):
        return f"Call profile: {self.user.username}"


def normalize_phone(raw: str) -> str:
    """
    Normalize a phone number to E.164-like format for India.
    Strips spaces, dashes, parens, leading zeros/+91 prefix → +91XXXXXXXXXX.
    Returns cleaned digits only if non-Indian format detected.
    """
    import re
    digits = re.sub(r"[^\d+]", "", raw.strip())
    # Strip leading +
    if digits.startswith("+"):
        digits = digits[1:]
    # Strip leading 00 (international dialing prefix)
    if digits.startswith("00"):
        digits = digits[2:]
    # Indian numbers
    if digits.startswith("91") and len(digits) >= 12:
        digits = digits[-10:]  # last 10 digits
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]  # strip trunk prefix
    # If 10 digits, assume Indian
    if len(digits) == 10 and digits.isdigit():
        return f"+91{digits}"
    # Return with + prefix if we have something
    if digits:
        return f"+{digits}"
    return raw.strip()


class CallLog(models.Model):
    """
    Individual call log entry synced from an employee's device.
    Deduplication enforced via unique constraint on (user, phone_number, timestamp).
    """

    CALL_TYPE_CHOICES = [
        ("incoming", "Incoming"),
        ("outgoing", "Outgoing"),
        ("missed", "Missed"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="call_logs",
    )
    phone_number = models.CharField(
        max_length=20,
        db_index=True,
        help_text="Phone number involved in the call.",
    )
    normalized_phone = models.CharField(
        max_length=20,
        blank=True,
        default="",
        db_index=True,
        help_text="E.164 normalized phone number for customer matching.",
    )
    call_type = models.CharField(
        max_length=10,
        choices=CALL_TYPE_CHOICES,
        db_index=True,
    )
    duration = models.PositiveIntegerField(
        default=0,
        help_text="Call duration in seconds.",
    )
    timestamp = models.DateTimeField(
        db_index=True,
        help_text="When the call occurred on the device.",
    )
    synced_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When this record was synced to the server.",
    )
    customer = models.ForeignKey(
        "customer_dashboard.Customer",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="call_logs",
        help_text="Matched customer based on normalized phone number.",
    )
    audio_file = models.FileField(
        upload_to="call_recordings/%Y/%m/",
        null=True,
        blank=True,
        help_text="Uploaded call recording audio file from employee device.",
    )
    recording_filename = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Original filename of the uploaded recording.",
    )

    class Meta:
        db_table = "call_logs"
        ordering = ["-timestamp"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "phone_number", "timestamp"],
                name="unique_call_log_entry",
            ),
        ]
        indexes = [
            models.Index(
                fields=["user", "timestamp"],
                name="idx_user_timestamp",
            ),
            models.Index(
                fields=["normalized_phone"],
                name="idx_normalized_phone",
            ),
        ]

    def save(self, *args, **kwargs):
        if self.phone_number and not self.normalized_phone:
            self.normalized_phone = normalize_phone(self.phone_number)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} — {self.call_type} — {self.phone_number} @ {self.timestamp}"



class CallStats(models.Model):
    """
    Aggregated daily call statistics per user.
    Populated by the `aggregate_call_stats` management command.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="call_stats",
    )
    date = models.DateField(
        db_index=True,
        help_text="The date these statistics cover.",
    )
    total_calls = models.PositiveIntegerField(default=0)
    total_duration = models.PositiveIntegerField(
        default=0,
        help_text="Total call duration in seconds for this date.",
    )
    calls_by_type = models.JSONField(
        default=dict,
        help_text='Breakdown by call type, e.g. {"incoming": 5, "outgoing": 3, "missed": 1}',
    )
    top_numbers = models.JSONField(
        default=list,
        help_text='Top contacted numbers, e.g. [{"number": "+91...", "count": 10}, ...]',
    )

    class Meta:
        db_table = "call_stats"
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "date"],
                name="unique_user_date_stats",
            ),
        ]

    def __str__(self):
        return f"{self.user.username} — {self.date} — {self.total_calls} calls"

