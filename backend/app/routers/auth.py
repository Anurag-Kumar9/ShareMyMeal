"""
ShareMyMeal — Auth & KYC Router
===================================
Handles:
  - Firebase token verification
  - User profile creation (auto-generates UPI ID + wallet balance)
  - Two-OTP Aadhaar KYC (Firebase Phone Auth, no external platform)
  - KYC status check
"""

from fastapi import APIRouter, HTTPException, Header, status, Depends
from typing import Optional
from datetime import datetime

from app.models.user import (
    UserCreate, UserProfile, UserProfileUpdate,
    KYCInitiateRequest, KYCVerifyOTPRequest,
)
from app.services.kyc_service import kyc_service
from app.services.payment_service import wallet_service
from app.utils.validators import validate_aadhaar, mask_aadhaar

router = APIRouter(prefix="/api/auth", tags=["Authentication & KYC"])


# ─────────────────────────────────────────────────────────────
# Helper: Verify Firebase ID Token
# ─────────────────────────────────────────────────────────────
async def verify_firebase_token(authorization: Optional[str] = Header(None)) -> str:
    """
    Dependency that extracts and verifies a Firebase ID token
    from the Authorization header. Returns the user's Firebase UID.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header. Expected: Bearer <firebase_id_token>",
        )

    token = authorization.split("Bearer ")[1]

    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import auth
            decoded = auth.verify_id_token(token)
            return decoded["uid"]
        else:
            # Dev mode: accept any token, extract UID from it
            return token
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Firebase token: {str(e)}",
        )


# ─────────────────────────────────────────────────────────────
# POST /api/auth/verify-token
# ─────────────────────────────────────────────────────────────
@router.post("/verify-token", summary="Verify Firebase ID token")
async def verify_token(uid: str = Depends(verify_firebase_token)):
    """Verifies the Firebase ID token. Returns the authenticated UID."""
    return {"uid": uid, "authenticated": True}


# ─────────────────────────────────────────────────────────────
# POST /api/auth/profile — Create profile + auto-generate UPI & wallet
# ─────────────────────────────────────────────────────────────
@router.post("/profile", response_model=UserProfile, summary="Create or update user profile")
async def create_or_update_profile(user: UserCreate):
    """
    Creates a new user profile in Firestore or updates an existing one.
    On first creation, auto-generates:
      - UPI ID: firstname.XXXX@sharemymeal
      - Wallet balance: random ₹500–₹5000
    """
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()
            user_ref = db.collection("users").document(user.uid)
            existing = user_ref.get()

            profile_data = {
                "display_name": user.display_name,
                "phone": user.phone,
                "photo_url": user.photo_url,
                "role": user.role,
                "updated_at": datetime.utcnow(),
            }

            if existing.exists:
                # Update existing profile (don't regenerate UPI/wallet)
                user_ref.update(profile_data)
            else:
                # New user — generate UPI ID and wallet balance
                upi_id = wallet_service.generate_upi_id(user.display_name or "user")
                wallet_balance = wallet_service.generate_wallet_balance()

                profile_data.update({
                    "uid": user.uid,
                    "aadhaar_verified": False,
                    "kyc_completed": False,
                    "masked_aadhaar": None,
                    "kyc_timestamp": None,
                    "upi_id": upi_id,
                    "wallet_balance": wallet_balance,
                    "rating": 0.0,
                    "total_ratings": 0,
                    "meals_sold": 0,
                    "fcm_token": None,
                    "created_at": datetime.utcnow(),
                })
                user_ref.set(profile_data)

            # Return the full profile
            doc = user_ref.get()
            return UserProfile(**doc.to_dict())
        else:
            # Dev mode: return mock profile with generated wallet
            upi_id = wallet_service.generate_upi_id(user.display_name or "user")
            wallet_balance = wallet_service.generate_wallet_balance()
            return UserProfile(
                uid=user.uid,
                phone=user.phone,
                display_name=user.display_name,
                photo_url=user.photo_url,
                role=user.role,
                aadhaar_verified=False,
                kyc_completed=False,
                upi_id=upi_id,
                wallet_balance=wallet_balance,
                created_at=datetime.utcnow(),
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create/update profile: {str(e)}",
        )


# ─────────────────────────────────────────────────────────────
# GET /api/auth/profile/{uid}
# ─────────────────────────────────────────────────────────────
@router.get("/profile/{uid}", response_model=UserProfile, summary="Get user profile")
async def get_profile(uid: str):
    """Fetch a user's profile from Firestore by their UID."""
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()
            doc = db.collection("users").document(uid).get()
            if not doc.exists:
                raise HTTPException(status_code=404, detail="User not found")
            return UserProfile(**doc.to_dict())
        else:
            return UserProfile(
                uid=uid,
                phone="+910000000000",
                display_name="Dev User",
                role="both",
                upi_id="dev.0000@sharemymeal",
                wallet_balance=2500,
                aadhaar_verified=False,
                kyc_completed=False,
                created_at=datetime.utcnow(),
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {str(e)}")


# ─────────────────────────────────────────────────────────────
# PUT /api/auth/profile/{uid}
# ─────────────────────────────────────────────────────────────
@router.put("/profile/{uid}", summary="Update user profile")
async def update_profile(uid: str, update: UserProfileUpdate):
    """Partially update a user's profile (name, photo, role, FCM token)."""
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()
            user_ref = db.collection("users").document(uid)
            if not user_ref.get().exists:
                raise HTTPException(status_code=404, detail="User not found")

            update_data = {k: v for k, v in update.model_dump().items() if v is not None}
            update_data["updated_at"] = datetime.utcnow()
            user_ref.update(update_data)
            return {"status": "updated", "uid": uid}
        else:
            return {"status": "updated", "uid": uid, "message": "[DEV MODE]"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")


# ─────────────────────────────────────────────────────────────
# POST /api/auth/kyc/initiate — Start Aadhaar verification
# ─────────────────────────────────────────────────────────────
@router.post("/kyc/initiate", summary="Initiate Aadhaar verification (second OTP)")
async def initiate_kyc(request: KYCInitiateRequest):
    """
    Step 2 of two-OTP flow: User submits Aadhaar number.
    Backend validates and signals the app to send a UIDAI-styled OTP
    via Firebase Phone Auth to the user's already-verified number.
    """
    aadhaar = validate_aadhaar(request.aadhaar_number)

    # Get user's phone from Firestore
    phone = None
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()
            user_doc = db.collection("users").document(request.uid).get()
            if user_doc.exists:
                phone = user_doc.to_dict().get("phone")
    except Exception:
        pass

    if not phone:
        phone = "+910000000000"  # Dev fallback

    result = await kyc_service.initiate_aadhaar_verification(aadhaar, request.uid, phone)
    return result


# ─────────────────────────────────────────────────────────────
# POST /api/auth/kyc/verify — Complete Aadhaar verification
# ─────────────────────────────────────────────────────────────
@router.post("/kyc/verify", summary="Complete Aadhaar verification after OTP")
async def verify_kyc(request: KYCVerifyOTPRequest):
    """
    Step 3 of two-OTP flow: After the app verifies the second OTP
    via Firebase Phone Auth, it calls this endpoint.
    
    Backend masks the Aadhaar number and writes kyc_completed: true
    to Firestore. The full Aadhaar number is never stored.
    """
    aadhaar = validate_aadhaar(request.aadhaar_number)
    result = await kyc_service.complete_aadhaar_verification(request.uid, aadhaar)
    return result


# ─────────────────────────────────────────────────────────────
# GET /api/auth/kyc/status/{uid} — Check KYC status
# ─────────────────────────────────────────────────────────────
@router.get("/kyc/status/{uid}", summary="Check KYC verification status")
async def get_kyc_status(uid: str):
    """Check whether a user has completed Aadhaar verification."""
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()
            doc = db.collection("users").document(uid).get()
            if not doc.exists:
                raise HTTPException(status_code=404, detail="User not found")
            data = doc.to_dict()
            return {
                "uid": uid,
                "aadhaar_verified": data.get("aadhaar_verified", False),
                "kyc_completed": data.get("kyc_completed", False),
                "masked_aadhaar": data.get("masked_aadhaar"),
            }
        else:
            return {"uid": uid, "aadhaar_verified": False, "kyc_completed": False}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check KYC: {str(e)}")
