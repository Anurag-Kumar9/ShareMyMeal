# ShareMyMeal — Implementation Plan

A hyperlocal peer-to-peer food marketplace where neighbors post home-cooked food for sale and nearby users discover & order it. No delivery charges, no middleman — seller sets pickup location, buyer collects.

## User Review Required

> [!IMPORTANT]
> **API Keys & Services You Need to Set Up Before We Start Building:**
> 1. **Firebase Project** — Create at [console.firebase.google.com](https://console.firebase.google.com). Enable: Authentication (Phone), Firestore, Storage, Cloud Messaging.
> 2. **Google Maps API Key** — Enable Maps SDK for Android/iOS + Distance Matrix API at [console.cloud.google.com](https://console.cloud.google.com).
> 3. **Razorpay Account** — Sign up at [razorpay.com](https://razorpay.com). Get `key_id` and `key_secret`. Enable Razorpay Route for escrow/marketplace payouts.
> 4. **Digio / IDfy Account** — Sign up at [digio.in](https://www.digio.in) or [idfy.com](https://idfy.com) for Aadhaar eKYC API credentials (`client_id`, `client_secret`).
> 5. **Firebase Service Account JSON** — Download from Firebase Console → Project Settings → Service Accounts → Generate New Private Key. Place as `backend/firebase-service-account.json`.

> [!WARNING]
> **Razorpay Route (Escrow/Hold-Release)** requires a registered business entity. If you're testing, Razorpay Test Mode works for all payment flows, but Route payouts require activation by Razorpay team. For development, we'll build the full flow but you'll test with mock responses until Route is activated.

> [!CAUTION]
> **Aadhaar eKYC** requires an AUA (Authentication User Agency) license or partnership with a licensed KYC provider (Digio/IDfy/Signzy). For development, we'll integrate the Digio sandbox API. Production requires a paid agreement with the KYC provider.

---

## Project Structure

```
D:\ShareMyMeal\
├── backend/                    # FastAPI server
│   ├── app/
│   │   ├── main.py             # FastAPI app entry point
│   │   ├── config.py           # Settings, env loading
│   │   ├── firebase_admin.py   # Firebase Admin SDK init
│   │   ├── routers/
│   │   │   ├── auth.py         # Auth & KYC routes
│   │   │   ├── listings.py     # Food listing CRUD
│   │   │   ├── orders.py       # Order management
│   │   │   ├── payments.py     # Razorpay webhooks & payouts
│   │   │   ├── ratings.py      # Rating & review routes
│   │   │   └── notifications.py # FCM push notification triggers
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── listing.py
│   │   │   ├── order.py
│   │   │   └── payment.py
│   │   ├── services/
│   │   │   ├── kyc_service.py      # Digio/IDfy integration
│   │   │   ├── payment_service.py  # Razorpay Route logic
│   │   │   ├── notification_service.py # FCM sender
│   │   │   └── location_service.py # Geohash utilities
│   │   └── utils/
│   │       ├── geohash.py          # Geohash encoding/decoding
│   │       └── validators.py       # Input validation helpers
│   ├── requirements.txt
│   ├── .env
│   └── firebase-service-account.json  # (gitignored)
│
├── mobile/                     # React Native (Expo) app
│   ├── App.js
│   ├── app.json
│   ├── package.json
│   ├── src/
│   │   ├── config/
│   │   │   └── firebase.js     # Firebase client init
│   │   ├── navigation/
│   │   │   └── AppNavigator.js # React Navigation setup
│   │   ├── screens/
│   │   │   ├── auth/           # Splash, Welcome, OTP, KYC, ProfileSetup
│   │   │   ├── home/           # Dashboard, EmptyState, ListingDetail
│   │   │   ├── orders/         # OrderPlacement, Confirmation, Tracking, MyOrders
│   │   │   ├── seller/         # PostMeal, MyListings, IncomingOrders
│   │   │   ├── chat/           # ChatScreen
│   │   │   ├── profile/        # MyProfile, SellerProfile, Settings
│   │   │   └── notifications/  # NotificationsScreen
│   │   ├── components/         # Reusable UI components
│   │   ├── services/           # API calls, Firebase helpers
│   │   ├── hooks/              # Custom React hooks
│   │   ├── utils/              # Helpers, constants
│   │   └── assets/             # Images, fonts, icons
│   └── .env
│
└── .gitignore
```

---

## Proposed Changes — Phased Build

### Phase 1: Project Scaffolding & Config

#### [NEW] Project root setup
- Create monorepo directory layout
- Create root `.gitignore`

#### [NEW] `backend/.env`
```env
# Firebase
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# Digio eKYC (Aadhaar OTP Verification)
DIGIO_CLIENT_ID=your_digio_client_id
DIGIO_CLIENT_SECRET=your_digio_client_secret
DIGIO_BASE_URL=https://api.digio.in     # Use https://ext.digio.in for sandbox

# Razorpay Payments
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Google Maps
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Server
HOST=0.0.0.0
PORT=8000
DEBUG=true
```

#### [NEW] `mobile/.env`
```env
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
API_BASE_URL=http://192.168.x.x:8000   # Your local FastAPI server IP
```

---

### Phase 2: FastAPI Backend

#### [NEW] `backend/app/main.py`
- FastAPI app initialization, CORS, router includes, health check endpoint.

#### [NEW] `backend/app/config.py`
- Pydantic Settings class loading from `.env`.

#### [NEW] `backend/app/firebase_admin.py`
- Initialize Firebase Admin SDK using service account for Firestore, Auth, FCM.

#### [NEW] `backend/app/routers/auth.py`
- `POST /api/auth/verify-token` — Verify Firebase ID token from mobile app.
- `POST /api/auth/kyc/initiate` — Start Aadhaar eKYC via Digio API.
- `POST /api/auth/kyc/callback` — Webhook from Digio after KYC completion.
- `GET /api/auth/kyc/status/{uid}` — Check KYC verification status.

#### [NEW] `backend/app/routers/listings.py`
- `POST /api/listings` — Create a food listing (with geohash).
- `GET /api/listings/nearby` — Query listings by geohash range + distance.
- `PUT /api/listings/{id}` — Update listing (edit, sold out).
- `DELETE /api/listings/{id}` — Delete listing.
- `GET /api/listings/seller/{uid}` — Get seller's listings.

#### [NEW] `backend/app/routers/orders.py`
- `POST /api/orders` — Place order (creates Firestore doc + payment if prepaid).
- `PUT /api/orders/{id}/status` — Update order status (seller: accept → cooking → ready; buyer: picked_up).
- `GET /api/orders/buyer/{uid}` — Buyer's orders (active + history).
- `GET /api/orders/seller/{uid}` — Seller's incoming orders.
- `POST /api/orders/{id}/confirm-pickup` — Buyer confirms pickup → triggers payout.

#### [NEW] `backend/app/routers/payments.py`
- `POST /api/payments/create-order` — Create Razorpay order for prepaid/UPI.
- `POST /api/payments/webhook` — Razorpay webhook for payment confirmation.
- `POST /api/payments/payout/{order_id}` — Trigger payout to seller via Razorpay Route.
- `POST /api/payments/refund/{order_id}` — Refund buyer if order cancelled.

#### [NEW] `backend/app/routers/ratings.py`
- `POST /api/ratings` — Submit rating & review.
- `GET /api/ratings/seller/{uid}` — Get seller's ratings.

#### [NEW] `backend/app/routers/notifications.py`
- `POST /api/notifications/send` — Send FCM push notification.

#### [NEW] `backend/app/services/kyc_service.py`
- Digio API integration: initiate Aadhaar eKYC, verify OTP, parse callback.

#### [NEW] `backend/app/services/payment_service.py`
- Razorpay SDK: create order, verify signature, Route payout, refund.

#### [NEW] `backend/app/services/notification_service.py`
- FCM: send push notifications to specific device tokens or topics.

#### [NEW] `backend/app/services/location_service.py`
- Geohash encode/decode, neighbor geohash calculation for range queries.

---

### Phase 3: React Native (Expo) Frontend — Onboarding

#### [NEW] Expo project via `npx create-expo-app`
- Initialize with all dependencies: React Navigation, Firebase SDK, Maps, etc.

#### [NEW] `src/screens/auth/SplashScreen.js`
- App logo animation, check Firebase auth session, route accordingly.

#### [NEW] `src/screens/auth/WelcomeScreen.js`
- Hero illustration, app tagline, Sign Up / Log In buttons.

#### [NEW] `src/screens/auth/PhoneEntryScreen.js`
- Indian phone number input with +91, Firebase phone auth trigger.

#### [NEW] `src/screens/auth/OTPScreen.js`
- 6-digit OTP input with auto-read, verify with Firebase.

#### [NEW] `src/screens/auth/KYCScreen.js`
- Aadhaar eKYC flow: enter Aadhaar → OTP → verification status.

#### [NEW] `src/screens/auth/ProfileSetupScreen.js`
- Name, photo upload, role selection (Buyer/Seller/Both).

---

### Phase 4: Core App Screens

#### [NEW] `src/screens/home/DashboardScreen.js`
- Google Maps with listing pins, bottom sheet with listing cards, distance display.

#### [NEW] `src/screens/home/ListingDetailScreen.js`
- Sample photo, dish details, seller info, rating, payment modes, Order/Chat buttons.

#### [NEW] `src/screens/orders/OrderPlacementScreen.js`
- Quantity selector, payment mode picker, Razorpay sheet for prepaid.

#### [NEW] `src/screens/orders/OrderConfirmationScreen.js`
- Order summary, pickup location, estimated ready time.

#### [NEW] `src/screens/orders/OrderTrackingScreen.js`
- Vertical stepper: Placed → Accepted → Cooking → Ready → Picked Up.

#### [NEW] `src/screens/orders/MyOrdersScreen.js`
- Tabs: Active orders / Order history.

---

### Phase 5: Seller Screens

#### [NEW] `src/screens/seller/PostMealScreen.js`
- Form: dish name, description, sample photo, price, packets, pickup pin, time window, payment modes.

#### [NEW] `src/screens/seller/MyListingsScreen.js`
- Active/past listings with edit, sold out, delete options.

#### [NEW] `src/screens/seller/IncomingOrdersScreen.js`
- Real-time orders list, accept, update cooking stage, mark ready.

---

### Phase 6: Chat, Ratings, Profile

#### [NEW] `src/screens/chat/ChatScreen.js`
- Real-time Firestore chat per order thread.

#### [NEW] `src/screens/orders/RatingScreen.js`
- 1–5 stars + text review after pickup confirmation.

#### [NEW] `src/screens/profile/MyProfileScreen.js`
- Editable name, photo, badge, rating summary, meals sold.

#### [NEW] `src/screens/profile/SellerProfileScreen.js`
- Public seller view: rating, reviews, active listings.

#### [NEW] `src/screens/notifications/NotificationsScreen.js`
- Feed of alerts: new food nearby, order updates, chat messages, payments.

#### [NEW] `src/screens/profile/SettingsScreen.js`
- Notification prefs, search radius, payout UPI/bank, logout, delete account.

---

## Firebase Setup Instructions

### Step-by-step:
1. Go to [Firebase Console](https://console.firebase.google.com) → Create New Project → Name it "ShareMyMeal".
2. **Enable Authentication**: Authentication → Sign-in method → Enable "Phone".
3. **Create Firestore Database**: Firestore Database → Create Database → Start in Test Mode (for dev).
4. **Enable Storage**: Storage → Get Started → Start in Test Mode.
5. **Cloud Messaging**: Enabled by default. Get the Server Key from Project Settings → Cloud Messaging.
6. **Service Account**: Project Settings → Service Accounts → Generate New Private Key → Save as `backend/firebase-service-account.json`.
7. **Android App**: Project Settings → Add App → Android → Package name: `com.sharemymeal.app` → Download `google-services.json` → Place in `mobile/`.
8. **iOS App**: Project Settings → Add App → iOS → Bundle ID: `com.sharemymeal.app` → Download `GoogleService-Info.plist` → Place in `mobile/ios/`.

### Firestore Collections Schema:
- `users/{uid}` — name, phone, photo_url, role, verified, masked_aadhaar, rating, total_ratings, meals_sold, fcm_token, created_at
- `listings/{id}` — seller_uid, dish_name, description, sample_photo_url, price, packets_available, packets_sold, pickup_location (lat, lng), geohash, prep_time_start, prep_time_end, payment_modes[], status (active/expired/sold_out), created_at
- `orders/{id}` — buyer_uid, seller_uid, listing_id, quantity, total_price, payment_mode, payment_status, razorpay_order_id, status (placed/accepted/cooking/ready/picked_up/completed/cancelled), created_at
- `orders/{id}/chat/{msg_id}` — sender_uid, text, timestamp
- `ratings/{id}` — order_id, buyer_uid, seller_uid, stars, review_text, created_at

## Digio/IDfy eKYC Setup

1. Register at [digio.in](https://www.digio.in) as a business.
2. Get sandbox credentials (Client ID + Client Secret).
3. Use their Aadhaar eKYC API:
   - `POST /v2/client/kyc/request/with_digilocker` — Initiate KYC
   - Webhook callback to your `POST /api/auth/kyc/callback` with verification result
4. In production, sign agreement + get production credentials.

---

## Verification Plan

### Automated Tests
1. **Backend API Tests** — Run with `pytest`:
   ```bash
   cd D:\ShareMyMeal\backend
   .venv\Scripts\activate
   pytest tests/ -v
   ```
   Tests will cover: auth token verification, listing CRUD, order status transitions, payment service mocks, geohash calculations.

2. **React Native** — Run with Expo:
   ```bash
   cd D:\ShareMyMeal\mobile
   npx expo start
   ```
   Verify on Android emulator or physical device via Expo Go.

### Manual Verification (Module-by-Module)
After each phase, I will:
1. Start the FastAPI server (`uvicorn app.main:app --reload`) and test endpoints with built-in Swagger UI at `/docs`.
2. Start the Expo dev server and verify each screen renders correctly on a device/emulator.
3. Test the integrated flows (OTP → KYC → Dashboard → Order → Chat → Pickup → Rate).

### User Manual Testing
After core implementation, you should:
1. Install Expo Go on your Android phone.
2. Scan the QR code from `npx expo start`.
3. Walk through: Register → KYC → Browse listings → Place order → Chat → Confirm pickup → Rate.
