"""
ShareMyMeal — Wallet Payments Router
=========================================
Simulated Firestore wallet payment endpoints.
No Razorpay / Cashfree — all payments are atomic balance transfers.

Endpoints:
  POST /process       — Prepaid UPI payment (buyer → company at order time)
  POST /scan-qr       — UPI on delivery (seller scans buyer's QR at pickup)
  POST /payout/{id}   — Release funds to seller after pickup
  POST /refund/{id}   — Refund buyer for cancelled order
  GET  /balance/{uid} — Check wallet balance
  GET  /transactions/{uid} — Transaction history
"""

from fastapi import APIRouter, HTTPException

from app.models.payment import (
    WalletPaymentRequest, WalletPaymentResponse,
    QRPaymentScanRequest,
    PayoutRequest, PayoutResponse,
    RefundRequest, RefundResponse,
    WalletBalanceResponse,
)
from app.services.payment_service import wallet_service

router = APIRouter(prefix="/api/payments", tags=["Payments"])


# ─────────────────────────────────────────────────────────────
# POST /api/payments/process — Prepaid UPI payment
# ─────────────────────────────────────────────────────────────
@router.post(
    "/process",
    response_model=WalletPaymentResponse,
    summary="Process prepaid UPI payment",
)
async def process_payment(body: WalletPaymentRequest):
    """
    Prepaid UPI flow: Buyer pays at order placement time.
    Money goes from buyer's wallet → company account (held in escrow).
    
    The app shows a confirmation screen:
      From: buyer_upi@sharemymeal
      To:   sharemymeal.platform@sharemymeal
      Amount: ₹XXX
    
    On confirm, this endpoint deducts from buyer and credits company.
    """
    result = await wallet_service.deduct_from_buyer(
        buyer_uid=body.buyer_uid,
        amount=body.amount,
        order_id=body.order_id,
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    # Update order payment status
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()
            db.collection("orders").document(body.order_id).update({
                "payment_status": "paid_held",
            })
    except Exception:
        pass

    return WalletPaymentResponse(**result)


# ─────────────────────────────────────────────────────────────
# POST /api/payments/scan-qr — UPI on Delivery (QR code scan)
# ─────────────────────────────────────────────────────────────
@router.post(
    "/scan-qr",
    response_model=WalletPaymentResponse,
    summary="Process QR code payment at pickup",
)
async def scan_qr_payment(body: QRPaymentScanRequest):
    """
    UPI on Delivery flow: At pickup, buyer shows QR code on their screen.
    Seller scans it with their camera. The QR encodes order JSON.
    Seller's app decodes it and POSTs here.
    
    Money goes: buyer wallet → company account (held until pickup confirmed).
    """
    result = await wallet_service.deduct_from_buyer(
        buyer_uid=body.buyer_uid,
        amount=body.amount,
        order_id=body.order_id,
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    # Update order payment status
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()
            db.collection("orders").document(body.order_id).update({
                "payment_status": "paid_held",
            })
    except Exception:
        pass

    return WalletPaymentResponse(**result)


# ─────────────────────────────────────────────────────────────
# POST /api/payments/payout/{order_id} — Release to seller
# ─────────────────────────────────────────────────────────────
@router.post(
    "/payout/{order_id}",
    response_model=PayoutResponse,
    summary="Release held funds to seller",
)
async def release_payout(order_id: str, body: PayoutRequest):
    """
    Called after buyer confirms pickup. Moves held funds from
    company account to seller's wallet.
    
    For COD orders, this is a no-op (money exchanged physically).
    """
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()

            # Get order details
            order_doc = db.collection("orders").document(order_id).get()
            if not order_doc.exists:
                raise HTTPException(status_code=404, detail="Order not found")

            order_data = order_doc.to_dict()

            # COD — no wallet payout needed
            if order_data.get("payment_mode") == "cod":
                return PayoutResponse(
                    success=True,
                    message="COD order — no platform payout needed.",
                )

            # Execute payout
            result = await wallet_service.payout_to_seller(
                seller_uid=body.seller_uid,
                amount=order_data["total_price"],
                order_id=order_id,
            )

            if result["success"]:
                db.collection("orders").document(order_id).update({
                    "payment_status": "paid_to_seller",
                })

            return PayoutResponse(**result)
        else:
            return PayoutResponse(
                success=True,
                transaction_id=f"dev_payout_{order_id}",
                message="[DEV MODE] Payout processed.",
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
# POST /api/payments/refund/{order_id} — Refund buyer
# ─────────────────────────────────────────────────────────────
@router.post(
    "/refund/{order_id}",
    response_model=RefundResponse,
    summary="Refund buyer for cancelled order",
)
async def refund_payment(order_id: str, body: RefundRequest):
    """
    Refund the buyer's wallet for a cancelled prepaid order.
    Money goes: company account → buyer wallet.
    """
    result = await wallet_service.refund_buyer(
        buyer_uid=body.buyer_uid,
        amount=body.amount,
        order_id=order_id,
    )

    if result["success"]:
        try:
            import firebase_admin
            if firebase_admin._apps:
                from firebase_admin import firestore
                db = firestore.client()
                db.collection("orders").document(order_id).update({
                    "payment_status": "refunded",
                })
        except Exception:
            pass

    return RefundResponse(**result)


# ─────────────────────────────────────────────────────────────
# GET /api/payments/balance/{uid} — Check wallet balance
# ─────────────────────────────────────────────────────────────
@router.get(
    "/balance/{uid}",
    response_model=WalletBalanceResponse,
    summary="Get user wallet balance",
)
async def get_balance(uid: str):
    """Returns the user's current wallet balance and UPI ID."""
    result = await wallet_service.get_balance(uid)
    return WalletBalanceResponse(**result)


# ─────────────────────────────────────────────────────────────
# GET /api/payments/transactions/{uid} — Transaction history
# ─────────────────────────────────────────────────────────────
@router.get(
    "/transactions/{uid}",
    summary="Get user transaction history",
)
async def get_transactions(uid: str, limit: int = 20):
    """Returns the user's recent transactions (sent and received)."""
    txns = await wallet_service.get_transactions(uid, limit=limit)
    return {"uid": uid, "transactions": txns, "count": len(txns)}
