"""
ShareMyMeal — FastAPI Application Entry Point
================================================
Main application file that:
  - Initializes Firebase Admin SDK
  - Ensures company account exists in Firestore
  - Registers all API routers
  - Configures CORS for mobile app access
  - Provides health check endpoints

Run with:
    cd D:\\ShareMyMeal\\backend
    .venv\\Scripts\\activate
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.firebase_admin_init import init_firebase
from app.services.payment_service import wallet_service

# Import all routers
from app.routers import auth, listings, orders, payments, ratings, notifications


# ── Lifespan: runs on startup/shutdown ────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup, clean up on shutdown."""
    print("🚀 Starting ShareMyMeal Backend...")
    print(f"   Server: http://{settings.host}:{settings.port}")
    print(f"   Docs:   http://{settings.host}:{settings.port}/docs")
    print(f"   Debug:  {settings.debug}")
    print()

    # Initialize Firebase Admin SDK
    init_firebase()

    # Ensure company wallet account exists in Firestore
    print("\n💰 Checking company account...")
    await wallet_service.ensure_company_account()
    print()

    yield  # App is running

    print("👋 Shutting down ShareMyMeal Backend...")


# ── Create FastAPI app ────────────────────────────────────────
app = FastAPI(
    title="ShareMyMeal API",
    description=(
        "Hyperlocal peer-to-peer food marketplace API. "
        "Connects neighbors who cook home food with nearby buyers. "
        "Built with FastAPI + Firebase. "
        "KYC: Firebase two-OTP flow (no external platform). "
        "Payments: Simulated Firestore wallet system (no Razorpay)."
    ),
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)


# ── CORS Middleware ───────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Register Routers ─────────────────────────────────────────
app.include_router(auth.router)
app.include_router(listings.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(ratings.router)
app.include_router(notifications.router)


# ── Health Check ──────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    """Root endpoint — health check for the API."""
    return {
        "app": "ShareMyMeal",
        "version": "2.0.0",
        "status": "running ✅",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Detailed health check with service statuses."""
    import firebase_admin

    return {
        "status": "healthy",
        "services": {
            "firebase": "connected" if firebase_admin._apps else "not_initialized",
            "kyc": "firebase_two_otp (no external platform)",
            "payments": "simulated_firestore_wallet (no razorpay)",
            "google_maps": (
                "configured"
                if settings.google_maps_api_key != "your_google_maps_api_key_here"
                else "placeholder_keys"
            ),
        },
        "platform_upi": settings.platform_upi_id,
        "wallet_range": f"₹{settings.min_wallet_balance}–₹{settings.max_wallet_balance}",
    }
