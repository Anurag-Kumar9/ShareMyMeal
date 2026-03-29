"""
ShareMyMeal — Payment Model
===============================
Pydantic schemas for the simulated Firestore wallet payment system.
No Razorpay / Cashfree — all payments are atomic Firestore balance transfers.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


# ── Wallet Payment (Prepaid UPI — pay at order time) ──────────

class WalletPaymentRequest(BaseModel):
    """Buyer pays at order placement time (prepaid UPI).
    Money goes: buyer wallet → company account (held until pickup confirmed).
    """
    order_id: str = Field(..., description="ShareMyMeal order ID")
    buyer_uid: str = Field(..., description="Firebase UID of the buyer")
    amount: float = Field(..., gt=0, description="Payment amount in INR")


class WalletPaymentResponse(BaseModel):
    """Response after a wallet payment operation."""
    success: bool
    transaction_id: Optional[str] = None
    message: str
    buyer_new_balance: Optional[float] = None


# ── QR Code Payment (UPI on Delivery — scan at pickup) ───────

class QRPaymentScanRequest(BaseModel):
    """Seller scans buyer's QR code at pickup. The QR encodes this payload.
    FastAPI receives this from the seller's app and processes the payment.
    """
    order_id: str = Field(..., description="ShareMyMeal order ID")
    buyer_uid: str = Field(..., description="Firebase UID of the buyer")
    amount: float = Field(..., gt=0, description="Payment amount in INR")


# ── Payout (Company → Seller after pickup confirmed) ─────────

class PayoutRequest(BaseModel):
    """Trigger payout from company account to seller after buyer confirms pickup."""
    order_id: str = Field(..., description="ShareMyMeal order ID")
    seller_uid: str = Field(..., description="Firebase UID of the seller")


class PayoutResponse(BaseModel):
    """Response after a payout operation."""
    success: bool
    transaction_id: Optional[str] = None
    message: str
    seller_new_balance: Optional[float] = None


# ── Refund (Company → Buyer for cancelled orders) ────────────

class RefundRequest(BaseModel):
    """Request to refund buyer wallet for a cancelled order."""
    order_id: str = Field(..., description="ShareMyMeal order ID")
    buyer_uid: str = Field(..., description="Firebase UID of the buyer")
    amount: float = Field(..., gt=0, description="Refund amount in INR")


class RefundResponse(BaseModel):
    """Response after a refund operation."""
    success: bool
    transaction_id: Optional[str] = None
    message: str
    buyer_new_balance: Optional[float] = None


# ── Transaction Log ──────────────────────────────────────────

class TransactionLog(BaseModel):
    """Every money movement is recorded for auditability."""
    id: Optional[str] = None
    type: Literal[
        "buyer_to_platform",
        "platform_to_seller",
        "platform_to_buyer",  # refund
    ]
    from_uid: str = Field(..., description="Source — buyer UID or 'system'")
    to_uid: str = Field(..., description="Destination — 'system' or seller UID")
    amount: float = Field(..., gt=0)
    order_id: str
    timestamp: Optional[datetime] = None
    status: Literal["success", "failed"] = "success"

    class Config:
        from_attributes = True


# ── Wallet Balance ───────────────────────────────────────────

class WalletBalanceResponse(BaseModel):
    """Response for balance inquiry."""
    uid: str
    upi_id: Optional[str] = None
    wallet_balance: float
