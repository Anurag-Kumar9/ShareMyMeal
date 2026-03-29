/**
 * ShareMyMeal — Firebase Client Configuration
 * ================================================
 * Initializes Firebase for the React Native mobile app.
 * Provides auth, firestore, and storage instances.
 *
 * Platform-aware auth initialization:
 *   - Web:    getAuth() → auto IndexedDB persistence
 *   - Mobile: initializeAuth() → AsyncStorage persistence
 */

import { Platform } from 'react-native';
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration
// Create a file: mobile/src/config/firebase.local.js (gitignored) with your real values
// Or set these via environment variables
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth — platform-aware persistence
let auth;
if (Platform.OS === 'web') {
  // Web: uses IndexedDB persistence automatically
  auth = getAuth(app);
} else {
  // Mobile: use AsyncStorage to persist auth state between app restarts
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

// Initialize Firestore database
const db = getFirestore(app);

// Initialize Firebase Storage for images
const storage = getStorage(app);

export { app, auth, db, storage };
export default app;
