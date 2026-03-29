"""
ShareMyMeal — Order Model
============================
Pydantic schemas for order placement, status tracking, and history.
No Razorpay fields — payments are handled via simulated Firestore wallets.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


# ── Order Status Flow ─────────────────────────────────────────
# placed → accepted → cooking → ready → picked_up → completed
#       ↘ cancelled (at any point before cooking)
#       ↘ rejected (seller rejects)

ORDER_STATUS_FLOW = {
    "placed": ["accepted", "rejected", "cancelled"],
    "accepted": ["cooking", "cancelled"],
    "cooking": ["ready"],
    "ready": ["picked_up"],
    "picked_up": ["completed"],
    "completed": [],  # Terminal state
    "cancelled": [],  # Terminal state
    "rejected": [],   # Terminal state
}


class OrderCreate(BaseModel):
    """Schema for placing a new order."""
    buyer_uid: str = Field(..., description="Firebase UID of the buyer")
    seller_uid: str = Field(..., description="Firebase UID of the seller")
    listing_id: str = Field(..., description="ID of the food listing")
    quantity: int = Field(..., gt=0, le=50, description="Number of packets ordered")
    payment_mode: Literal["cod", "upi_on_delivery", "prepaid_upi"] = Field(
        ..., description="Selected payment mode"
    )


class OrderResponse(BaseModel):
    """Full order as returned by the API."""
    id: str
    buyer_uid: str
    seller_uid: str
    listing_id: str
    quantity: int
    total_price: float
    payment_mode: str
    payment_status: Literal[
        "pending",       # No payment yet (COD / UPI on delivery before pickup)
        "paid_held",     # Money deducted from buyer, held by platform
        "paid_to_seller",# Money released to seller after pickup confirmed
        "refunded",      # Money refunded to buyer (cancelled order)
        "not_applicable",# COD — no digital payment involved
    ] = "pending"
    status: Literal[
        "placed", "accepted", "cooking", "ready",
        "picked_up", "completed", "cancelled", "rejected"
    ] = "placed"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Joined fields for display
    dish_name: Optional[str] = None
    sample_photo_url: Optional[str] = None
    seller_name: Optional[str] = None
    buyer_name: Optional[str] = None
    pickup_location: Optional[dict] = None

    class Config:
        from_attributes = True


class OrderStatusUpdate(BaseModel):
    """Schema for updating order status (seller or buyer action)."""
    status: Literal[
        "accepted", "rejected", "cooking", "ready",
        "picked_up", "completed", "cancelled"
    ] = Field(..., description="New status for the order")
    updated_by: str = Field(..., description="UID of the person updating the status")


class OrderConfirmPickup(BaseModel):
    """Schema for buyer confirming food pickup."""
    buyer_uid: str = Field(..., description="Firebase UID of the buyer")
