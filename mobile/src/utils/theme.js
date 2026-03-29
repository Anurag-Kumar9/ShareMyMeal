/**
 * ShareMyMeal — Design Theme
 * ============================
 * Central design system: colors, typography, spacing, shadows.
 * Premium, modern aesthetic inspired by top food delivery apps.
 */

export const COLORS = {
  // Primary Brand Colors — Warm orange gradient
  primary: '#FF6B35',
  primaryDark: '#E85D2C',
  primaryLight: '#FF8F65',
  primaryGradientStart: '#FF6B35',
  primaryGradientEnd: '#FF8F65',

  // Secondary — Deep teal for trust/reliability
  secondary: '#1B998B',
  secondaryDark: '#158275',
  secondaryLight: '#2ECFBC',

  // Accent — Golden yellow for highlights
  accent: '#FFD166',
  accentDark: '#F0C040',

  // Backgrounds
  background: '#0F0F14',        // Deep dark background
  backgroundAlt: '#1A1A24',     // Slightly lighter cards
  backgroundCard: '#22222E',    // Card backgrounds
  backgroundElevated: '#2A2A38', // Elevated surfaces
  surface: '#2E2E3E',           // Input fields, modals

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B8',
  textMuted: '#6B6B80',
  textOnPrimary: '#FFFFFF',
  textDark: '#1A1A2E',         // Dark text on light backgrounds

  // Status Colors
  success: '#06D6A0',
  successLight: '#0AE8AF20',
  warning: '#FFD166',
  warningLight: '#FFD16620',
  error: '#EF476F',
  errorLight: '#EF476F20',
  info: '#118AB2',

  // Order Status Colors
  statusPlaced: '#7B68EE',      // Medium slate blue
  statusAccepted: '#118AB2',    // Info blue
  statusCooking: '#FF6B35',     // Primary orange
  statusReady: '#06D6A0',       // Green
  statusPickedUp: '#1B998B',    // Teal
  statusCompleted: '#06D6A0',   // Success green
  statusCancelled: '#EF476F',   // Red
  statusRejected: '#EF476F',    // Red

  // Misc
  border: '#33334B',
  divider: '#2A2A3A',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shimmer: '#33334B',
  star: '#FFD166',

  // White with opacity (for glassmorphism effects)
  white05: 'rgba(255, 255, 255, 0.05)',
  white10: 'rgba(255, 255, 255, 0.1)',
  white15: 'rgba(255, 255, 255, 0.15)',
  white20: 'rgba(255, 255, 255, 0.2)',
  white40: 'rgba(255, 255, 255, 0.4)',
};

export const FONTS = {
  // We'll use system fonts with fallbacks
  // Can swap to Google Fonts (Inter, Outfit) via expo-font later
  regular: 'System',
  medium: 'System',
  semiBold: 'System',
  bold: 'System',

  size: {
    xs: 10,
    sm: 12,
    md: 14,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 30,
    hero: 36,
    display: 42,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  section: 48,
};

export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
};

export default { COLORS, FONTS, SPACING, RADIUS, SHADOWS };
