/**
 * ShareMyMeal — Listing Detail Screen
 * ========================================
 * Full food listing detail with real order placement via API.
 * Shows sample photo clearly labeled, seller info, ratings, and one-tap order.
 * Chat with seller button to create/open a chat conversation.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Alert, StatusBar, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { ordersAPI, authAPI } from '../../services/api';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../utils/theme';
import { PrimaryButton, StarRating, Badge, Card } from '../../components/SharedComponents';

const { width } = Dimensions.get('window');

export default function ListingDetailScreen({ route, navigation }) {
  const listing = route?.params?.listing || {};
  const availableModes = listing.payment_modes || ['cod'];
  const isOwnListing = auth.currentUser?.uid === listing.seller_uid;
  const [quantity, setQuantity] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState(availableModes[0]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const maxQty = (listing.packets_available || 10) - (listing.packets_sold || 0);
  const totalPrice = quantity * (listing.price || 60);

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (uid) {
        const profile = await authAPI.getProfile(uid);
        setWalletBalance(profile.wallet_balance || 0);
      }
    } catch (e) {
      console.log('Wallet error:', e);
    }
  };

  const paymentLabels = {
    cod: 'Cash on Delivery',
    upi_on_delivery: 'UPI on Delivery (QR at pickup)',
    prepaid_upi: `Pay from Wallet (Bal: ₹${walletBalance})`,
  };

  const handleOrder = () => {
    // Prevent self-ordering
    if (isOwnListing) {
      Alert.alert('Not Allowed', 'You cannot order your own listing.');
      return;
    }

    // Check wallet balance for prepaid
    if (selectedPayment === 'prepaid_upi' && walletBalance < totalPrice) {
      Alert.alert(
        'Insufficient Balance',
        `Your wallet has ₹${walletBalance} but the order costs ₹${totalPrice}.`,
        [{ text: 'OK' }]
      );
      return;
    }

    const paymentNote = selectedPayment === 'prepaid_upi'
      ? `\n\n💰 ₹${totalPrice} will be deducted from your ShareMyMeal wallet.`
      : selectedPayment === 'upi_on_delivery'
      ? '\n\n📱 Show QR code to seller at pickup for payment.'
      : '\n\n💵 Pay cash to seller at pickup.';

    Alert.alert(
      'Confirm Order',
      `${quantity} × ${listing.dish_name}\nTotal: ₹${totalPrice}\nPayment: ${paymentLabels[selectedPayment]}${paymentNote}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: selectedPayment === 'prepaid_upi' ? '💰 Pay & Order' : '🛒 Place Order',
          onPress: placeOrder,
        },
      ]
    );
  };

  const placeOrder = async () => {
    setLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      const orderData = {
        listing_id: listing.id,
        buyer_uid: uid,
        seller_uid: listing.seller_uid,
        quantity: quantity,
        payment_mode: selectedPayment,
      };

      const result = await ordersAPI.create(orderData);

      const orderWithDetails = {
        ...result,
        seller_name: listing.seller_name,
        pickup_location: listing.pickup_location,
      };

      // UPI on Delivery → Go to QR Payment Screen first
      if (selectedPayment === 'upi_on_delivery') {
        navigation.navigate('QRPayment', { order: orderWithDetails });
      } else {
        // COD and Prepaid UPI → Go to Order Tracking
        navigation.navigate('OrderTracking', { order: orderWithDetails });
      }
    } catch (error) {
      console.error('Order error:', error);
      Alert.alert('Order Failed', error.message || 'Failed to place order.');
    } finally {
      setLoading(false);
    }
  };

  const handleChatWithSeller = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !listing.seller_uid) return;

    if (uid === listing.seller_uid) {
      Alert.alert('Info', 'This is your own listing.');
      return;
    }

    try {
      // Check if a chat already exists between these two users for this listing
      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('participants', 'array-contains', uid),
      );
      const snapshot = await getDocs(q);

      let existingChat = null;
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.participants?.includes(listing.seller_uid)) {
          existingChat = { id: doc.id, ...data };
        }
      });

      if (existingChat) {
        navigation.navigate('Chat', {
          chatId: existingChat.id,
          otherUserName: listing.seller_name || 'Seller',
        });
      } else {
        // Create a new chat document
        const chatRef = doc(collection(db, 'chats'));
        const userProfile = await authAPI.getProfile(uid);

        const chatData = {
          participants: [uid, listing.seller_uid],
          participant_names: {
            [uid]: userProfile?.display_name || 'Buyer',
            [listing.seller_uid]: listing.seller_name || 'Seller',
          },
          dish_name: listing.dish_name,
          listing_id: listing.id,
          last_message: '',
          last_message_at: serverTimestamp(),
          created_at: serverTimestamp(),
        };

        await setDoc(chatRef, chatData);

        navigation.navigate('Chat', {
          chatId: chatRef.id,
          otherUserName: listing.seller_name || 'Seller',
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      Alert.alert('Error', 'Could not open chat.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero Image */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: listing.sample_photo_url }} style={styles.heroImage} />
          {/* Sample photo label */}
          <View style={styles.sampleLabel}>
            <Ionicons name="image-outline" size={12} color={COLORS.textOnPrimary} />
            <Text style={styles.sampleLabelText}>Sample Photo (for reference only)</Text>
          </View>
          {/* Back button */}
          <TouchableOpacity style={styles.floatingBack} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Dish Name & Price */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dishName}>{listing.dish_name}</Text>
              <View style={styles.metaRow}>
                <Badge text={listing.status || 'Active'} color={COLORS.success} icon="radio-button-on" />
                {listing.distance_km != null && (
                  <View style={styles.distanceChip}>
                    <Ionicons name="walk-outline" size={12} color={COLORS.secondary} />
                    <Text style={styles.distanceText}>{listing.distance_km} km away</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.priceTag}>
              <Text style={styles.priceAmount}>₹{listing.price}</Text>
              <Text style={styles.priceUnit}>/packet</Text>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.description}>{listing.description}</Text>

          {/* Info Cards */}
          <View style={styles.infoGrid}>
            <View style={styles.infoCard}>
              <Ionicons name="time-outline" size={20} color={COLORS.primary} />
              <Text style={styles.infoLabel}>Prep Time</Text>
              <Text style={styles.infoValue}>{listing.prep_time_start} - {listing.prep_time_end}</Text>
            </View>
            <View style={styles.infoCard}>
              <Ionicons name="cube-outline" size={20} color={COLORS.secondary} />
              <Text style={styles.infoLabel}>Available</Text>
              <Text style={styles.infoValue}>{maxQty} packets left</Text>
            </View>
          </View>

          {/* Seller Card */}
          <Card style={styles.sellerCard}>
            <View style={styles.sellerHeader}>
              <Text style={styles.sectionTitle}>Seller</Text>
              <TouchableOpacity onPress={handleChatWithSeller}>
                <Text style={styles.viewProfile}>💬 Chat →</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.sellerRow}>
              <View style={styles.sellerAvatar}>
                <Ionicons name="person" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.sellerInfo}>
                <View style={styles.sellerNameRow}>
                  <Text style={styles.sellerName}>{listing.seller_name || 'Seller'}</Text>
                  {listing.seller_verified && (
                    <Ionicons name="shield-checkmark" size={16} color={COLORS.success} />
                  )}
                </View>
                {listing.seller_rating > 0 ? (
                  <StarRating rating={listing.seller_rating} size={14} />
                ) : (
                  <Text style={styles.noRatingText}>No ratings yet</Text>
                )}
              </View>
            </View>
          </Card>

          {/* Payment Modes — Rich Cards */}
          <Text style={styles.sectionTitle}>Payment Method</Text>
          {availableModes.length === 1 ? (
            <Card style={styles.singlePaymentCard}>
              <View style={styles.paymentCardRow}>
                <View style={[styles.paymentIconCircle, { backgroundColor: COLORS.success + '15' }]}>
                  <Ionicons
                    name={availableModes[0] === 'cod' ? 'cash-outline' : availableModes[0] === 'upi_on_delivery' ? 'qr-code-outline' : 'wallet-outline'}
                    size={22}
                    color={COLORS.success}
                  />
                </View>
                <View style={styles.paymentCardInfo}>
                  <Text style={styles.paymentCardTitle}>
                    {availableModes[0] === 'cod' ? 'Cash on Delivery' : availableModes[0] === 'upi_on_delivery' ? 'UPI at Pickup' : 'Prepaid Wallet'}
                  </Text>
                  <Text style={styles.paymentCardDesc}>
                    {availableModes[0] === 'cod' ? 'Pay cash to the seller at pickup' : availableModes[0] === 'upi_on_delivery' ? 'Scan QR code at pickup to pay' : `Pay ₹${totalPrice} from wallet (Bal: ₹${walletBalance})`}
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
              </View>
            </Card>
          ) : (
            <View style={styles.paymentOptions}>
              {availableModes.map((mode) => {
                const isSelected = selectedPayment === mode;
                const config = {
                  cod: {
                    icon: 'cash-outline', title: 'Cash on Delivery',
                    desc: 'Pay cash to seller at pickup', color: COLORS.success,
                    emoji: '💵',
                  },
                  upi_on_delivery: {
                    icon: 'qr-code-outline', title: 'UPI at Pickup',
                    desc: 'Scan QR at pickup to pay via UPI', color: COLORS.info,
                    emoji: '📱',
                  },
                  prepaid_upi: {
                    icon: 'wallet-outline', title: 'Pay from Wallet',
                    desc: `Deduct ₹${totalPrice} now (Bal: ₹${walletBalance})`, color: COLORS.primary,
                    emoji: '💰',
                  },
                }[mode];

                return (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.paymentOptionCard,
                      isSelected && { borderColor: config.color, backgroundColor: config.color + '08' },
                    ]}
                    onPress={() => setSelectedPayment(mode)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.paymentCardRow}>
                      <View style={[styles.paymentIconCircle, { backgroundColor: config.color + '15' }]}>
                        <Ionicons name={config.icon} size={22} color={config.color} />
                      </View>
                      <View style={styles.paymentCardInfo}>
                        <Text style={styles.paymentCardTitle}>{config.emoji} {config.title}</Text>
                        <Text style={styles.paymentCardDesc}>{config.desc}</Text>
                      </View>
                      <View style={[
                        styles.paymentRadio,
                        isSelected && { borderColor: config.color, backgroundColor: config.color },
                      ]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color={COLORS.textOnPrimary} />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Quantity Selector */}
          <Card style={styles.qtyCard}>
            <Text style={styles.qtyLabel}>Quantity</Text>
            <View style={styles.qtyControls}>
              <TouchableOpacity
                style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Ionicons name="remove" size={20} color={quantity <= 1 ? COLORS.textMuted : COLORS.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <TouchableOpacity
                style={[styles.qtyBtn, quantity >= maxQty && styles.qtyBtnDisabled]}
                onPress={() => setQuantity(Math.min(maxQty, quantity + 1))}
                disabled={quantity >= maxQty}
              >
                <Ionicons name="add" size={20} color={quantity >= maxQty ? COLORS.textMuted : COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      {isOwnListing ? (
        <View style={styles.ownListingBar}>
          <Ionicons name="storefront-outline" size={20} color={COLORS.primary} />
          <Text style={styles.ownListingText}>This is your listing</Text>
        </View>
      ) : (
        <View style={styles.bottomBar}>
          <View style={styles.totalInfo}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalPrice}>₹{totalPrice}</Text>
          </View>
          <PrimaryButton
            title="Place Order"
            icon="bag-add"
            onPress={handleOrder}
            loading={loading}
            style={{ flex: 1, marginLeft: SPACING.base }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  imageContainer: { position: 'relative' },
  heroImage: { width, height: 280, backgroundColor: COLORS.surface },
  sampleLabel: {
    position: 'absolute', bottom: SPACING.md, left: SPACING.md,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  sampleLabelText: { color: COLORS.textOnPrimary, fontSize: FONTS.size.xs, fontWeight: '600' },
  floatingBack: {
    position: 'absolute', top: 46, left: SPACING.lg, width: 40, height: 40,
    borderRadius: 20, backgroundColor: COLORS.backgroundCard + 'E0', alignItems: 'center',
    justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  content: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md },
  dishName: { fontSize: FONTS.size.xxl, fontWeight: '800', color: COLORS.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  distanceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.secondary + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full,
  },
  distanceText: { color: COLORS.secondary, fontSize: FONTS.size.xs, fontWeight: '600' },
  priceTag: { alignItems: 'flex-end' },
  priceAmount: { fontSize: FONTS.size.xxl, fontWeight: '800', color: COLORS.primary },
  priceUnit: { fontSize: FONTS.size.xs, color: COLORS.textMuted },
  description: { color: COLORS.textSecondary, fontSize: FONTS.size.md, lineHeight: 22, marginBottom: SPACING.lg },
  infoGrid: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  infoCard: {
    flex: 1, backgroundColor: COLORS.backgroundCard, borderRadius: RADIUS.lg,
    padding: SPACING.base, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  infoLabel: { color: COLORS.textMuted, fontSize: FONTS.size.xs, marginTop: 6, fontWeight: '600' },
  infoValue: { color: COLORS.textPrimary, fontSize: FONTS.size.sm, fontWeight: '700', marginTop: 2 },
  sellerCard: { marginBottom: SPACING.lg },
  sellerHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md },
  sectionTitle: { fontSize: FONTS.size.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  viewProfile: { color: COLORS.primary, fontSize: FONTS.size.sm, fontWeight: '600' },
  sellerRow: { flexDirection: 'row', alignItems: 'center' },
  sellerAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary + '15',
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md,
  },
  sellerInfo: {},
  sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  sellerName: { fontSize: FONTS.size.md, fontWeight: '700', color: COLORS.textPrimary },
  noRatingText: { fontSize: FONTS.size.xs, color: COLORS.textMuted, fontStyle: 'italic' },
  paymentOptions: { gap: SPACING.sm, marginBottom: SPACING.xl },
  singlePaymentCard: { marginBottom: SPACING.xl },
  paymentOptionCard: {
    backgroundColor: COLORS.backgroundCard, borderRadius: RADIUS.xl,
    padding: SPACING.base, borderWidth: 1.5, borderColor: COLORS.border, marginBottom: SPACING.sm,
  },
  paymentCardRow: { flexDirection: 'row', alignItems: 'center' },
  paymentIconCircle: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.md,
  },
  paymentCardInfo: { flex: 1 },
  paymentCardTitle: { fontSize: FONTS.size.md, fontWeight: '700', color: COLORS.textPrimary },
  paymentCardDesc: { fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: 2 },
  paymentRadio: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyLabel: { fontSize: FONTS.size.base, fontWeight: '700', color: COLORS.textPrimary },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: SPACING.base },
  qtyBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  qtyBtnDisabled: { opacity: 0.4 },
  qtyValue: { fontSize: FONTS.size.xl, fontWeight: '800', color: COLORS.textPrimary, minWidth: 30, textAlign: 'center' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.backgroundAlt, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.base, paddingBottom: 30,
  },
  totalInfo: {},
  totalLabel: { color: COLORS.textMuted, fontSize: FONTS.size.xs },
  totalPrice: { color: COLORS.textPrimary, fontSize: FONTS.size.xxl, fontWeight: '800' },
  ownListingBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primary + '15', borderTopWidth: 1, borderTopColor: COLORS.primary + '30',
    paddingVertical: SPACING.lg, paddingBottom: 30,
  },
  ownListingText: { color: COLORS.primary, fontSize: FONTS.size.base, fontWeight: '700' },
});
