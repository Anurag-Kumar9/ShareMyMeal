/**
 * ShareMyMeal — Welcome Screen
 * ================================
 * Hero screen with app introduction, features preview,
 * and Sign Up / Log In buttons.
 */

import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Animated, Dimensions, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../utils/theme';
import { PrimaryButton, SecondaryButton } from '../../components/SharedComponents';

const { width } = Dimensions.get('window');

// Feature cards data
const FEATURES = [
  {
    icon: 'restaurant-outline',
    title: 'Home-Cooked Meals',
    desc: 'Discover authentic food made by your neighbors',
    color: COLORS.primary,
  },
  {
    icon: 'location-outline',
    title: 'Hyperlocal Pickup',
    desc: 'No delivery charges — walk and collect',
    color: COLORS.secondary,
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Verified Neighbors',
    desc: 'All users verified via Aadhaar eKYC',
    color: COLORS.accent,
  },
  {
    icon: 'wallet-outline',
    title: 'Flexible Payments',
    desc: 'COD, UPI on delivery, or prepay online',
    color: COLORS.info,
  },
];

export default function WelcomeScreen({ navigation }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Background decorative elements */}
        <View style={styles.bgGradientTop} />

        {/* Hero Section */}
        <Animated.View
          style={[
            styles.heroSection,
            { opacity: fadeIn, transform: [{ translateY: slideUp }] },
          ]}
        >
          {/* Logo */}
          <View style={styles.logoRow}>
            <View style={styles.logoMini}>
              <Ionicons name="restaurant" size={24} color={COLORS.textOnPrimary} />
            </View>
            <Text style={styles.logoText}>
              Share<Text style={styles.logoHighlight}>My</Text>Meal
            </Text>
          </View>

          {/* Hero Title */}
          <Text style={styles.heroTitle}>
            Taste the love{'\n'}from next door
          </Text>
          <Text style={styles.heroSubtitle}>
            Your neighbors are cooking something amazing.
            Discover home-cooked meals near you — fresh, affordable,
            and just a walk away.
          </Text>
        </Animated.View>

        {/* Feature Cards */}
        <View style={styles.featuresGrid}>
          {FEATURES.map((feature, index) => (
            <Animated.View
              key={index}
              style={[
                styles.featureCard,
                {
                  opacity: fadeIn,
                  transform: [{
                    translateY: Animated.multiply(slideUp, new Animated.Value(1 + index * 0.2)),
                  }],
                },
              ]}
            >
              <View style={[styles.featureIcon, { backgroundColor: feature.color + '20' }]}>
                <Ionicons name={feature.icon} size={22} color={feature.color} />
              </View>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDesc}>{feature.desc}</Text>
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom CTA Section */}
      <View style={styles.ctaSection}>
        <PrimaryButton
          title="Get Started"
          icon="arrow-forward"
          onPress={() => navigation.navigate('PhoneEntry')}
          style={styles.ctaButton}
        />
        <Text style={styles.ctaFooter}>
          By continuing, you agree to our{' '}
          <Text style={styles.link}>Terms</Text> &{' '}
          <Text style={styles.link}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 180,
  },
  bgGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: COLORS.primary,
    opacity: 0.04,
    borderBottomLeftRadius: 80,
    borderBottomRightRadius: 80,
  },
  heroSection: {
    paddingHorizontal: SPACING.xl,
    paddingTop: 60,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  logoMini: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  logoText: {
    fontSize: FONTS.size.xxl,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  logoHighlight: {
    color: COLORS.primary,
  },
  heroTitle: {
    fontSize: FONTS.size.hero,
    fontWeight: '800',
    color: COLORS.textPrimary,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: FONTS.size.base,
    color: COLORS.textSecondary,
    lineHeight: 24,
    marginTop: SPACING.base,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.base,
    marginTop: SPACING.xxxl,
    justifyContent: 'space-between',
  },
  featureCard: {
    width: (width - SPACING.base * 2 - SPACING.sm) / 2,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  featureTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  featureDesc: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  ctaSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  ctaButton: {
    marginBottom: SPACING.md,
  },
  ctaFooter: {
    textAlign: 'center',
    fontSize: FONTS.size.xs,
    color: COLORS.textMuted,
  },
  link: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
