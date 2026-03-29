/**
 * ShareMyMeal — Splash Screen
 * ================================
 * Beautiful animated splash screen with logo and loading indicator.
 * Checks Firebase auth session and routes accordingly:
 *   - If logged in → MainApp
 *   - If not → Welcome
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { authAPI } from '../../services/api';
import { COLORS, FONTS, SPACING } from '../../utils/theme';

export default function SplashScreen({ navigation }) {
  // Animation values
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate logo appearance
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Check auth state after splash animation
    const timer = setTimeout(() => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          // User is logged in — check if profile exists in Firestore
          try {
            await authAPI.getProfile(user.uid);
            // Profile exists — go to main app
            navigation.replace('MainApp');
          } catch (e) {
            // Profile not found — user completed auth but not ProfileSetup
            navigation.replace('ProfileSetup', {
              uid: user.uid,
              phone: user.phoneNumber || '',
            });
          }
        } else {
          // Not logged in — show welcome/registration
          navigation.replace('Welcome');
        }
      });
      // Clean up the listener after first check
      return () => unsubscribe();
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Decorative background circles */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      {/* Animated Logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{ scale: logoScale }],
            opacity: logoOpacity,
          },
        ]}
      >
        <View style={styles.logoInner}>
          <Ionicons name="restaurant" size={48} color={COLORS.textOnPrimary} />
        </View>
      </Animated.View>

      {/* App Name */}
      <Animated.Text style={[styles.appName, { opacity: textOpacity }]}>
        Share<Text style={styles.appNameHighlight}>My</Text>Meal
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: subtitleOpacity }]}>
        Home-cooked goodness, next door
      </Animated.Text>

      {/* Loading dots */}
      <View style={styles.loadingContainer}>
        <View style={[styles.loadingDot, { backgroundColor: COLORS.primary }]} />
        <View style={[styles.loadingDot, { backgroundColor: COLORS.primaryLight, marginHorizontal: 8 }]} />
        <View style={[styles.loadingDot, { backgroundColor: COLORS.accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.primary,
    opacity: 0.05,
    top: -50,
    right: -80,
  },
  bgCircle2: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: COLORS.secondary,
    opacity: 0.05,
    bottom: -30,
    left: -60,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 35,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  logoInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: FONTS.size.display,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -1,
  },
  appNameHighlight: {
    color: COLORS.primary,
  },
  tagline: {
    fontSize: FONTS.size.base,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 80,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
