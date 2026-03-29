"""
ShareMyMeal — Food Listings Router
======================================
CRUD operations for food listings with geospatial querying.
Sellers post meals, buyers discover nearby food.
"""

from fastapi import APIRouter, HTTPException, status, Query
from typing import Optional, List
from datetime import datetime

from app.models.listing import (
    ListingCreate, ListingResponse, ListingUpdate, NearbyListingsQuery, LocationPoint,
)
from app.services.location_service import location_service
from app.services.notification_service import notification_service
from app.utils.geohash import haversine_distance

router = APIRouter(prefix="/api/listings", tags=["Food Listings"])


# ─────────────────────────────────────────────────────────────
# POST /api/listings — Create a new food listing
# ─────────────────────────────────────────────────────────────
@router.post("/", response_model=ListingResponse, summary="Post a new food listing")
async def create_listing(listing: ListingCreate):
    """
    Seller posts a new meal for sale.
    Computes geohash from pickup location and stores in Firestore.
    Sends FCM notifications to nearby users.
    """
    # Compute geohash for the pickup location
    geohash = location_service.compute_geohash(
        listing.pickup_location.latitude,
        listing.pickup_location.longitude,
    )

    listing_data = {
        **listing.model_dump(),
        "geohash": geohash,
        "packets_sold": 0,
        "status": "active",
        "created_at": datetime.utcnow(),
        # Flatten pickup_location for Firestore
        "pickup_location": {
            "latitude": listing.pickup_location.latitude,
            "longitude": listing.pickup_location.longitude,
        },
    }

    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()

            # Create the listing document
            doc_ref = db.collection("listings").document()
            listing_data["id"] = doc_ref.id
            doc_ref.set(listing_data)

            # Fetch seller info for the response
            seller_doc = db.collection("users").document(listing.seller_uid).get()
            seller_data = seller_doc.to_dict() if seller_doc.exists else {}

            # Notify nearby users about new listing
            # Get users whose last known location is near this listing
            # (In production, use geohash-based query on users' locations)
            # For now, we skip this as user locations are managed on the client

            response_data = {
                **listing_data,
                "seller_name": seller_data.get("display_name"),
                "seller_photo": seller_data.get("photo_url"),
                "seller_rating": seller_data.get("rating", 0.0),
                "seller_verified": seller_data.get("verified", False),
            }
            return ListingResponse(**response_data)
        else:
            # Dev mode: return mock listing
            listing_data["id"] = f"mock_listing_{datetime.utcnow().timestamp()}"
            return ListingResponse(
                **listing_data,
                seller_name="Dev Seller",
                seller_rating=4.5,
                seller_verified=True,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create listing: {str(e)}")


# ─────────────────────────────────────────────────────────────
# GET /api/listings/nearby — Find nearby food listings
# ─────────────────────────────────────────────────────────────
@router.get("/nearby", response_model=List[ListingResponse], summary="Get nearby food listings")
async def get_nearby_listings(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    radius_km: float = Query(default=5.0, gt=0, le=50.0),
):
    """
    Fetch all active food listings near the user's location.
    Uses geohash-based querying for efficient Firestore reads.
    Results are sorted by distance.
    """
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()

            # Get nearby geohash prefixes for querying
            # Use precision 5 for ~2.4km cells
            nearby_hashes = location_service.get_nearby_geohashes(latitude, longitude, precision=5)

            listings = []
            seen_ids = set()

            for gh in nearby_hashes:
                # Query listings whose geohash starts with this prefix
                query = (
                    db.collection("listings")
                    .where("status", "==", "active")
                    .where("geohash", ">=", gh)
                    .where("geohash", "<=", gh + "\uf8ff")
                    .limit(50)
                )

                for doc in query.stream():
                    data = doc.to_dict()
                    if doc.id in seen_ids:
                        continue
                    seen_ids.add(doc.id)

                    # Auto-expire listings past their cooking end time
                    prep_end = data.get("prep_time_end", "")
                    if prep_end:
                        try:
                            now = datetime.utcnow()
                            # Parse HH:MM format
                            end_parts = prep_end.split(":")
                            if len(end_parts) == 2:
                                end_hour, end_min = int(end_parts[0]), int(end_parts[1])
                                # Compare with today's time (adjust for IST: UTC+5:30)
                                from datetime import timedelta
                                ist_now = now + timedelta(hours=5, minutes=30)
                                if ist_now.hour > end_hour or (ist_now.hour == end_hour and ist_now.minute > end_min):
                                    # Auto-mark as expired in Firestore
                                    doc.reference.update({"status": "expired"})
                                    continue
                        except (ValueError, IndexError):
                            pass

                    # Calculate actual distance from user
                    pickup = data.get("pickup_location", {})
                    dist = haversine_distance(
                        latitude, longitude,
                        pickup.get("latitude", 0), pickup.get("longitude", 0),
                    )

                    # Filter by actual radius
                    if dist <= radius_km:
                        # Fetch seller info
                        seller_doc = db.collection("users").document(data["seller_uid"]).get()
                        seller_data = seller_doc.to_dict() if seller_doc.exists else {}

                        data["id"] = doc.id
                        data["distance_km"] = round(dist, 2)
                        data["seller_name"] = seller_data.get("display_name")
                        data["seller_photo"] = seller_data.get("photo_url")
                        data["seller_rating"] = seller_data.get("rating", 0.0)
                        data["seller_verified"] = seller_data.get("verified", False)

                        listings.append(ListingResponse(**data))

            # Sort by distance
            listings.sort(key=lambda x: x.distance_km or 999)
            return listings
        else:
            # Dev mode: return sample listings
            return [
                ListingResponse(
                    id="mock_1",
                    seller_uid="seller_001",
                    dish_name="Rajma Chawal",
                    description="Authentic North Indian rajma chawal, homemade with love! Fresh ingredients, perfect for lunch.",
                    sample_photo_url="https://placeholder.com/rajma.jpg",
                    price=60.0,
                    packets_available=10,
                    packets_sold=3,
                    pickup_location=LocationPoint(latitude=latitude + 0.005, longitude=longitude + 0.003),
                    geohash="tdr19e",
                    prep_time_start="12:00",
                    prep_time_end="13:30",
                    payment_modes=["cod", "upi_on_delivery", "prepaid_upi"],
                    status="active",
                    seller_name="Priya's Kitchen",
                    seller_rating=4.7,
                    seller_verified=True,
                    distance_km=0.5,
                    created_at=datetime.utcnow(),
                ),
                ListingResponse(
                    id="mock_2",
                    seller_uid="seller_002",
                    dish_name="Paneer Tikka Wrap",
                    description="Freshly grilled paneer tikka in whole wheat wrap. Healthy, filling, and delicious!",
                    sample_photo_url="https://placeholder.com/paneer.jpg",
                    price=80.0,
                    packets_available=5,
                    packets_sold=1,
                    pickup_location=LocationPoint(latitude=latitude - 0.003, longitude=longitude + 0.007),
                    geohash="tdr19f",
                    prep_time_start="19:00",
                    prep_time_end="20:30",
                    payment_modes=["cod", "prepaid_upi"],
                    status="active",
                    seller_name="Ravi's Home Bites",
                    seller_rating=4.2,
                    seller_verified=True,
                    distance_km=0.8,
                    created_at=datetime.utcnow(),
                ),
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch nearby listings: {str(e)}")


# ─────────────────────────────────────────────────────────────
# GET /api/listings/{listing_id} — Get single listing detail
# ─────────────────────────────────────────────────────────────
@router.get("/{listing_id}", response_model=ListingResponse, summary="Get listing details")
async def get_listing(listing_id: str):
    """Fetch a single food listing by its ID."""
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()
            doc = db.collection("listings").document(listing_id).get()
            if not doc.exists:
                raise HTTPException(status_code=404, detail="Listing not found")
            data = doc.to_dict()
            data["id"] = doc.id

            # Fetch seller info
            seller_doc = db.collection("users").document(data["seller_uid"]).get()
            seller_data = seller_doc.to_dict() if seller_doc.exists else {}
            data["seller_name"] = seller_data.get("display_name")
            data["seller_photo"] = seller_data.get("photo_url")
            data["seller_rating"] = seller_data.get("rating", 0.0)
            data["seller_verified"] = seller_data.get("verified", False)

            return ListingResponse(**data)
        else:
            raise HTTPException(status_code=404, detail="[DEV MODE] Listing not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
# PUT /api/listings/{listing_id} — Update a listing
# ─────────────────────────────────────────────────────────────
@router.put("/{listing_id}", summary="Update a food listing")
async def update_listing(listing_id: str, update: ListingUpdate):
    """Seller updates their listing (edit, mark sold out, etc.)."""
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()
            doc_ref = db.collection("listings").document(listing_id)
            if not doc_ref.get().exists:
                raise HTTPException(status_code=404, detail="Listing not found")

            update_data = {k: v for k, v in update.model_dump().items() if v is not None}
            update_data["updated_at"] = datetime.utcnow()
            doc_ref.update(update_data)
            return {"status": "updated", "listing_id": listing_id}
        else:
            return {"status": "updated", "listing_id": listing_id, "message": "[DEV MODE]"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
# DELETE /api/listings/{listing_id} — Delete a listing
# ─────────────────────────────────────────────────────────────
@router.delete("/{listing_id}", summary="Delete a food listing")
async def delete_listing(listing_id: str):
    """Seller removes their listing."""
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()
            doc_ref = db.collection("listings").document(listing_id)
            if not doc_ref.get().exists:
                raise HTTPException(status_code=404, detail="Listing not found")
            doc_ref.delete()
            return {"status": "deleted", "listing_id": listing_id}
        else:
            return {"status": "deleted", "listing_id": listing_id, "message": "[DEV MODE]"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
# GET /api/listings/seller/{uid} — Get seller's listings
# ─────────────────────────────────────────────────────────────
@router.get("/seller/{uid}", response_model=List[ListingResponse], summary="Get seller's listings")
async def get_seller_listings(uid: str):
    """Fetch all listings posted by a specific seller."""
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()
            query = db.collection("listings").where("seller_uid", "==", uid).order_by(
                "created_at", direction=firestore.Query.DESCENDING
            )

            listings = []
            for doc in query.stream():
                data = doc.to_dict()
                data["id"] = doc.id
                listings.append(ListingResponse(**data))
            return listings
        else:
            return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
