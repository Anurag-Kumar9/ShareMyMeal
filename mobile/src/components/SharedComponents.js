/**
 * ShareMyMeal — Reusable UI Components
 * ========================================
 * Premium, animated UI components used across all screens.
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../utils/theme';

// ── Primary Button ────────────────────────────────────────────
export const PrimaryButton = ({ title, onPress, loading, disabled, icon, style }) => (
  <TouchableOpacity
    style={[
      styles.primaryButton,
      SHADOWS.glow,
      disabled && styles.disabledButton,
      style,
    ]}
    onPress={onPress}
    disabled={disabled || loading}
    activeOpacity={0.8}
  >
    {loading ? (
      <ActivityIndicator color={COLORS.textOnPrimary} size="small" />
    ) : (
      <View style={styles.buttonContent}>
        {icon && <Ionicons name={icon} size={20} color={COLORS.textOnPrimary} style={{ marginRight: 8 }} />}
        <Text style={styles.primaryButtonText}>{title}</Text>
      </View>
    )}
  </TouchableOpacity>
);

// ── Secondary Button ──────────────────────────────────────────
export const SecondaryButton = ({ title, onPress, icon, style }) => (
  <TouchableOpacity
    style={[styles.secondaryButton, style]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.buttonContent}>
      {icon && <Ionicons name={icon} size={18} color={COLORS.primary} style={{ marginRight: 8 }} />}
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </View>
  </TouchableOpacity>
);

// ── Input Field ───────────────────────────────────────────────
export const InputField = ({
  label, value, onChangeText, placeholder, keyboardType,
  secureTextEntry, icon, maxLength, error, multiline, style,
}) => (
  <View style={[styles.inputContainer, style]}>
    {label && <Text style={styles.inputLabel}>{label}</Text>}
    <View style={[styles.inputWrapper, error && styles.inputError]}>
      {icon && (
        <Ionicons name={icon} size={20} color={COLORS.textMuted} style={styles.inputIcon} />
      )}
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType || 'default'}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
        multiline={multiline}
      />
    </View>
    {error && <Text style={styles.errorText}>{error}</Text>}
  </View>
);

// ── Badge Component ───────────────────────────────────────────
export const Badge = ({ text, color, icon }) => (
  <View style={[styles.badge, { backgroundColor: color + '20' }]}>
    {icon && <Ionicons name={icon} size={12} color={color} style={{ marginRight: 4 }} />}
    <Text style={[styles.badgeText, { color }]}>{text}</Text>
  </View>
);

// ── Star Rating Display ───────────────────────────────────────
export const StarRating = ({ rating, size = 16, showText = true }) => (
  <View style={styles.starContainer}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Ionicons
        key={star}
        name={star <= Math.round(rating) ? 'star' : 'star-outline'}
        size={size}
        color={COLORS.star}
        style={{ marginRight: 2 }}
      />
    ))}
    {showText && (
      <Text style={[styles.ratingText, { fontSize: size - 2 }]}>
        {rating?.toFixed(1) || '0.0'}
      </Text>
    )}
  </View>
);

// ── Interactive Star Rating (for rating submission) ───────────
export const StarRatingInput = ({ rating, onRate, size = 36 }) => (
  <View style={styles.starInputContainer}>
    {[1, 2, 3, 4, 5].map((star) => (
      <TouchableOpacity key={star} onPress={() => onRate(star)} activeOpacity={0.7}>
        <Ionicons
          name={star <= rating ? 'star' : 'star-outline'}
          size={size}
          color={COLORS.star}
          style={{ marginHorizontal: 4 }}
        />
      </TouchableOpacity>
    ))}
  </View>
);

// ── Card Component ────────────────────────────────────────────
export const Card = ({ children, style, onPress }) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[styles.card, SHADOWS.medium, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {children}
    </Wrapper>
  );
};

// ── Status Badge ──────────────────────────────────────────────
export const StatusBadge = ({ status }) => {
  const statusConfig = {
    placed: { label: 'Order Placed', color: COLORS.statusPlaced, icon: 'receipt-outline' },
    accepted: { label: 'Accepted', color: COLORS.statusAccepted, icon: 'checkmark-circle-outline' },
    cooking: { label: 'Cooking', color: COLORS.statusCooking, icon: 'flame-outline' },
    ready: { label: 'Ready for Pickup', color: COLORS.statusReady, icon: 'bag-check-outline' },
    picked_up: { label: 'Picked Up', color: COLORS.statusPickedUp, icon: 'walk-outline' },
    completed: { label: 'Completed', color: COLORS.statusCompleted, icon: 'checkmark-done-outline' },
    cancelled: { label: 'Cancelled', color: COLORS.statusCancelled, icon: 'close-circle-outline' },
    rejected: { label: 'Rejected', color: COLORS.statusRejected, icon: 'close-circle-outline' },
    active: { label: 'Active', color: COLORS.success, icon: 'radio-button-on' },
    expired: { label: 'Expired', color: COLORS.textMuted, icon: 'time-outline' },
    sold_out: { label: 'Sold Out', color: COLORS.error, icon: 'bag-remove-outline' },
  };

  const config = statusConfig[status] || { label: status, color: COLORS.textMuted, icon: 'ellipse' };

  return <Badge text={config.label} color={config.color} icon={config.icon} />;
};

// ── Empty State ───────────────────────────────────────────────
export const EmptyState = ({ icon, title, subtitle, actionTitle, onAction }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIconContainer}>
      <Ionicons name={icon || 'restaurant-outline'} size={60} color={COLORS.primary} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
    {actionTitle && onAction && (
      <PrimaryButton title={actionTitle} onPress={onAction} style={{ marginTop: SPACING.lg }} />
    )}
  </View>
);

// ── Loading Screen ────────────────────────────────────────────
export const LoadingScreen = ({ message }) => (
  <View style={styles.loadingScreen}>
    <ActivityIndicator size="large" color={COLORS.primary} />
    {message && <Text style={styles.loadingText}>{message}</Text>}
  </View>
);

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Primary Button
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md + 2,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: FONTS.size.base,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  disabledButton: {
    backgroundColor: COLORS.surface,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Secondary Button
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: FONTS.size.md,
    fontWeight: '600',
  },

  // Input Field
  inputContainer: {
    marginBottom: SPACING.base,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    marginBottom: SPACING.xs + 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.base,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONTS.size.base,
    paddingVertical: SPACING.md + 2,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: SPACING.md,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONTS.size.xs,
    marginTop: SPACING.xs,
  },

  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: FONTS.size.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Star Rating
  starContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginLeft: 4,
  },
  starInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Card
  card: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxxl,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.white10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.md,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 22,
  },

  // Loading
  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.md,
    marginTop: SPACING.base,
  },
});
