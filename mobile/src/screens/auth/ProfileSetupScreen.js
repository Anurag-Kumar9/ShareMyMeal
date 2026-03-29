/**
 * ShareMyMeal — Profile Setup Screen
 * ======================================
 * After KYC, user sets up their profile:
 *   - Photo (optional), Name, Role (Buyer/Seller/Both)
 * On submit, backend auto-generates UPI ID + wallet balance.
 * Shows the generated UPI ID and wallet balance on success.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Image, Alert, StatusBar, Animated, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { auth } from '../../config/firebase';
import { authAPI } from '../../services/api';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../utils/theme';
import { PrimaryButton, Card } from '../../components/SharedComponents';

const ROLES = [
  { id: 'buyer', label: '🛒 Buyer', desc: 'Order homemade food from neighbors' },
  { id: 'seller', label: '👨‍🍳 Seller', desc: 'Sell your home-cooked meals' },
  { id: 'both', label: '🔄 Both', desc: 'Buy and sell on the platform' },
];

export default function ProfileSetupScreen({ navigation, route }) {
  const phone = route?.params?.phone || '';
  const uid = route?.params?.uid || auth.currentUser?.uid;
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState(null);
  const [selectedRole, setSelectedRole] = useState('both');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [walletInfo, setWalletInfo] = useState(null);
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow photo access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your display name.');
      return;
    }

    setLoading(true);
    try {
      // Call backend to create profile (auto-generates UPI ID + wallet balance)
      const profileData = {
        uid: uid,
        phone: phone,
        display_name: name.trim(),
        role: selectedRole,
        photo_url: photo || null,
      };

      const response = await authAPI.createProfile(profileData);

      setLoading(false);
      setWalletInfo({
        upi_id: response.upi_id,
        wallet_balance: response.wallet_balance,
      });
      setShowSuccess(true);
    } catch (error) {
      setLoading(false);
      console.error('Profile setup error:', error);
      Alert.alert('Error', error.message || 'Failed to create profile.');
    }
  };

  // ── Success State: Show UPI ID + Wallet ───────────────────
  if (showSuccess && walletInfo) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="wallet" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.successTitle}>Welcome to ShareMyMeal! 🎉</Text>
          <Text style={styles.successSub}>
            Your profile is set up. Here's your wallet:
          </Text>

          {/* UPI ID Card */}
          <Card style={styles.walletCard}>
            <View style={styles.walletRow}>
              <Ionicons name="qr-code-outline" size={20} color={COLORS.primary} />
              <Text style={styles.walletLabel}>Your UPI ID</Text>
            </View>
            <Text style={styles.upiText}>{walletInfo.upi_id}</Text>
          </Card>

          {/* Wallet Balance Card */}
          <Card style={styles.walletCard}>
            <View style={styles.walletRow}>
              <Ionicons name="wallet-outline" size={20} color={COLORS.success} />
              <Text style={styles.walletLabel}>Wallet Balance</Text>
            </View>
            <Text style={styles.balanceText}>₹{walletInfo.wallet_balance.toLocaleString()}</Text>
            <Text style={styles.walletHint}>This is your simulated wallet for transactions</Text>
          </Card>

          <PrimaryButton
            title="Start Exploring"
            icon="arrow-forward"
            onPress={() => navigation.replace('MainApp')}
            style={{ marginTop: SPACING.xl }}
          />
        </View>
      </View>
    );
  }

  // ── Profile Setup Form ────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Setup Profile</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeIn }}>
          {/* Photo Picker */}
          <TouchableOpacity style={styles.photoPicker} onPress={handlePickPhoto} activeOpacity={0.7}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photoImage} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera" size={28} color={COLORS.textMuted} />
                <Text style={styles.photoText}>Add Photo</Text>
              </View>
            )}
            <View style={styles.photoBadge}>
              <Ionicons name="pencil" size={12} color={COLORS.textOnPrimary} />
            </View>
          </TouchableOpacity>

          {/* Name Input */}
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color={COLORS.textMuted} />
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Your display name"
              placeholderTextColor={COLORS.textMuted}
              maxLength={50}
            />
          </View>

          {/* Role Selection */}
          <Text style={styles.sectionLabel}>I want to</Text>
          {ROLES.map((role) => (
            <TouchableOpacity
              key={role.id}
              style={[styles.roleCard, selectedRole === role.id && styles.roleCardActive]}
              onPress={() => setSelectedRole(role.id)}
              activeOpacity={0.7}
            >
              <View style={styles.roleInfo}>
                <Text style={styles.roleLabel}>{role.label}</Text>
                <Text style={styles.roleDesc}>{role.desc}</Text>
              </View>
              <View style={[styles.roleCheck, selectedRole === role.id && styles.roleCheckActive]}>
                {selectedRole === role.id && (
                  <Ionicons name="checkmark" size={14} color={COLORS.textOnPrimary} />
                )}
              </View>
            </TouchableOpacity>
          ))}

          {/* Info Note */}
          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="information-circle" size={18} color={COLORS.info} />
              <Text style={styles.infoText}>
                After setup, you'll receive a simulated UPI ID and wallet balance for transactions on the platform.
              </Text>
            </View>
          </Card>

          <PrimaryButton
            title="Complete Setup"
            icon="checkmark-circle"
            onPress={handleSubmit}
            loading={loading}
            disabled={!name.trim()}
            style={{ marginTop: SPACING.lg }}
          />
        </Animated.View>
      </ScrollView>
    </View>
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
  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 40 },
  photoPicker: {
    width: 100, height: 100, borderRadius: 50, alignSelf: 'center',
    marginBottom: SPACING.xl, position: 'relative',
  },
  photoImage: { width: 100, height: 100, borderRadius: 50 },
  photoPlaceholder: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.surface,
    borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  photoText: { color: COLORS.textMuted, fontSize: FONTS.size.xs, marginTop: 4 },
  photoBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 28, height: 28,
    borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center',
    justifyContent: 'center', borderWidth: 3, borderColor: COLORS.background,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: SPACING.base, marginBottom: SPACING.xl,
  },
  nameInput: {
    flex: 1, fontSize: FONTS.size.lg, color: COLORS.textPrimary,
    paddingVertical: SPACING.base, marginLeft: SPACING.sm,
  },
  sectionLabel: {
    fontSize: FONTS.size.lg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md,
  },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg, padding: SPACING.base, marginBottom: SPACING.md,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  roleCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  roleInfo: { flex: 1 },
  roleLabel: { fontSize: FONTS.size.md, fontWeight: '700', color: COLORS.textPrimary },
  roleDesc: { fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginTop: 2 },
  roleCheck: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  roleCheckActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  infoCard: { marginTop: SPACING.md },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  infoText: { flex: 1, color: COLORS.textSecondary, fontSize: FONTS.size.sm, lineHeight: 18 },

  // Success state
  successContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.xl },
  successIcon: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.primary + '15',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: SPACING.lg,
  },
  successTitle: {
    fontSize: FONTS.size.xxl, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center',
  },
  successSub: {
    fontSize: FONTS.size.md, color: COLORS.textSecondary, textAlign: 'center',
    marginTop: SPACING.sm, marginBottom: SPACING.xl,
  },
  walletCard: { marginBottom: SPACING.md },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  walletLabel: { color: COLORS.textSecondary, fontWeight: '600' },
  upiText: { color: COLORS.primary, fontSize: FONTS.size.lg, fontWeight: '700' },
  balanceText: { color: COLORS.success, fontSize: FONTS.size.xxl, fontWeight: '800' },
  walletHint: { color: COLORS.textMuted, fontSize: FONTS.size.xs, marginTop: 4 },
});
