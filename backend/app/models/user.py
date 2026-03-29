"""
ShareMyMeal — User Model
=========================
Pydantic schemas for user registration, profile, KYC, and wallet.
No external KYC platform — uses Firebase two-OTP flow.
Every user gets a simulated UPI ID and wallet balance on registration.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class UserBase(BaseModel):
    """Base user fields shared across schemas."""
    display_name: Optional[str] = Field(None, max_length=100, description="Display name shown in app")
    photo_url: Optional[str] = Field(None, description="Profile photo URL from Firebase Storage")
    role: Literal["buyer", "seller", "both"] = Field(default="buyer", description="User role in the app")


class UserCreate(UserBase):
    """Schema for creating a user profile after phone OTP verification."""
    uid: str = Field(..., description="Firebase Auth UID")
    phone: str = Field(..., pattern=r"^\+91\d{10}$", description="Indian phone number with +91 prefix")


class UserProfile(UserBase):
    """Full user profile as stored in Firestore & returned by API."""
    uid: str
    phone: str

    # KYC fields (Firebase two-OTP flow)
    aadhaar_verified: bool = Field(default=False, description="Whether Aadhaar was verified via second OTP")
    kyc_completed: bool = Field(default=False, description="Whether full KYC flow is complete")
    masked_aadhaar: Optional[str] = Field(None, description="Masked Aadhaar — only last 4 visible (XXXX-XXXX-1234)")
    kyc_timestamp: Optional[datetime] = Field(None, description="When KYC was completed")

    # Simulated wallet
    upi_id: Optional[str] = Field(None, description="Auto-generated UPI ID (name.XXXX@sharemymeal)")
    wallet_balance: float = Field(default=0.0, ge=0.0, description="Simulated wallet balance in INR")

    # Ratings & stats
    rating: float = Field(default=0.0, ge=0.0, le=5.0)
    total_ratings: int = Field(default=0, ge=0)
    meals_sold: int = Field(default=0, ge=0)

    # Device
    fcm_token: Optional[str] = Field(None, description="Firebase Cloud Messaging device token")

    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    """Schema for partial profile updates."""
    display_name: Optional[str] = None
    photo_url: Optional[str] = None
    role: Optional[Literal["buyer", "seller", "both"]] = None
    fcm_token: Optional[str] = None


class KYCInitiateRequest(BaseModel):
    """Request to start Aadhaar verification (Step 2 of two-OTP flow).
    The user enters their 12-digit Aadhaar number. The backend stores it
    temporarily and triggers a second Firebase Phone Auth OTP to their
    already-verified mobile number. The SMS template is configured in
    Firebase Console to look like a UIDAI message.
    """
    uid: str = Field(..., description="Firebase UID of the user")
    aadhaar_number: str = Field(..., pattern=r"^\d{12}$", description="12-digit Aadhaar number")


class KYCVerifyOTPRequest(BaseModel):
    """Request to verify the UIDAI-styled OTP (Step 3 of two-OTP flow).
    After the user receives and enters the second OTP, the backend masks
    the Aadhaar number and writes aadhaar_verified + kyc_completed to Firestore.
    """
    uid: str = Field(..., description="Firebase UID of the user")
    aadhaar_number: str = Field(..., pattern=r"^\d{12}$", description="12-digit Aadhaar from previous step")
    otp: str = Field(..., pattern=r"^\d{6}$", description="6-digit OTP from UIDAI-styled SMS")
