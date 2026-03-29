/**
 * ShareMyMeal — Phone Number Entry Screen
 * ===========================================
 * User enters their Indian mobile number.
 * Triggers Firebase phone auth to send OTP.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, TouchableOpacity, Alert, StatusBar, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../utils/theme';
import { PrimaryButton, InputField } from '../../components/SharedComponents';
import { setupRecaptcha, sendOTP, cleanupRecaptcha } from '../../services/firebaseAuth';

const RECAPTCHA_ID = 'recaptcha-phone-entry';

export default function PhoneEntryScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const recaptchaVerifier = useRef(null);
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    // Set up invisible reCAPTCHA on mount
    try {
      recaptchaVerifier.current = setupRecaptcha(RECAPTCHA_ID);
    } catch (err) {
      console.log('reCAPTCHA setup deferred:', err.message);
    }

    return () => cleanupRecaptcha(RECAPTCHA_ID);
  }, []);

  // Format phone number for display
  const formatPhone = (text) => {
    // Only allow digits
    const digits = text.replace(/\D/g, '');
    setPhone(digits.slice(0, 10));
  };

  const handleSendOTP = async () => {
    if (phone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      // Ensure reCAPTCHA is ready
      if (!recaptchaVerifier.current) {
        recaptchaVerifier.current = setupRecaptcha(RECAPTCHA_ID);
      }

      const fullPhone = `+91${phone}`;
      const confirmationResult = await sendOTP(fullPhone, recaptchaVerifier.current);

      setLoading(false);
      navigation.navigate('OTPVerification', {
        phone: fullPhone,
        confirmationResult: confirmationResult,
      });
    } catch (error) {
      setLoading(false);
      console.error('Send OTP error:', error);

      // Reset reCAPTCHA so user can retry
      try {
        recaptchaVerifier.current = setupRecaptcha(RECAPTCHA_ID);
      } catch (_) { /* ignore */ }

      const msg = error?.message || 'Failed to send OTP. Please try again.';
      if (msg.includes('too-many-requests')) {
        Alert.alert('Too Many Attempts', 'You have exceeded the SMS quota. Please try again later.');
      } else if (msg.includes('invalid-phone-number')) {
        Alert.alert('Invalid Number', 'Please check your phone number and try again.');
      } else {
        Alert.alert('Error', msg);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
      </TouchableOpacity>

      <Animated.View style={[styles.content, { opacity: fadeIn }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="phone-portrait-outline" size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Enter your{'\n'}mobile number</Text>
          <Text style={styles.subtitle}>
            We'll send you a 6-digit verification code via SMS
          </Text>
        </View>

        {/* Phone Input */}
        <View style={styles.phoneInputContainer}>
          <View style={styles.countryCode}>
            <Text style={styles.flag}>🇮🇳</Text>
            <Text style={styles.countryCodeText}>+91</Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
          </View>
          <View style={styles.phoneInput}>
            <InputField
              value={phone}
              onChangeText={formatPhone}
              placeholder="Enter 10-digit number"
              keyboardType="phone-pad"
              maxLength={10}
              style={{ marginBottom: 0 }}
            />
          </View>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark" size={20} color={COLORS.secondary} />
          <Text style={styles.infoText}>
            Your number is only used for authentication and will never be shared.
          </Text>
        </View>
      </Animated.View>

      {/* Bottom CTA */}
      <View style={styles.bottomCTA}>
        <PrimaryButton
          title="Send OTP"
          icon="arrow-forward"
          onPress={handleSendOTP}
          loading={loading}
          disabled={phone.length !== 10}
        />
      </View>

      {/* Hidden reCAPTCHA container — required by Firebase Phone Auth on web */}
      {Platform.OS === 'web' && (
        <div id={RECAPTCHA_ID} style={{ position: 'absolute', bottom: 0, opacity: 0, pointerEvents: 'none' }} />
      )}
    </KeyboardAvoidingView>
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
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.xl,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md + 4,
    marginRight: SPACING.sm,
  },
  flag: {
    fontSize: 20,
    marginRight: SPACING.xs,
  },
  countryCodeText: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size.base,
    fontWeight: '600',
    marginRight: SPACING.xs,
  },
  phoneInput: {
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary + '10',
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.secondary + '20',
  },
  infoText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    marginLeft: SPACING.md,
    lineHeight: 18,
  },
  bottomCTA: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 40,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
