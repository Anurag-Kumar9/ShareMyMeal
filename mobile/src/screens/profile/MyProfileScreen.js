/**
 * ShareMyMeal — My Profile Screen
 * ==================================
 * User profile with real data from Firestore, settings, and navigation options.
 * Rating shown only when total_ratings > 0.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { authAPI } from '../../services/api';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../utils/theme';
import { Card, StarRating } from '../../components/SharedComponents';

const MENU_ITEMS = [
  { icon: 'bag-handle-outline', label: 'My Orders', screen: 'MyOrders', color: COLORS.info },
  { icon: 'restaurant-outline', label: 'My Listings', screen: 'MyListings', color: COLORS.primary },
  { icon: 'scan-outline', label: 'Scan Payment QR', screen: 'QRScanner', color: COLORS.success },
  { icon: 'star-outline', label: 'Reviews', screen: 'MyReviews', color: COLORS.accent },
  { icon: 'wallet-outline', label: 'Payment Methods', screen: 'Payments', color: COLORS.secondary },
  { icon: 'notifications-outline', label: 'Notifications', screen: 'Notifications', color: COLORS.warning },
  { icon: 'help-circle-outline', label: 'Help & Support', screen: 'Support', color: COLORS.info },
  { icon: 'settings-outline', label: 'Settings', screen: 'Settings', color: COLORS.textMuted },
];

export default function MyProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const fetchProfile = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setLoading(false);
        return;
      }
      const data = await authAPI.getProfile(uid);
      setProfile(data);
    } catch (error) {
      console.log('Profile fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to log out.');
            }
          },
        },
      ]
    );
  };

  const displayName = profile?.display_name || 'User';
  const phone = profile?.phone || auth.currentUser?.phoneNumber || '';
  const role = profile?.role || 'both';
  const rating = profile?.rating || 0;
  const totalRatings = profile?.total_ratings || 0;
  const mealsSold = profile?.meals_sold || 0;
  const walletBalance = profile?.wallet_balance || 0;
  const isVerified = profile?.kyc_completed || false;

  const roleLabel = role === 'buyer' ? 'Buyer' : role === 'seller' ? 'Seller' : 'Buyer & Seller';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.editBtn}>
            <Ionicons name="pencil-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={36} color={COLORS.primary} />
            </View>
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={14} color={COLORS.textOnPrimary} />
              </View>
            )}
          </View>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userPhone}>{phone}</Text>
          <View style={styles.roleTag}>
            <Ionicons name="swap-horizontal" size={12} color={COLORS.secondary} />
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>
        </Card>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{mealsSold}</Text>
            <Text style={styles.statLabel}>Sold</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>₹{walletBalance}</Text>
            <Text style={styles.statLabel}>Wallet</Text>
          </View>
          <View style={styles.statCard}>
            {totalRatings > 0 ? (
              <View style={styles.ratingRow}>
                <Text style={styles.statValue}>{rating.toFixed(1)}</Text>
                <Ionicons name="star" size={14} color={COLORS.star} />
              </View>
            ) : (
              <Text style={styles.statValueMuted}>—</Text>
            )}
            <Text style={styles.statLabel}>{totalRatings > 0 ? `Rating (${totalRatings})` : 'No Ratings'}</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuRow, index < MENU_ITEMS.length - 1 && styles.menuBorder]}
              onPress={() => {
                if (item.screen === 'MyOrders') navigation.navigate('MyOrders');
                else if (item.screen === 'MyListings') navigation.navigate('MyListings');
                else if (item.screen === 'Notifications') navigation.navigate('Notifications');
                else if (item.screen === 'QRScanner') navigation.navigate('QRScanner');
              }}
              activeOpacity={0.6}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.7} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>ShareMyMeal v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 100 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingTop: 50, paddingBottom: SPACING.md,
  },
  headerTitle: { fontSize: FONTS.size.xxl, fontWeight: '800', color: COLORS.textPrimary },
  editBtn: {
    width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  profileCard: { marginHorizontal: SPACING.xl, alignItems: 'center', paddingVertical: SPACING.xxl },
  avatarContainer: { position: 'relative', marginBottom: SPACING.md },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary + '15',
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.primary,
  },
  verifiedBadge: {
    position: 'absolute', bottom: 0, right: -4, width: 28, height: 28,
    borderRadius: 14, backgroundColor: COLORS.success, alignItems: 'center',
    justifyContent: 'center', borderWidth: 3, borderColor: COLORS.backgroundCard,
  },
  userName: { fontSize: FONTS.size.xl, fontWeight: '700', color: COLORS.textPrimary },
  userPhone: { fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginTop: 4 },
  roleTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: SPACING.sm, backgroundColor: COLORS.secondary + '15',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.full,
  },
  roleText: { color: COLORS.secondary, fontSize: FONTS.size.xs, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row', marginHorizontal: SPACING.xl,
    marginTop: SPACING.base, gap: SPACING.sm,
  },
  statCard: {
    flex: 1, backgroundColor: COLORS.backgroundCard, borderRadius: RADIUS.lg,
    padding: SPACING.base, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  statValue: { fontSize: FONTS.size.xxl, fontWeight: '800', color: COLORS.textPrimary },
  statValueMuted: { fontSize: FONTS.size.xxl, fontWeight: '800', color: COLORS.textMuted },
  statLabel: { fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: 2, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  menuSection: {
    marginHorizontal: SPACING.xl, marginTop: SPACING.xl, backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.base,
  },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  menuIcon: {
    width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center',
    justifyContent: 'center', marginRight: SPACING.md,
  },
  menuLabel: { flex: 1, fontSize: FONTS.size.md, fontWeight: '500', color: COLORS.textPrimary },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: SPACING.xl, marginTop: SPACING.xl, padding: SPACING.base,
    backgroundColor: COLORS.error + '10', borderRadius: RADIUS.lg, gap: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.error + '20',
  },
  logoutText: { color: COLORS.error, fontSize: FONTS.size.md, fontWeight: '600' },
  version: {
    textAlign: 'center', color: COLORS.textMuted, fontSize: FONTS.size.xs,
    marginTop: SPACING.xl,
  },
});
