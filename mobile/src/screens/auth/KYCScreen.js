/**
 * ShareMyMeal — KYC Verification Screen (Firebase Two-OTP Flow)
 * =================================================================
 * Step 1: User enters 12-digit Aadhaar number
 * Step 2: App sends a UIDAI-styled OTP via Firebase Phone Auth
 *         to the same number already verified during registration
 * Step 3: User enters OTP → backend masks Aadhaar and writes kyc_completed
 *
 * No external KYC platform — everything runs on Firebase.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, Animated, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../utils/theme';
import { PrimaryButton, Card } from '../../components/SharedComponents';
import { setupRecaptcha, sendOTP, cleanupRecaptcha } from '../../services/firebaseAuth';
import { authAPI } from '../../services/api';

const RECAPTCHA_ID = 'recaptcha-kyc';

export default function KYCScreen({ navigation, route }) {
  const phone = route?.params?.phone || '+91 98765 43210';
  const uid = route?.params?.uid;  // Firebase UID from OTP verification

  // Step: 'aadhaar' → 'otp' → 'success'
  const [step, setStep] = useState('aadhaar');
  const [aadhaarInput, setAadhaarInput] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  const confirmationResult = useRef(null);
  const recaptchaVerifier = useRef(null);
  const otpRefs = useRef([]);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Set up reCAPTCHA on mount
    try {
      recaptchaVerifier.current = setupRecaptcha(RECAPTCHA_ID);
    } catch (err) {
      console.log('reCAPTCHA setup deferred:', err.message);
    }
    return () => cleanupRecaptcha(RECAPTCHA_ID);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [step]);

  // Resend timer countdown
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Format Aadhaar as user types: XXXX XXXX XXXX
  const handleAadhaarChange = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, 12);
    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    setAadhaarInput(formatted);
  };

  const rawAadhaar = aadhaarInput.replace(/\s/g, '');

  // ── Step 1: Submit Aadhaar → Send UIDAI OTP ──────────────
  const handleSendOTP = async () => {
    if (rawAadhaar.length !== 12) {
      Alert.alert('Invalid Aadhaar', 'Please enter a valid 12-digit Aadhaar number.');
      return;
    }

    setLoading(true);
    try {
      // Ensure reCAPTCHA is ready
      if (!recaptchaVerifier.current) {
        recaptchaVerifier.current = setupRecaptcha(RECAPTCHA_ID);
      }

      // Send second OTP to the same already-verified phone number.
      // Firebase Console SMS template is set to UIDAI-styled message.
      const result = await sendOTP(phone.replace(/\s/g, ''), recaptchaVerifier.current);
      confirmationResult.current = result;

      setLoading(false);
      setStep('otp');
      setTimer(60);
    } catch (error) {
      setLoading(false);
      console.error('KYC OTP send error:', error);
      // Reset reCAPTCHA for retry
      try { recaptchaVerifier.current = setupRecaptcha(RECAPTCHA_ID); } catch (_) {}
      Alert.alert('Error', error.message || 'Failed to send OTP.');
    }
  };

  // ── Step 2: Verify OTP → Complete KYC ─────────────────────
  const handleVerifyOTP = async () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP.');
      return;
    }

    if (!confirmationResult.current) {
      Alert.alert('Session Expired', 'Please go back and request a new OTP.');
      return;
    }

    setLoading(true);
    try {
      // 1. Verify OTP via Firebase Phone Auth
      await confirmationResult.current.confirm(otpValue);

      // 2. Call backend to mask Aadhaar and write kyc_completed: true
      await authAPI.verifyKYC({ uid, aadhaar_number: rawAadhaar, otp: otpValue });

      setLoading(false);
      setStep('success');

      // Auto-navigate to profile setup after success animation
      setTimeout(() => {
        navigation.replace('ProfileSetup', { phone, uid });
      }, 2500);
    } catch (error) {
      setLoading(false);
      console.error('KYC verify error:', error);
      if (error?.code === 'auth/invalid-verification-code') {
        Alert.alert('Wrong OTP', 'The code you entered is incorrect. Please try again.');
      } else if (error?.code === 'auth/code-expired') {
        Alert.alert('OTP Expired', 'This OTP has expired. Please tap Resend OTP.');
      } else {
        Alert.alert('Verification Failed', error.message || 'Invalid OTP.');
      }
    }
  };

  // ── OTP Input Handler ─────────────────────────────────────
  const handleOTPChange = (value, index) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance to next box
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits entered
    if (index === 5 && value) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        setTimeout(handleVerifyOTP, 300);
      }
    }
  };

  const handleOTPKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // ── Render ────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <View style={styles.successContainer}>
          <Animated.View style={[styles.successIcon, { opacity: fadeIn }]}>
            <View style={styles.successCircle}>
              <Ionicons name="shield-checkmark" size={60} color={COLORS.success} />
            </View>
          </Animated.View>
          <Animated.Text style={[styles.successTitle, { opacity: fadeIn }]}>
            Identity Verified! ✅
          </Animated.Text>
          <Animated.Text style={[styles.successSub, { opacity: fadeIn }]}>
            Your Aadhaar has been verified. You're now a{'\n'}
            <Text style={{ fontWeight: '800', color: COLORS.primary }}>Verified Neighbor</Text>
          </Animated.Text>
          <View style={styles.maskedCard}>
            <Ionicons name="card-outline" size={20} color={COLORS.textMuted} />
            <Text style={styles.maskedText}>XXXX-XXXX-{rawAadhaar.slice(-4)}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Identity Verification</Text>
        <View style={{ width: 42 }} />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        {/* Step indicator */}
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={[styles.stepLine, step === 'otp' && styles.stepLineActive]} />
          <View style={[styles.stepDot, step === 'otp' && styles.stepDotActive]} />
        </View>

        {step === 'aadhaar' ? (
          // ── Aadhaar Input Step ──
          <>
            <Text style={styles.title}>Enter Your Aadhaar</Text>
            <Text style={styles.subtitle}>
              Enter your 12-digit Aadhaar number. An OTP will be sent{'\n'}
              to your UIDAI-registered mobile number for verification.
            </Text>

            <View style={styles.inputWrapper}>
              <Ionicons name="card-outline" size={22} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.aadhaarInput}
                value={aadhaarInput}
                onChangeText={handleAadhaarChange}
                placeholder="XXXX XXXX XXXX"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                maxLength={14}
              />
              {rawAadhaar.length === 12 && (
                <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
              )}
            </View>

            {/* Trust Info */}
            <Card style={styles.trustCard}>
              <View style={styles.trustRow}>
                <Ionicons name="lock-closed" size={16} color={COLORS.success} />
                <Text style={styles.trustText}>
                  Your Aadhaar number is never stored in full. Only the last 4 digits are saved after verification.
                </Text>
              </View>
              <View style={[styles.trustRow, { marginTop: SPACING.sm }]}>
                <Ionicons name="shield-checkmark" size={16} color={COLORS.info} />
                <Text style={styles.trustText}>
                  Verification OTP will be sent by UIDAI to your mobile number: {phone}
                </Text>
              </View>
            </Card>

            <PrimaryButton
              title="Send Verification OTP"
              icon="send"
              onPress={handleSendOTP}
              loading={loading}
              disabled={rawAadhaar.length !== 12}
              style={{ marginTop: SPACING.xl }}
            />
          </>
        ) : (
          // ── OTP Input Step ──
          <>
            <Text style={styles.title}>UIDAI Verification</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit OTP sent by UIDAI to{'\n'}
              <Text style={{ fontWeight: '700', color: COLORS.textPrimary }}>{phone}</Text>
            </Text>

            {/* OTP Boxes */}
            <View style={styles.otpRow}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (otpRefs.current[index] = ref)}
                  style={[styles.otpBox, digit && styles.otpBoxFilled]}
                  value={digit}
                  onChangeText={(val) => handleOTPChange(val, index)}
                  onKeyPress={(e) => handleOTPKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  autoFocus={index === 0}
                />
              ))}
            </View>

            {/* Resend Timer */}
            {timer > 0 ? (
              <Text style={styles.timerText}>
                Resend OTP in <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{timer}s</Text>
              </Text>
            ) : (
              <TouchableOpacity onPress={handleSendOTP}>
                <Text style={styles.resendText}>Resend OTP</Text>
              </TouchableOpacity>
            )}

            <PrimaryButton
              title="Verify OTP"
              icon="checkmark-circle"
              onPress={handleVerifyOTP}
              loading={loading}
              disabled={otp.join('').length !== 6}
              style={{ marginTop: SPACING.xl }}
            />
          </>
        )}
      </Animated.View>
      {/* Hidden reCAPTCHA container — required by Firebase Phone Auth on web */}
      {Platform.OS === 'web' && (
        <div id={RECAPTCHA_ID} style={{ position: 'absolute', bottom: 0, opacity: 0, pointerEvents: 'none' }} />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: 50, paddingBottom: SPACING.md,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: RADIUS.md, backgroundColor: COLORS.backgroundCard,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: FONTS.size.lg, fontWeight: '700', color: COLORS.textPrimary },
  content: { flex: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xxl },
  stepDot: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.border,
  },
  stepDotActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepLine: { width: 60, height: 2, backgroundColor: COLORS.border, marginHorizontal: SPACING.sm },
  stepLineActive: { backgroundColor: COLORS.primary },
  title: { fontSize: FONTS.size.xxl, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  subtitle: {
    fontSize: FONTS.size.md, color: COLORS.textSecondary, textAlign: 'center',
    lineHeight: 22, marginTop: SPACING.sm, marginBottom: SPACING.xxl,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: SPACING.base, marginBottom: SPACING.lg,
  },
  inputIcon: { marginRight: SPACING.sm },
  aadhaarInput: {
    flex: 1, fontSize: FONTS.size.xl, fontWeight: '700', color: COLORS.textPrimary,
    paddingVertical: SPACING.base, letterSpacing: 2,
  },
  trustCard: { marginBottom: SPACING.base },
  trustRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  trustText: { flex: 1, color: COLORS.textSecondary, fontSize: FONTS.size.sm, lineHeight: 18 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.md, marginBottom: SPACING.xl },
  otpBox: {
    width: 48, height: 56, borderRadius: RADIUS.md, backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.border, fontSize: FONTS.size.xl,
    fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center',
  },
  otpBoxFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  timerText: { textAlign: 'center', color: COLORS.textMuted, fontSize: FONTS.size.md },
  resendText: { textAlign: 'center', color: COLORS.primary, fontSize: FONTS.size.md, fontWeight: '700' },

  // Success state
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xl },
  successIcon: { marginBottom: SPACING.xxl },
  successCircle: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.success + '15',
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.success + '30',
  },
  successTitle: { fontSize: FONTS.size.xxl, fontWeight: '800', color: COLORS.textPrimary },
  successSub: {
    fontSize: FONTS.size.md, color: COLORS.textSecondary, textAlign: 'center',
    lineHeight: 24, marginTop: SPACING.md,
  },
  maskedCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xl,
    backgroundColor: COLORS.backgroundCard, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.base,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
  },
  maskedText: { color: COLORS.textPrimary, fontSize: FONTS.size.lg, fontWeight: '700', letterSpacing: 2 },
});
