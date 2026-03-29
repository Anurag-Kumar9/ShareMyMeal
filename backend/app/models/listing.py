"""
ShareMyMeal — Listing Model
==============================
Pydantic schemas for food listing creation, updates, and queries.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime


class LocationPoint(BaseModel):
    """Geographic coordinates for pickup location."""
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)


class ListingCreate(BaseModel):
    """Schema for creating a new food listing."""
    seller_uid: str = Field(..., description="Firebase UID of the seller")
    dish_name: str = Field(..., min_length=2, max_length=100, description="Name of the dish")
    description: str = Field(..., min_length=10, max_length=500, description="Dish description")
    sample_photo_url: str = Field(..., description="URL of sample food photo from Firebase Storage")
    price: float = Field(..., gt=0, description="Price per packet in INR")
    packets_available: int = Field(..., gt=0, le=100, description="Number of packets available")
    pickup_location: LocationPoint = Field(..., description="Pickup location coordinates")
    prep_time_start: str = Field(..., description="Preparation start time (ISO format or HH:MM)")
    prep_time_end: str = Field(..., description="Preparation end time (ISO format or HH:MM)")
    payment_modes: List[Literal["cod", "upi_on_delivery", "prepaid_upi"]] = Field(
        ..., min_length=1, description="Accepted payment modes"
    )


class ListingResponse(BaseModel):
    """Full listing as returned by the API."""
    id: str
    seller_uid: str
    dish_name: str
    description: str
    sample_photo_url: str
    price: float
    packets_available: int
    packets_sold: int = 0
    pickup_location: LocationPoint
    geohash: str = Field(..., description="Geohash of the pickup location for spatial queries")
    prep_time_start: str
    prep_time_end: str
    payment_modes: List[str]
    status: Literal["active", "expired", "sold_out"] = "active"
    created_at: Optional[datetime] = None

    # Seller info (joined from users collection)
    seller_name: Optional[str] = None
    seller_photo: Optional[str] = None
    seller_rating: Optional[float] = None
    seller_verified: Optional[bool] = None

    # Computed field (distance from querying user)
    distance_km: Optional[float] = None

    class Config:
        from_attributes = True


class ListingUpdate(BaseModel):
    """Schema for partially updating a listing."""
    dish_name: Optional[str] = None
    description: Optional[str] = None
    sample_photo_url: Optional[str] = None
    price: Optional[float] = None
    packets_available: Optional[int] = None
    prep_time_start: Optional[str] = None
    prep_time_end: Optional[str] = None
    payment_modes: Optional[List[Literal["cod", "upi_on_delivery", "prepaid_upi"]]] = None
    status: Optional[Literal["active", "expired", "sold_out"]] = None


class NearbyListingsQuery(BaseModel):
    """Query parameters for fetching nearby listings."""
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    radius_km: float = Field(default=5.0, gt=0, le=50.0, description="Search radius in km")
