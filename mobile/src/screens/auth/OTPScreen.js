/**
 * ShareMyMeal — OTP Verification Screen
 * ==========================================
 * 6-digit OTP input with auto-focus, countdown timer,
 * and Firebase phone auth verification.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, StatusBar, Animated, Keyboard, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import { PrimaryButton } from '../../components/SharedComponents';
import { setupRecaptcha, sendOTP, cleanupRecaptcha } from '../../services/firebaseAuth';

const RECAPTCHA_ID = 'recaptcha-otp-resend';

const OTP_LENGTH = 6;

export default function OTPScreen({ route, navigation }) {
  const phone = route?.params?.phone || '+91XXXXXXXXXX';
  // confirmationResult from Firebase signInWithPhoneNumber (passed by PhoneEntryScreen)
  const confirmationResult = useRef(route?.params?.confirmationResult || null);
  const recaptchaVerifier = useRef(null);
  const [otp, setOtp] = useState(new Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    // Auto-focus first input
    setTimeout(() => inputRefs.current[0]?.focus(), 500);
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    } else {
      setCanResend(true);
    }
  }, [timer]);

  const handleOTPChange = (text, index) => {
    // Only allow digits
    if (text && !/^\d$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-focus next input
    if (text && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all digits entered
    if (newOtp.every((d) => d !== '') && newOtp.join('').length === OTP_LENGTH) {
      Keyboard.dismiss();
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyPress = (e, index) => {
    // Move to previous input on backspace if current is empty
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  const handleVerify = async (otpCode) => {
    if (!otpCode || otpCode.length !== OTP_LENGTH) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP.');
      return;
    }

    if (!confirmationResult.current) {
      Alert.alert('Session Expired', 'Please go back and request a new OTP.');
      return;
    }

    setLoading(true);
    try {
      const result = await confirmationResult.current.confirm(otpCode);
      const user = result.user;
      setLoading(false);
      navigation.replace('KYCVerification', { phone, uid: user.uid });
    } catch (error) {
      setLoading(false);
      console.error('OTP verify error:', error);
      if (error?.code === 'auth/invalid-verification-code') {
        Alert.alert('Wrong OTP', 'The code you entered is incorrect. Please try again.');
      } else if (error?.code === 'auth/code-expired') {
        Alert.alert('OTP Expired', 'This OTP has expired. Please request a new one.');
      } else {
        Alert.alert('Verification Failed', error.message || 'Invalid OTP. Please try again.');
      }
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    try {
      if (!recaptchaVerifier.current) {
        recaptchaVerifier.current = setupRecaptcha(RECAPTCHA_ID);
      }
      const newConfirmation = await sendOTP(phone, recaptchaVerifier.current);
      confirmationResult.current = newConfirmation;
      setTimer(30);
      setCanResend(false);
      setOtp(new Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      Alert.alert('OTP Resent', 'A new OTP has been sent to your number.');
    } catch (error) {
      console.error('Resend OTP error:', error);
      // Reset verifier for next attempt
      try { recaptchaVerifier.current = setupRecaptcha(RECAPTCHA_ID); } catch (_) {}
      Alert.alert('Error', error.message || 'Failed to resend OTP. Please try again.');
    }
  };

  const otpCode = otp.join('');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
      </TouchableOpacity>

      <Animated.View style={[styles.content, { opacity: fadeIn }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="chatbox-ellipses-outline" size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Verify your{'\n'}phone number</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to{' '}
            <Text style={styles.phoneText}>{phone}</Text>
          </Text>
        </View>

        {/* OTP Input Boxes */}
        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[
                styles.otpBox,
                digit && styles.otpBoxFilled,
                inputRefs.current[index]?.isFocused?.() && styles.otpBoxActive,
              ]}
              value={digit}
              onChangeText={(text) => handleOTPChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Resend Section */}
        <View style={styles.resendSection}>
          {canResend ? (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendActive}>Resend OTP</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.resendTimer}>
              Resend in <Text style={styles.timerHighlight}>{timer}s</Text>
            </Text>
          )}
        </View>
      </Animated.View>

      {/* Verify Button */}
      <View style={styles.bottomCTA}>
        <PrimaryButton
          title="Verify OTP"
          icon="checkmark-circle"
          onPress={() => handleVerify(otpCode)}
          loading={loading}
          disabled={otpCode.length !== OTP_LENGTH}
        />
      </View>

      {/* Hidden reCAPTCHA container for OTP resend */}
      {Platform.OS === 'web' && (
        <div id={RECAPTCHA_ID} style={{ position: 'absolute', bottom: 0, opacity: 0, pointerEvents: 'none' }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: SPACING.lg,
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: 120,
  },
  header: {
    marginBottom: SPACING.xxxl,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONTS.size.xxxl,
    fontWeight: '800',
    color: COLORS.textPrimary,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: FONTS.size.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    lineHeight: 22,
  },
  phoneText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  otpBox: {
    width: 50,
    height: 58,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    textAlign: 'center',
    fontSize: FONTS.size.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  otpBoxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  otpBoxActive: {
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  resendSection: {
    alignItems: 'center',
  },
  resendTimer: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.md,
  },
  timerHighlight: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  resendActive: {
    color: COLORS.primary,
    fontSize: FONTS.size.md,
    fontWeight: '700',
  },
  bottomCTA: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 40,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
