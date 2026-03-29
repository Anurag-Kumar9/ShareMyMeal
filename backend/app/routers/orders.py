"""
ShareMyMeal — Orders Router
================================
Full order lifecycle management:
  Place → Accept → Cook → Ready → Pickup → Complete
With wallet-based payment integration (no Razorpay).
"""

from fastapi import APIRouter, HTTPException, status
from typing import List
from datetime import datetime

from app.models.order import (
    OrderCreate, OrderResponse, OrderStatusUpdate,
    OrderConfirmPickup, ORDER_STATUS_FLOW,
)
from app.services.payment_service import wallet_service
from app.services.notification_service import notification_service

router = APIRouter(prefix="/api/orders", tags=["Orders"])


# ─────────────────────────────────────────────────────────────
# POST /api/orders — Place a new order
# ─────────────────────────────────────────────────────────────
@router.post("/", response_model=OrderResponse, summary="Place a new order")
async def create_order(order: OrderCreate):
    """
    Buyer places an order for a food listing.
    
    Payment flows:
    - COD: Order created, payment_status = "not_applicable"
    - UPI on Delivery: Order created, payment_status = "pending" (QR at pickup)
    - Prepaid UPI: Wallet deduction happens immediately, payment_status = "paid_held"
    """
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()

            # Fetch the listing to get price and validate availability
            listing_doc = db.collection("listings").document(order.listing_id).get()
            if not listing_doc.exists:
                raise HTTPException(status_code=404, detail="Listing not found")

            listing_data = listing_doc.to_dict()

            # Prevent self-ordering
            if order.buyer_uid == listing_data.get("seller_uid"):
                raise HTTPException(
                    status_code=400,
                    detail="You cannot order your own listing.",
                )

            # Check availability
            available = listing_data.get("packets_available", 0) - listing_data.get("packets_sold", 0)
            if order.quantity > available:
                raise HTTPException(
                    status_code=400,
                    detail=f"Only {available} packets available. Requested: {order.quantity}",
                )

            # Check if selected payment mode is accepted by seller
            if order.payment_mode not in listing_data.get("payment_modes", []):
                raise HTTPException(
                    status_code=400,
                    detail=f"Payment mode '{order.payment_mode}' not accepted by this seller.",
                )

            total_price = listing_data["price"] * order.quantity

            # Determine initial payment status
            if order.payment_mode == "cod":
                initial_payment_status = "not_applicable"
            else:
                initial_payment_status = "pending"

            # Create the order document
            doc_ref = db.collection("orders").document()
            order_data = {
                **order.model_dump(),
                "id": doc_ref.id,
                "total_price": total_price,
                "payment_status": initial_payment_status,
                "status": "placed",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "dish_name": listing_data.get("dish_name"),
                "sample_photo_url": listing_data.get("sample_photo_url"),
                "pickup_location": listing_data.get("pickup_location"),
            }

            # If prepaid UPI → deduct from wallet immediately
            if order.payment_mode == "prepaid_upi":
                payment_result = await wallet_service.deduct_from_buyer(
                    buyer_uid=order.buyer_uid,
                    amount=total_price,
                    order_id=doc_ref.id,
                )
                if not payment_result["success"]:
                    raise HTTPException(status_code=400, detail=payment_result["message"])
                order_data["payment_status"] = "paid_held"

            doc_ref.set(order_data)

            # Update packets_sold on the listing
            listing_doc.reference.update({
                "packets_sold": firestore.Increment(order.quantity),
            })

            # Notify seller about new order
            seller_doc = db.collection("users").document(order.seller_uid).get()
            if seller_doc.exists:
                seller_data = seller_doc.to_dict()
                fcm_token = seller_data.get("fcm_token")
                if fcm_token:
                    await notification_service.send_to_device(
                        fcm_token=fcm_token,
                        title="New Order! 🛒",
                        body=f"New order for {listing_data.get('dish_name', 'your dish')} ({order.quantity} pkts).",
                        data={"order_id": doc_ref.id, "type": "new_order"},
                    )
                order_data["seller_name"] = seller_data.get("display_name")

            # Get buyer name
            buyer_doc = db.collection("users").document(order.buyer_uid).get()
            if buyer_doc.exists:
                order_data["buyer_name"] = buyer_doc.to_dict().get("display_name")

            return OrderResponse(**order_data)
        else:
            # Dev mode
            total_price = 60.0 * order.quantity
            payment_status = "not_applicable" if order.payment_mode == "cod" else "pending"
            if order.payment_mode == "prepaid_upi":
                payment_status = "paid_held"

            order_data = {
                **order.model_dump(),
                "id": f"mock_order_{datetime.utcnow().timestamp()}",
                "total_price": total_price,
                "payment_status": payment_status,
                "status": "placed",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "dish_name": "Mock Dish",
            }
            return OrderResponse(**order_data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")


# ─────────────────────────────────────────────────────────────
# PUT /api/orders/{order_id}/status — Update order status
# ─────────────────────────────────────────────────────────────
@router.put("/{order_id}/status", summary="Update order status")
async def update_order_status(order_id: str, update: OrderStatusUpdate):
    """
    Updates the order status through the defined flow.
    Validates that the status transition is allowed.
    Sends push notifications to the relevant party.
    """
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()
            order_ref = db.collection("orders").document(order_id)
            order_doc = order_ref.get()

            if not order_doc.exists:
                raise HTTPException(status_code=404, detail="Order not found")

            order_data = order_doc.to_dict()
            current_status = order_data.get("status", "placed")

            # Validate status transition
            allowed_transitions = ORDER_STATUS_FLOW.get(current_status, [])
            if update.status not in allowed_transitions:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot transition from '{current_status}' to '{update.status}'. "
                           f"Allowed: {allowed_transitions}",
                )

            update_data = {
                "status": update.status,
                "updated_at": datetime.utcnow(),
            }

            # Handle cancellation — refund if payment was held
            if update.status == "cancelled" and order_data.get("payment_status") == "paid_held":
                refund_result = await wallet_service.refund_buyer(
                    buyer_uid=order_data["buyer_uid"],
                    amount=order_data["total_price"],
                    order_id=order_id,
                )
                if refund_result["success"]:
                    update_data["payment_status"] = "refunded"

            order_ref.update(update_data)

            # Send notification to the relevant party
            notify_uid = (
                order_data["buyer_uid"]
                if update.updated_by == order_data["seller_uid"]
                else order_data["seller_uid"]
            )

            user_doc = db.collection("users").document(notify_uid).get()
            if user_doc.exists:
                fcm_token = user_doc.to_dict().get("fcm_token")
                if fcm_token:
                    await notification_service.send_order_status_notification(
                        fcm_token=fcm_token,
                        order_id=order_id,
                        new_status=update.status,
                        dish_name=order_data.get("dish_name", "your food"),
                    )

            return {
                "status": "updated",
                "order_id": order_id,
                "new_status": update.status,
            }
        else:
            return {
                "status": "updated",
                "order_id": order_id,
                "new_status": update.status,
                "message": "[DEV MODE]",
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
# POST /api/orders/{order_id}/confirm-pickup — Buyer confirms pickup
# ─────────────────────────────────────────────────────────────
@router.post("/{order_id}/confirm-pickup", summary="Buyer confirms food pickup")
async def confirm_pickup(order_id: str, body: OrderConfirmPickup):
    """
    Buyer confirms they have picked up the food.
    For digital payments, this triggers the payout to the seller.
    
    Money flow: company account → seller wallet
    """
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()
            order_ref = db.collection("orders").document(order_id)
            order_doc = order_ref.get()

            if not order_doc.exists:
                raise HTTPException(status_code=404, detail="Order not found")

            order_data = order_doc.to_dict()

            # Verify the buyer is the one confirming
            if order_data["buyer_uid"] != body.buyer_uid:
                raise HTTPException(status_code=403, detail="Only the buyer can confirm pickup.")

            # Verify order is in 'ready' status
            if order_data["status"] != "ready":
                raise HTTPException(
                    status_code=400,
                    detail=f"Order must be in 'ready' status. Current: {order_data['status']}",
                )

            # Update order status to picked_up
            order_ref.update({
                "status": "picked_up",
                "updated_at": datetime.utcnow(),
            })

            payout_result = {"success": True, "message": "COD — no payout needed."}

            # Trigger payout for digital payments
            if order_data.get("payment_status") == "paid_held":
                payout_result = await wallet_service.payout_to_seller(
                    seller_uid=order_data["seller_uid"],
                    amount=order_data["total_price"],
                    order_id=order_id,
                )

                if payout_result["success"]:
                    order_ref.update({"payment_status": "paid_to_seller"})

                    # Notify seller about payout
                    seller_doc = db.collection("users").document(order_data["seller_uid"]).get()
                    if seller_doc.exists:
                        fcm_token = seller_doc.to_dict().get("fcm_token")
                        if fcm_token:
                            await notification_service.send_to_device(
                                fcm_token=fcm_token,
                                title="Payment Received! 💰",
                                body=f"₹{order_data['total_price']} has been credited to your ShareMyMeal wallet.",
                                data={"order_id": order_id, "type": "payout_received"},
                            )

            # Mark as completed
            order_ref.update({
                "status": "completed",
                "updated_at": datetime.utcnow(),
            })

            # Update seller's meals_sold count
            db.collection("users").document(order_data["seller_uid"]).update({
                "meals_sold": firestore.Increment(1),
            })

            return {
                "status": "completed",
                "order_id": order_id,
                "payout": payout_result,
            }
        else:
            return {
                "status": "completed",
                "order_id": order_id,
                "message": "[DEV MODE] Pickup confirmed.",
                "payout": {"success": True, "message": "Dev payout."},
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
# GET /api/orders/buyer/{uid} — Buyer's orders
# ─────────────────────────────────────────────────────────────
@router.get("/buyer/{uid}", response_model=List[OrderResponse], summary="Get buyer's orders")
async def get_buyer_orders(uid: str):
    """Fetch all orders placed by a specific buyer."""
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()
            query = (
                db.collection("orders")
                .where("buyer_uid", "==", uid)
                .order_by("created_at", direction=firestore.Query.DESCENDING)
                .limit(50)
            )
            orders = []
            for doc in query.stream():
                data = doc.to_dict()
                data["id"] = doc.id
                orders.append(OrderResponse(**data))
            return orders
        else:
            return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
# GET /api/orders/seller/{uid} — Seller's incoming orders
# ─────────────────────────────────────────────────────────────
@router.get("/seller/{uid}", response_model=List[OrderResponse], summary="Get seller's orders")
async def get_seller_orders(uid: str):
    """Fetch all orders received by a specific seller."""
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()
            query = (
                db.collection("orders")
                .where("seller_uid", "==", uid)
                .order_by("created_at", direction=firestore.Query.DESCENDING)
                .limit(50)
            )
            orders = []
            for doc in query.stream():
                data = doc.to_dict()
                data["id"] = doc.id
                orders.append(OrderResponse(**data))
            return orders
        else:
            return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
# GET /api/orders/{order_id} — Get single order detail
# ─────────────────────────────────────────────────────────────
@router.get("/{order_id}", response_model=OrderResponse, summary="Get order details")
async def get_order(order_id: str):
    """Fetch a single order by its ID."""
    try:
        import firebase_admin
        if firebase_admin._apps:
            from firebase_admin import firestore
            db = firestore.client()
            doc = db.collection("orders").document(order_id).get()
            if not doc.exists:
                raise HTTPException(status_code=404, detail="Order not found")
            data = doc.to_dict()
            data["id"] = doc.id
            return OrderResponse(**data)
        else:
            raise HTTPException(status_code=404, detail="[DEV MODE] Order not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
