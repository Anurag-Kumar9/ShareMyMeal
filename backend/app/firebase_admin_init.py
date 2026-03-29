"""
ShareMyMeal Backend — Firebase Admin SDK Initialization
========================================================
Initializes the Firebase Admin SDK once at startup.
Provides helper functions to access Firestore, Auth, Storage, and FCM.
"""

import firebase_admin
from firebase_admin import credentials, firestore, auth, storage, messaging
from app.config import settings
import os


def init_firebase():
    """
    Initialize Firebase Admin SDK with service account credentials.
    This should be called once at application startup.
    """
    # Prevent re-initialization if already done
    if firebase_admin._apps:
        return

    sa_path = settings.firebase_service_account_path

    # Check if service account file exists
    if os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
        firebase_admin.initialize_app(cred, {
            "storageBucket": "sharemymeal-app.appspot.com",  # Update with your bucket
        })
        print("✅ Firebase Admin SDK initialized successfully.")
    else:
        # For development without credentials, use Application Default Credentials
        print(f"⚠️  Service account file not found at: {sa_path}")
        print("   Attempting to initialize with default credentials...")
        try:
            firebase_admin.initialize_app()
            print("✅ Firebase Admin SDK initialized with default credentials.")
        except Exception as e:
            print(f"❌ Firebase initialization failed: {e}")
            print("   The app will run but Firebase features will not work.")
            print("   Please provide a valid service account JSON file.")


def get_firestore_client():
    """Get the Firestore database client."""
    return firestore.client()


def get_auth():
    """Get the Firebase Auth instance."""
    return auth


def get_storage_bucket():
    """Get the Firebase Storage bucket."""
    return storage.bucket()


def get_messaging():
    """Get the Firebase Cloud Messaging instance."""
    return messaging
