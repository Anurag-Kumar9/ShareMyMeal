/**
 * ShareMyMeal — Dashboard (Home Screen)
 * ==========================================
 * Map view centered on user's location with nearby food listing pins.
 * Bottom scrollable cards showing listings sorted by distance.
 * Fetches real listings from backend API and shows reverse-geocoded address.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Dimensions, StatusBar, Animated, FlatList, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { auth } from '../../config/firebase';
import { listingsAPI, authAPI } from '../../services/api';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../utils/theme';
import { Card, Badge, StarRating, StatusBadge, EmptyState } from '../../components/SharedComponents';

const { width, height } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('Getting your location...');
  const [listings, setListings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [walletBalance, setWalletBalance] = useState(0);
  const [loadingListings, setLoadingListings] = useState(true);
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initDashboard();
    Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const initDashboard = async () => {
    await getLocation();
    await fetchWalletBalance();
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);

      // Reverse geocode to get readable address
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (geo) {
          const parts = [geo.name, geo.street, geo.district, geo.city].filter(Boolean);
          setAddress(parts.slice(0, 2).join(', ') || 'Your location');
        }
      } catch (e) {
        setAddress('Your location');
      }

      // Fetch nearby listings with real location
      await fetchListings(loc.coords.latitude, loc.coords.longitude);
    } catch (error) {
      console.log('Location error:', error);
      setLoadingListings(false);
    }
  };

  const fetchListings = async (lat, lng) => {
    try {
      setLoadingListings(true);
      const data = await listingsAPI.getNearby(lat, lng, 10);
      setListings(data || []);
    } catch (error) {
      console.log('Listings fetch error:', error);
      setListings([]);
    } finally {
      setLoadingListings(false);
    }
  };

  const fetchWalletBalance = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (uid) {
        const profile = await authAPI.getProfile(uid);
        setWalletBalance(profile.wallet_balance || 0);
      }
    } catch (error) {
      console.log('Wallet fetch error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await getLocation();
    await fetchWalletBalance();
    setRefreshing(false);
  };

  const FILTERS = [
    { id: 'all', label: 'All', icon: 'grid-outline' },
    { id: 'nearby', label: 'Nearest', icon: 'location-outline' },
    { id: 'popular', label: 'Popular', icon: 'flame-outline' },
    { id: 'budget', label: 'Budget', icon: 'wallet-outline' },
  ];

  const getFilteredListings = () => {
    if (selectedFilter === 'nearby') return [...listings].sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));
    if (selectedFilter === 'popular') return [...listings].sort((a, b) => (b.seller_rating || 0) - (a.seller_rating || 0));
    if (selectedFilter === 'budget') return [...listings].sort((a, b) => (a.price || 0) - (b.price || 0));
    return listings;
  };

  const renderListingCard = ({ item, index }) => (
    <Animated.View
      style={{
        opacity: fadeIn,
        transform: [{ translateY: Animated.multiply(new Animated.Value(20), new Animated.Value(1)) }],
      }}
    >
      <TouchableOpacity
        style={styles.listingCard}
        onPress={() => navigation.navigate('ListingDetail', { listing: item })}
        activeOpacity={0.85}
      >
        {/* Food Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.sample_photo_url }}
            style={styles.foodImage}
            defaultSource={require('../../assets/placeholder.png')}
          />
          <View style={styles.imageBadgeRow}>
            <View style={styles.sampleBadge}>
              <Ionicons name="image-outline" size={10} color={COLORS.textOnPrimary} />
              <Text style={styles.sampleText}>Sample</Text>
            </View>
          </View>
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>₹{item.price}</Text>
            <Text style={styles.priceUnit}>/pkt</Text>
          </View>
        </View>

        {/* Card Content */}
        <View style={styles.cardContent}>
          {/* Dish Name & Distance */}
          <View style={styles.cardHeader}>
            <Text style={styles.dishName} numberOfLines={1}>{item.dish_name}</Text>
            {item.distance_km != null && (
              <View style={styles.distanceBadge}>
                <Ionicons name="walk-outline" size={12} color={COLORS.secondary} />
                <Text style={styles.distanceText}>{item.distance_km} km</Text>
              </View>
            )}
          </View>

          {/* Description */}
          <Text style={styles.dishDescription} numberOfLines={2}>{item.description}</Text>

          {/* Seller Info */}
          <View style={styles.sellerRow}>
            <View style={styles.sellerInfo}>
              <View style={styles.sellerAvatar}>
                <Ionicons name="person" size={14} color={COLORS.textMuted} />
              </View>
              <Text style={styles.sellerName} numberOfLines={1}>{item.seller_name || 'Seller'}</Text>
              {item.seller_verified && (
                <Ionicons name="shield-checkmark" size={14} color={COLORS.success} />
              )}
            </View>
            {item.seller_rating > 0 && <StarRating rating={item.seller_rating} size={12} />}
          </View>

          {/* Bottom Row: Time & Availability */}
          <View style={styles.bottomRow}>
            <View style={styles.timeInfo}>
              <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
              <Text style={styles.timeText}>{item.prep_time_start} - {item.prep_time_end}</Text>
            </View>
            <View style={styles.availability}>
              <Text style={styles.availText}>
                {(item.packets_available || 0) - (item.packets_sold || 0)} left
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={18} color={COLORS.primary} />
            <Text style={styles.locationText} numberOfLines={1}>{address}</Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
          </View>
          <Text style={styles.headerTitle}>
            Discover <Text style={{ color: COLORS.primary }}>Meals</Text>
          </Text>
        </View>
        <View style={styles.headerRight}>
          {/* Wallet Balance Badge */}
          <TouchableOpacity style={styles.walletBadge} activeOpacity={0.7}>
            <Ionicons name="wallet" size={14} color={COLORS.success} />
            <Text style={styles.walletBadgeText}>₹{walletBalance.toLocaleString()}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={COLORS.textPrimary} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => navigation.navigate('MyProfile')}
          >
            <Ionicons name="person-circle-outline" size={26} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[styles.filterPill, selectedFilter === filter.id && styles.filterPillActive]}
            onPress={() => setSelectedFilter(filter.id)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={filter.icon}
              size={14}
              color={selectedFilter === filter.id ? COLORS.textOnPrimary : COLORS.textMuted}
            />
            <Text
              style={[
                styles.filterText,
                selectedFilter === filter.id && styles.filterTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Map Preview Card */}
      <TouchableOpacity style={styles.mapPreview} activeOpacity={0.9}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={40} color={COLORS.primary} />
          <Text style={styles.mapText}>
            {location ? `📍 ${address}` : 'Getting your location...'}
          </Text>
          <Text style={styles.mapSubtext}>{listings.length} meals nearby</Text>
        </View>
      </TouchableOpacity>

      {/* Listings */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🍽️ Near You</Text>
        <Text style={styles.sectionCount}>{listings.length} available</Text>
      </View>

      {loadingListings ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Finding nearby meals...</Text>
        </View>
      ) : listings.length === 0 ? (
        <EmptyState
          icon="restaurant-outline"
          title="No meals nearby"
          subtitle="Be the first to post a home-cooked meal in your area!"
          actionTitle="Post a Meal"
          onAction={() => navigation.navigate('PostMealTab')}
        />
      ) : (
        <FlatList
          data={getFilteredListings()}
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: 50,
    paddingBottom: SPACING.md,
  },
  headerLeft: { flex: 1, marginRight: SPACING.sm },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  locationText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    marginLeft: SPACING.xs,
    marginRight: SPACING.xs,
    flex: 1,
  },
  headerTitle: {
    fontSize: FONTS.size.xxl,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.success + '30',
    gap: 4,
  },
  walletBadgeText: {
    color: COLORS.success,
    fontSize: FONTS.size.sm,
    fontWeight: '700',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  filterScroll: {
    maxHeight: 44,
    marginBottom: SPACING.md,
  },
  filterContent: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.backgroundCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    fontWeight: '600',
  },
  filterTextActive: {
    color: COLORS.textOnPrimary,
  },
  mapPreview: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.base,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mapPlaceholder: {
    height: 120,
    backgroundColor: COLORS.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    marginTop: SPACING.sm,
  },
  mapSubtext: {
    color: COLORS.primary,
    fontSize: FONTS.size.xs,
    fontWeight: '700',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sectionCount: {
    fontSize: FONTS.size.sm,
    color: COLORS.textMuted,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.xxxl,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.md,
  },
  listContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 100,
  },
  listingCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.base,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  imageContainer: {
    position: 'relative',
  },
  foodImage: {
    width: '100%',
    height: 160,
    backgroundColor: COLORS.surface,
  },
  imageBadgeRow: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
  },
  sampleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  sampleText: {
    color: COLORS.textOnPrimary,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  priceBadge: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  priceText: {
    color: COLORS.textOnPrimary,
    fontSize: FONTS.size.lg,
    fontWeight: '800',
  },
  priceUnit: {
    color: COLORS.textOnPrimary,
    fontSize: FONTS.size.xs,
    opacity: 0.8,
    marginLeft: 2,
  },
  cardContent: {
    padding: SPACING.base,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dishName: {
    fontSize: FONTS.size.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginLeft: SPACING.sm,
    gap: 4,
  },
  distanceText: {
    color: COLORS.secondary,
    fontSize: FONTS.size.xs,
    fontWeight: '700',
  },
  dishDescription: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  sellerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  sellerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerName: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    fontWeight: '500',
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
  },
  availability: {
    backgroundColor: COLORS.success + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  availText: {
    color: COLORS.success,
    fontSize: FONTS.size.xs,
    fontWeight: '700',
  },
});
