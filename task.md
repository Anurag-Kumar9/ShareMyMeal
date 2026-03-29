# ShareMyMeal — Master Task List

## Phase 1: Project Setup & Infrastructure ✅
- [x] Monorepo layout + Python venv with `uv`
- [x] FastAPI backend: models, services, routers, main.py
- [x] Tested server startup on port 8000

## Phase 2: React Native Frontend — Setup & Onboarding ✅
- [x] Expo project initialized with all dependencies
- [x] Theme system, Firebase config, API service
- [x] Reusable SharedComponents library
- [x] Splash, Welcome, PhoneEntry, OTP, KYC, ProfileSetup screens

## Phase 3: Core App Screens & Navigation ✅
- [x] Dashboard (map + listings), ListingDetail (order placement)
- [x] OrderTracking (vertical stepper), MyOrders (tab view)
- [x] Chat, PostMeal (seller), RatingScreen
- [x] MyProfile screen
- [x] AppNavigator: Auth stack → Bottom tabs → Detail overlays
- [x] App.js entry point

## Phase 4: Additional Screens (future)
- [ ] Incoming Orders (seller-side management)
- [ ] My Listings (seller listing management)
- [ ] Seller Public Profile
- [ ] Full Notifications screen

## Phase 5: Integration & Polish
- [ ] Connect all screens to FastAPI backend
- [ ] Real Firebase Auth flow
- [ ] Image uploads to Firebase Storage
- [ ] End-to-end order flow test

## Phase 6: Production Readiness
- [ ] Error boundaries and offline handling
- [ ] App icon, splash screen assets
- [ ] Performance optimization
