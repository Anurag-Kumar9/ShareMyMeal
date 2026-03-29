"""
ShareMyMeal Backend — Application Configuration
=================================================
Loads all environment variables via pydantic-settings.
No external KYC or payment gateway keys — everything runs on
Firebase + simulated Firestore wallet system.
"""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Central configuration loaded from .env file."""

    # ── Firebase ──────────────────────────────────────────────
    firebase_service_account_path: str = Field(
        default="./firebase-service-account.json",
        description="Path to Firebase Admin SDK service account JSON",
    )

    # ── Google Maps ───────────────────────────────────────────
    google_maps_api_key: str = Field(default="your_google_maps_api_key_here")

    # ── Simulated Wallet Payment System ───────────────────────
    platform_upi_id: str = Field(
        default="sharemymeal.platform@sharemymeal",
        description="Platform's simulated UPI ID (company escrow account)",
    )
    min_wallet_balance: int = Field(
        default=500,
        description="Minimum random wallet balance assigned on registration (INR)",
    )
    max_wallet_balance: int = Field(
        default=5000,
        description="Maximum random wallet balance assigned on registration (INR)",
    )
    company_account_doc_path: str = Field(
        default="system/company_account",
        description="Firestore document path for the platform company account",
    )

    # ── Server ────────────────────────────────────────────────
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)
    debug: bool = Field(default=True)

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


# Singleton instance used across the app
settings = Settings()
