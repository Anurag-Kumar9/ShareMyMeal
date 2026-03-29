"""
ShareMyMeal — Wallet Payment Service
========================================
Simulated Firestore wallet system — no Razorpay / Cashfree.

Every user gets:
  - A UPI ID: firstname.XXXX@sharemymeal
  - A random wallet balance (₹500–₹5000)

Money flow:
  Buyer wallet  →  Company account (escrow)  →  Seller wallet

Every transfer is logged in 'transactions' collection for auditability.
"""

import random
import string
from typing import Dict, Any, Optional
from datetime import datetime
from app.config import settings


class WalletPaymentService:
    """Handles all wallet operations using Firestore as the ledger."""

    def __init__(self):
        self.platform_upi_id = settings.platform_upi_id
        self.min_balance = settings.min_wallet_balance
        self.max_balance = settings.max_wallet_balance
        self.company_doc_path = settings.company_account_doc_path

    # ── Registration Helpers ──────────────────────────────────

    def generate_upi_id(self, display_name: str) -> str:
        """Generate a simulated UPI ID from the user's name.
        Format: firstname.XXXX@sharemymeal (e.g., ankit.4821@sharemymeal)
        """
        # Clean the name — take first word, lowercase, alphanumeric only
        first_name = display_name.strip().split()[0].lower()
        first_name = "".join(c for c in first_name if c.isalnum()) or "user"
        suffix = "".join(random.choices(string.digits, k=4))
        return f"{first_name}.{suffix}@sharemymeal"

    def generate_wallet_balance(self) -> int:
        """Assign a random initial wallet balance between min and max."""
        return random.randint(self.min_balance, self.max_balance)

    # ── Company Account ───────────────────────────────────────

    async def ensure_company_account(self) -> None:
        """Create the company account document if it doesn't exist.
        Called once at server startup.
        """
        try:
            import firebase_admin
            if firebase_admin._apps:
                from firebase_admin import firestore
                db = firestore.client()
                parts = self.company_doc_path.split("/")
                doc_ref = db.collection(parts[0]).document(parts[1])
                doc = doc_ref.get()
                if not doc.exists:
                    doc_ref.set({
                        "wallet_balance": 100000,  # Initial platform seed
                        "total_held": 0,           # Currently held in escrow
                        "created_at": datetime.utcnow(),
                    })
                    print("  ✅ Company account created with ₹1,00,000 seed balance")
                else:
                    bal = doc.to_dict().get("wallet_balance", 0)
                    print(f"  ✅ Company account exists — Balance: ₹{bal}")
        except Exception as e:
            print(f"  ⚠️ Company account check failed: {e}")

    # ── Core Payment Operations ───────────────────────────────

    async def deduct_from_buyer(
        self, buyer_uid: str, amount: float, order_id: str
    ) -> Dict[str, Any]:
        """
        Deduct amount from buyer's wallet and add to company account.
        Used for both prepaid_upi (at order time) and upi_on_delivery (at pickup).
        
        Atomic operation:
        1. Check buyer balance >= amount
        2. Deduct from buyer wallet_balance
        3. Add to company wallet_balance + total_held
        4. Log transaction
        """
        try:
            import firebase_admin
            if firebase_admin._apps:
                from firebase_admin import firestore
                db = firestore.client()

                # Get buyer's current balance
                buyer_ref = db.collection("users").document(buyer_uid)
                buyer_doc = buyer_ref.get()
                if not buyer_doc.exists:
                    return {"success": False, "message": "Buyer not found."}

                buyer_data = buyer_doc.to_dict()
                current_balance = buyer_data.get("wallet_balance", 0)

                if current_balance < amount:
                    return {
                        "success": False,
                        "message": (
                            f"Insufficient balance. Have ₹{current_balance}, "
                            f"need ₹{amount}."
                        ),
                    }

                # Deduct from buyer
                new_balance = current_balance - amount
                buyer_ref.update({"wallet_balance": new_balance, "updated_at": datetime.utcnow()})

                # Add to company account
                parts = self.company_doc_path.split("/")
                company_ref = db.collection(parts[0]).document(parts[1])
                company_ref.update({
                    "wallet_balance": firestore.Increment(amount),
                    "total_held": firestore.Increment(amount),
                })

                # Log transaction
                txn_ref = db.collection("transactions").document()
                txn_data = {
                    "type": "buyer_to_platform",
                    "from_uid": buyer_uid,
                    "to_uid": "system",
                    "amount": amount,
                    "order_id": order_id,
                    "timestamp": datetime.utcnow(),
                    "status": "success",
                }
                txn_ref.set(txn_data)

                return {
                    "success": True,
                    "transaction_id": txn_ref.id,
                    "message": f"₹{amount} deducted from wallet.",
                    "buyer_new_balance": new_balance,
                }
            else:
                # Dev mode
                return {
                    "success": True,
                    "transaction_id": f"dev_txn_{order_id}",
                    "message": f"[DEV MODE] ₹{amount} deducted.",
                    "buyer_new_balance": 999,
                }
        except Exception as e:
            return {"success": False, "message": f"Payment failed: {str(e)}"}

    async def payout_to_seller(
        self, seller_uid: str, amount: float, order_id: str
    ) -> Dict[str, Any]:
        """
        Release held funds from company account to seller's wallet.
        Called when buyer confirms pickup.
        
        1. Deduct from company wallet_balance + total_held
        2. Add to seller wallet_balance
        3. Log transaction
        """
        try:
            import firebase_admin
            if firebase_admin._apps:
                from firebase_admin import firestore
                db = firestore.client()

                # Deduct from company account
                parts = self.company_doc_path.split("/")
                company_ref = db.collection(parts[0]).document(parts[1])
                company_ref.update({
                    "wallet_balance": firestore.Increment(-amount),
                    "total_held": firestore.Increment(-amount),
                })

                # Credit seller
                seller_ref = db.collection("users").document(seller_uid)
                seller_doc = seller_ref.get()
                if not seller_doc.exists:
                    return {"success": False, "message": "Seller not found."}

                seller_ref.update({
                    "wallet_balance": firestore.Increment(amount),
                    "updated_at": datetime.utcnow(),
                })

                new_balance = seller_doc.to_dict().get("wallet_balance", 0) + amount

                # Log transaction
                txn_ref = db.collection("transactions").document()
                txn_data = {
                    "type": "platform_to_seller",
                    "from_uid": "system",
                    "to_uid": seller_uid,
                    "amount": amount,
                    "order_id": order_id,
                    "timestamp": datetime.utcnow(),
                    "status": "success",
                }
                txn_ref.set(txn_data)

                return {
                    "success": True,
                    "transaction_id": txn_ref.id,
                    "message": f"₹{amount} credited to seller wallet.",
                    "seller_new_balance": new_balance,
                }
            else:
                return {
                    "success": True,
                    "transaction_id": f"dev_payout_{order_id}",
                    "message": f"[DEV MODE] ₹{amount} paid to seller.",
                    "seller_new_balance": 999,
                }
        except Exception as e:
            return {"success": False, "message": f"Payout failed: {str(e)}"}

    async def refund_buyer(
        self, buyer_uid: str, amount: float, order_id: str
    ) -> Dict[str, Any]:
        """
        Refund held funds from company account back to buyer's wallet.
        Called when a prepaid order is cancelled.
        
        1. Deduct from company wallet_balance + total_held
        2. Add to buyer wallet_balance
        3. Log transaction
        """
        try:
            import firebase_admin
            if firebase_admin._apps:
                from firebase_admin import firestore
                db = firestore.client()

                # Deduct from company
                parts = self.company_doc_path.split("/")
                company_ref = db.collection(parts[0]).document(parts[1])
                company_ref.update({
                    "wallet_balance": firestore.Increment(-amount),
                    "total_held": firestore.Increment(-amount),
                })

                # Credit buyer
                buyer_ref = db.collection("users").document(buyer_uid)
                buyer_ref.update({
                    "wallet_balance": firestore.Increment(amount),
                    "updated_at": datetime.utcnow(),
                })

                buyer_doc = buyer_ref.get()
                new_balance = buyer_doc.to_dict().get("wallet_balance", 0)

                # Log transaction
                txn_ref = db.collection("transactions").document()
                txn_data = {
                    "type": "platform_to_buyer",
                    "from_uid": "system",
                    "to_uid": buyer_uid,
                    "amount": amount,
                    "order_id": order_id,
                    "timestamp": datetime.utcnow(),
                    "status": "success",
                }
                txn_ref.set(txn_data)

                return {
                    "success": True,
                    "transaction_id": txn_ref.id,
                    "message": f"₹{amount} refunded to buyer wallet.",
                    "buyer_new_balance": new_balance,
                }
            else:
                return {
                    "success": True,
                    "transaction_id": f"dev_refund_{order_id}",
                    "message": f"[DEV MODE] ₹{amount} refunded.",
                    "buyer_new_balance": 999,
                }
        except Exception as e:
            return {"success": False, "message": f"Refund failed: {str(e)}"}

    # ── Query Helpers ─────────────────────────────────────────

    async def get_balance(self, uid: str) -> Dict[str, Any]:
        """Get a user's wallet balance and UPI ID."""
        try:
            import firebase_admin
            if firebase_admin._apps:
                from firebase_admin import firestore
                db = firestore.client()
                doc = db.collection("users").document(uid).get()
                if not doc.exists:
                    return {"uid": uid, "wallet_balance": 0, "upi_id": None}
                data = doc.to_dict()
                return {
                    "uid": uid,
                    "upi_id": data.get("upi_id"),
                    "wallet_balance": data.get("wallet_balance", 0),
                }
            else:
                return {"uid": uid, "upi_id": "dev.0000@sharemymeal", "wallet_balance": 1000}
        except Exception as e:
            return {"uid": uid, "wallet_balance": 0, "upi_id": None}

    async def get_transactions(self, uid: str, limit: int = 20):
        """Get recent transactions for a user (as buyer or seller)."""
        try:
            import firebase_admin
            if firebase_admin._apps:
                from firebase_admin import firestore
                db = firestore.client()

                # Transactions where user is sender
                sent = (
                    db.collection("transactions")
                    .where("from_uid", "==", uid)
                    .order_by("timestamp", direction=firestore.Query.DESCENDING)
                    .limit(limit)
                )

                # Transactions where user is receiver
                received = (
                    db.collection("transactions")
                    .where("to_uid", "==", uid)
                    .order_by("timestamp", direction=firestore.Query.DESCENDING)
                    .limit(limit)
                )

                txns = []
                for doc in sent.stream():
                    d = doc.to_dict()
                    d["id"] = doc.id
                    txns.append(d)
                for doc in received.stream():
                    d = doc.to_dict()
                    d["id"] = doc.id
                    txns.append(d)

                # Sort by timestamp descending
                txns.sort(key=lambda x: x.get("timestamp", datetime.min), reverse=True)
                return txns[:limit]
            else:
                return []
        except Exception:
            return []


# Singleton instance
wallet_service = WalletPaymentService()
