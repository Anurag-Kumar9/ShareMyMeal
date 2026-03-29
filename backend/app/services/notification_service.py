"""
ShareMyMeal — Notification Service
=====================================
Sends push notifications via Firebase Cloud Messaging (FCM).
Used for: new food nearby alerts, order status changes, chat messages,
payment confirmations, and pickup reminders.
"""

from typing import Optional, Dict, List, Any
import firebase_admin


class NotificationService:
    """Service for sending push notifications via FCM."""

    async def send_to_device(
        self,
        fcm_token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Send a push notification to a specific device.

        Args:
            fcm_token: Target device's FCM registration token
            title: Notification title
            body: Notification body text
            data: Optional payload data (key-value pairs, all strings)

        Returns:
            Dict with send status
        """
        # Check if Firebase is initialized
        if not firebase_admin._apps:
            return {
                "status": "skipped",
                "message": "Firebase not initialized. Notification not sent.",
            }

        try:
            from firebase_admin import messaging

            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=data or {},
                token=fcm_token,
                # Android-specific config for priority
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        icon="ic_notification",
                        color="#FF6B35",  # ShareMyMeal brand orange
                        sound="default",
                    ),
                ),
            )

            response = messaging.send(message)
            return {
                "status": "sent",
                "message_id": response,
            }
        except Exception as e:
            return {
                "status": "failed",
                "message": f"FCM send failed: {str(e)}",
            }

    async def send_to_multiple_devices(
        self,
        fcm_tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Send a push notification to multiple devices at once.
        Used for notifying nearby users about new food listings.

        Args:
            fcm_tokens: List of target device FCM tokens
            title: Notification title
            body: Notification body text
            data: Optional payload data

        Returns:
            Dict with batch send status
        """
        if not firebase_admin._apps:
            return {
                "status": "skipped",
                "message": "Firebase not initialized.",
                "success_count": 0,
                "failure_count": 0,
            }

        if not fcm_tokens:
            return {
                "status": "skipped",
                "message": "No FCM tokens provided.",
                "success_count": 0,
                "failure_count": 0,
            }

        try:
            from firebase_admin import messaging

            message = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=data or {},
                tokens=fcm_tokens,
            )

            response = messaging.send_each_for_multicast(message)
            return {
                "status": "sent",
                "success_count": response.success_count,
                "failure_count": response.failure_count,
            }
        except Exception as e:
            return {
                "status": "failed",
                "message": f"FCM multicast failed: {str(e)}",
                "success_count": 0,
                "failure_count": len(fcm_tokens),
            }

    async def send_order_status_notification(
        self,
        fcm_token: str,
        order_id: str,
        new_status: str,
        dish_name: str,
    ) -> Dict[str, Any]:
        """
        Sends a user-friendly notification when an order status changes.
        Maps each status to an appropriate title and message.
        """
        # Status-to-message mapping
        messages = {
            "accepted": {
                "title": "Order Accepted! 🎉",
                "body": f"Your order for {dish_name} has been accepted by the seller.",
            },
            "rejected": {
                "title": "Order Declined 😔",
                "body": f"Sorry, the seller couldn't accept your order for {dish_name}.",
            },
            "cooking": {
                "title": "Cooking in Progress 🍳",
                "body": f"Your {dish_name} is being prepared! We'll notify you when it's ready.",
            },
            "ready": {
                "title": "Food is Ready! 🥘",
                "body": f"Your {dish_name} is ready for pickup. Head to the pickup location!",
            },
            "completed": {
                "title": "Order Complete ✅",
                "body": f"Enjoy your {dish_name}! Don't forget to rate the seller.",
            },
            "cancelled": {
                "title": "Order Cancelled ❌",
                "body": f"Your order for {dish_name} has been cancelled.",
            },
        }

        msg = messages.get(new_status, {
            "title": "Order Update",
            "body": f"Your order for {dish_name} has been updated.",
        })

        return await self.send_to_device(
            fcm_token=fcm_token,
            title=msg["title"],
            body=msg["body"],
            data={"order_id": order_id, "status": new_status, "type": "order_update"},
        )

    async def send_new_listing_alert(
        self,
        fcm_tokens: List[str],
        dish_name: str,
        seller_name: str,
        price: float,
        listing_id: str,
    ) -> Dict[str, Any]:
        """
        Notify nearby users that a new meal has been posted.
        """
        return await self.send_to_multiple_devices(
            fcm_tokens=fcm_tokens,
            title=f"🍽️ New Meal Nearby: {dish_name}",
            body=f"{seller_name} is cooking {dish_name} for ₹{price}/packet. Order now!",
            data={"listing_id": listing_id, "type": "new_listing"},
        )


# Singleton instance
notification_service = NotificationService()
