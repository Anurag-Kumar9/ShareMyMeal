/**
 * ShareMyMeal — My Listings Screen (Seller)
 * =============================================
 * Shows all food listings posted by the current user.
 * Fetches real data from Firestore via API.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
  RefreshControl, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../../config/firebase';
import { listingsAPI } from '../../services/api';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import { Card, StatusBadge, EmptyState } from '../../components/SharedComponents';

export default function MyListingsScreen({ navigation }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchListings();
    }, [])
  );

  const fetchListings = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setLoading(false);
        return;
      }
      const data = await listingsAPI.getByOwner(uid);
      setListings(data || []);
    } catch (error) {
      console.log('Listings fetch error:', error);
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchListings();
    setRefreshing(false);
  };

  const renderListingCard = ({ item }) => (
    <Card style={styles.listingCard}>
      <View style={styles.cardRow}>
        {item.sample_photo_url ? (
          <Image source={{ uri: item.sample_photo_url }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Ionicons name="restaurant-outline" size={24} color={COLORS.textMuted} />
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.dishName} numberOfLines={1}>{item.dish_name}</Text>
          <Text style={styles.priceText}>₹{item.price}/pkt • {(item.packets_available || 0) - (item.packets_sold || 0)} left</Text>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.timeText}>{item.prep_time_start} - {item.prep_time_end}</Text>
          </View>
        </View>
        <StatusBadge status={item.status || 'active'} />
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Listings</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('PostMeal')}
        >
          <Ionicons name="add" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading listings...</Text>
        </View>
      ) : listings.length === 0 ? (
        <EmptyState
          icon="restaurant-outline"
          title="No listings yet"
          subtitle="Post your first home-cooked meal and start selling to your neighbors!"
          actionTitle="Post a Meal"
          onAction={() => navigation.navigate('PostMealTab')}
        />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={renderListingCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
        />
      )}
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
  addBtn: {
    width: 42, height: 42, borderRadius: RADIUS.md, backgroundColor: COLORS.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: FONTS.size.lg, fontWeight: '700', color: COLORS.textPrimary },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.textMuted, fontSize: FONTS.size.md },
  listContent: { paddingHorizontal: SPACING.xl, paddingBottom: 100 },
  listingCard: { marginBottom: SPACING.md },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  thumbnail: {
    width: 64, height: 64, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, marginRight: SPACING.md,
  },
  thumbnailPlaceholder: {
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  dishName: { fontSize: FONTS.size.base, fontWeight: '700', color: COLORS.textPrimary },
  priceText: { fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginTop: 2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  timeText: { fontSize: FONTS.size.xs, color: COLORS.textMuted },
});
