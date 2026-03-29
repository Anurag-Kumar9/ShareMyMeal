/**
 * ShareMyMeal — Firebase Phone Auth Service
 * =============================================
 * Centralized helpers for phone OTP authentication.
 *
 * Platform-aware:
 *   - Web:    RecaptchaVerifier + signInWithPhoneNumber (DOM required)
 *   - Mobile: appVerificationDisabledForTesting + signInWithPhoneNumber
 *             (works with Firebase test phone numbers configured in Console)
 */

import { Platform } from 'react-native';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../config/firebase';

// ── Mobile: Enable test-mode verification ─────────────────
// Firebase allows bypassing reCAPTCHA when test phone numbers
// are configured in Console → Authentication → Phone → Test numbers.
// This is the official approach for React Native (no DOM available).
if (Platform.OS !== 'web') {
  auth.settings.appVerificationDisabledForTesting = true;
}

/**
 * Set up an invisible reCAPTCHA verifier on a DOM element.
 * Only functional on web — returns null on mobile.
 *
 * @param {string} containerId — the id of a <div> in your component
 * @returns {RecaptchaVerifier|null}
 */
export function setupRecaptcha(containerId) {
  if (Platform.OS !== 'web') {
    // No DOM on mobile — reCAPTCHA not needed (test mode enabled above)
    return null;
  }

  // Clear any existing verifier on that container
  const existing = window.recaptchaVerifiers?.[containerId];
  if (existing) {
    try { existing.clear(); } catch (_) { /* ignore */ }
  }

  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved — will proceed with signInWithPhoneNumber
      console.log('reCAPTCHA verified');
    },
    'expired-callback': () => {
      console.log('reCAPTCHA expired — user must re-trigger');
    },
  });

  // Keep a global reference so we can clean up later
  if (!window.recaptchaVerifiers) window.recaptchaVerifiers = {};
  window.recaptchaVerifiers[containerId] = verifier;

  return verifier;
}

/**
 * Send an OTP to the given phone number.
 *
 * @param {string} phoneNumber — full international format, e.g. "+919876543210"
 * @param {RecaptchaVerifier|null} recaptchaVerifier — required on web, null on mobile
 * @returns {Promise<import('firebase/auth').ConfirmationResult>}
 */
export async function sendOTP(phoneNumber, recaptchaVerifier) {
  if (Platform.OS !== 'web') {
    // Mobile: Firebase SDK still requires a verifier object with type 'recaptcha'
    // even when appVerificationDisabledForTesting is true (the internal fallback
    // path asserts verifier?.type === 'recaptcha'). This mock satisfies that check.
    const mockVerifier = {
      type: 'recaptcha',
      verify: () => Promise.resolve('mock-recaptcha-token'),
      _reset: () => {},
    };
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, mockVerifier);
    return confirmationResult;
  }
  // Web: reCAPTCHA verifier required
  const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
  return confirmationResult;
}

/**
 * Verify the OTP code entered by the user.
 *
 * @param {import('firebase/auth').ConfirmationResult} confirmationResult
 * @param {string} otpCode — the 6-digit code
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function verifyOTP(confirmationResult, otpCode) {
  const result = await confirmationResult.confirm(otpCode);
  return result;
}

/**
 * Clean up a reCAPTCHA verifier (call on unmount).
 * No-op on mobile.
 *
 * @param {string} containerId
 */
export function cleanupRecaptcha(containerId) {
  if (Platform.OS !== 'web') return;

  const existing = window.recaptchaVerifiers?.[containerId];
  if (existing) {
    try { existing.clear(); } catch (_) { /* ignore */ }
    delete window.recaptchaVerifiers[containerId];
  }
}

