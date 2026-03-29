"""
ShareMyMeal — Ratings & Reviews Router
==========================================
Handles rating submission and retrieval after order completion.
Seller's aggregate rating is recalculated on each new review.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

router = APIRouter(prefix="/api/ratings", tags=["Ratings & Reviews"])


# ── Models ────────────────────────────────────────────────────
class RatingCreate(BaseModel):
    """Schema for submitting a rating after order completion."""
    order_id: str = Field(..., description="Completed order ID")
    buyer_uid: str = Field(..., description="Buyer who is rating")
    seller_uid: str = Field(..., description="Seller being rated")
    stars: int = Field(..., ge=1, le=5, description="1–5 star rating")
    review_text: Optional[str] = Field(None, max_length=500, description="Optional text review")


class RatingResponse(BaseModel):
    """Full rating as returned by the API."""
    id: str
    order_id: str
    buyer_uid: str
    seller_uid: str
    stars: int
    review_text: Optional[str] = None
    buyer_name: Optional[str] = None
    created_at: Optional[datetime] = None


# ─────────────────────────────────────────────────────────────
# POST /api/ratings — Submit a rating
# ─────────────────────────────────────────────────────────────
@router.post("/", response_model=RatingResponse, summary="Submit a rating & review")
async def submit_rating(rating: RatingCreate):
    """
    Submit a 1–5 star rating with an optional text review.
    Called after the buyer confirms food pickup.
    Recalculates the seller's aggregate rating in real-time.
    """
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()

            # Verify order exists and is completed
            order_doc = db.collection("orders").document(rating.order_id).get()
            if not order_doc.exists:
                raise HTTPException(status_code=404, detail="Order not found")
            order_data = order_doc.to_dict()
            if order_data.get("status") not in ("picked_up", "completed"):
                raise HTTPException(
                    status_code=400,
                    detail="Can only rate orders that have been picked up or completed.",
                )

            # Check if already rated
            existing = (
                db.collection("ratings")
                .where("order_id", "==", rating.order_id)
                .where("buyer_uid", "==", rating.buyer_uid)
                .limit(1)
                .get()
            )
            if len(existing) > 0:
                raise HTTPException(status_code=400, detail="This order has already been rated.")

            # Create rating document
            rating_data = {
                **rating.model_dump(),
                "created_at": datetime.utcnow(),
            }
            doc_ref = db.collection("ratings").document()
            rating_data["id"] = doc_ref.id
            doc_ref.set(rating_data)

            # Recalculate seller's aggregate rating
            seller_ref = db.collection("users").document(rating.seller_uid)
            seller_doc = seller_ref.get()
            if seller_doc.exists:
                seller_data = seller_doc.to_dict()
                current_rating = seller_data.get("rating", 0.0)
                total_ratings = seller_data.get("total_ratings", 0)

                # Weighted average: new_avg = (old_avg × count + new_rating) / (count + 1)
                new_total = total_ratings + 1
                new_rating = ((current_rating * total_ratings) + rating.stars) / new_total

                seller_ref.update({
                    "rating": round(new_rating, 2),
                    "total_ratings": new_total,
                })

            # Get buyer name for response
            buyer_doc = db.collection("users").document(rating.buyer_uid).get()
            buyer_name = buyer_doc.to_dict().get("display_name") if buyer_doc.exists else None
            rating_data["buyer_name"] = buyer_name

            return RatingResponse(**rating_data)
        else:
            # Dev mode
            return RatingResponse(
                id=f"mock_rating_{datetime.utcnow().timestamp()}",
                order_id=rating.order_id,
                buyer_uid=rating.buyer_uid,
                seller_uid=rating.seller_uid,
                stars=rating.stars,
                review_text=rating.review_text,
                buyer_name="Dev Buyer",
                created_at=datetime.utcnow(),
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit rating: {str(e)}")


# ─────────────────────────────────────────────────────────────
# GET /api/ratings/seller/{uid} — Get seller's ratings
# ─────────────────────────────────────────────────────────────
@router.get("/seller/{uid}", response_model=List[RatingResponse], summary="Get seller's ratings")
async def get_seller_ratings(uid: str):
    """Fetch all ratings & reviews for a specific seller, newest first."""
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()
            query = (
                db.collection("ratings")
                .where("seller_uid", "==", uid)
                .order_by("created_at", direction=firestore.Query.DESCENDING)
                .limit(50)
            )

            ratings = []
            for doc in query.stream():
                data = doc.to_dict()
                data["id"] = doc.id
                # Get buyer name
                buyer_doc = db.collection("users").document(data["buyer_uid"]).get()
                data["buyer_name"] = buyer_doc.to_dict().get("display_name") if buyer_doc.exists else "Anonymous"
                ratings.append(RatingResponse(**data))

            return ratings
        else:
            return [
                RatingResponse(
                    id="mock_1",
                    order_id="order_1",
                    buyer_uid="buyer_1",
                    seller_uid=uid,
                    stars=5,
                    review_text="Amazing rajma chawal! Tasted like home. ❤️",
                    buyer_name="Rahul",
                    created_at=datetime.utcnow(),
                ),
                RatingResponse(
                    id="mock_2",
                    order_id="order_2",
                    buyer_uid="buyer_2",
                    seller_uid=uid,
                    stars=4,
                    review_text="Good food, nice portion size.",
                    buyer_name="Priya",
                    created_at=datetime.utcnow(),
                ),
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
