"""
ShareMyMeal — Input Validators
================================
Reusable validation utilities for phone numbers, Aadhaar, UPI IDs, etc.
"""

import re
from fastapi import HTTPException, status


def validate_indian_phone(phone: str) -> str:
    """Validate and normalize an Indian phone number."""
    # Remove spaces and dashes
    phone = phone.replace(" ", "").replace("-", "")

    # Add +91 prefix if missing
    if phone.startswith("0"):
        phone = "+91" + phone[1:]
    elif not phone.startswith("+91"):
        phone = "+91" + phone

    # Validate format
    if not re.match(r"^\+91\d{10}$", phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Indian phone number. Expected format: +91XXXXXXXXXX",
        )

    return phone


def validate_aadhaar(aadhaar: str) -> str:
    """Validate a 12-digit Aadhaar number (basic format check only)."""
    aadhaar = aadhaar.replace(" ", "")
    if not re.match(r"^\d{12}$", aadhaar):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Aadhaar number. Must be exactly 12 digits.",
        )
    return aadhaar


def validate_upi_id(upi_id: str) -> str:
    """Validate a UPI ID format (e.g., user@upi, user@paytm)."""
    if not re.match(r"^[\w.\-]+@[\w]+$", upi_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UPI ID format. Expected format: name@bankcode",
        )
    return upi_id


def mask_aadhaar(aadhaar: str) -> str:
    """Mask Aadhaar number to show only last 4 digits: XXXX-XXXX-1234"""
    return f"XXXX-XXXX-{aadhaar[-4:]}"
