"""
ShareMyMeal — Notifications Router
======================================
Provides endpoints for sending push notifications via FCM.
Used by the backend to trigger notifications for order events,
new listings, and chat messages.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, List

from app.services.notification_service import notification_service

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


class SendNotificationRequest(BaseModel):
    """Request to send a push notification to a specific device."""
    fcm_token: str = Field(..., description="Target device's FCM token")
    title: str = Field(..., max_length=200)
    body: str = Field(..., max_length=500)
    data: Optional[Dict[str, str]] = None


class SendMulticastRequest(BaseModel):
    """Request to send notifications to multiple devices."""
    fcm_tokens: List[str] = Field(..., min_length=1)
    title: str = Field(..., max_length=200)
    body: str = Field(..., max_length=500)
    data: Optional[Dict[str, str]] = None


# ─────────────────────────────────────────────────────────────
# POST /api/notifications/send — Send to single device
# ─────────────────────────────────────────────────────────────
@router.post("/send", summary="Send push notification to a device")
async def send_notification(body: SendNotificationRequest):
    """Send a push notification to a specific device via FCM."""
    result = await notification_service.send_to_device(
        fcm_token=body.fcm_token,
        title=body.title,
        body=body.body,
        data=body.data,
    )
    return result


# ─────────────────────────────────────────────────────────────
# POST /api/notifications/send-multicast — Send to multiple devices
# ─────────────────────────────────────────────────────────────
@router.post("/send-multicast", summary="Send notification to multiple devices")
async def send_multicast_notification(body: SendMulticastRequest):
    """Send a push notification to multiple devices at once (e.g., nearby users)."""
    result = await notification_service.send_to_multiple_devices(
        fcm_tokens=body.fcm_tokens,
        title=body.title,
        body=body.body,
        data=body.data,
    )
    return result
