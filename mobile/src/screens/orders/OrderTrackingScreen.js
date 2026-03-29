/**
 * ShareMyMeal — Order Tracking Screen
 * ========================================
 * Vertical stepper showing live order stages with timestamps.
 * Floating chat button for buyer-seller communication.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { ordersAPI, authAPI } from '../../services/api';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../utils/theme';
import { PrimaryButton, Card, StatusBadge } from '../../components/SharedComponents';

const ORDER_STEPS = [
  { key: 'placed', label: 'Order Placed', icon: 'receipt-outline', desc: 'Your order has been received' },
  { key: 'accepted', label: 'Order Accepted', icon: 'checkmark-circle-outline', desc: 'Seller has accepted your order' },
  { key: 'cooking', label: 'Cooking in Progress', icon: 'flame-outline', desc: 'Your meal is being prepared' },
  { key: 'ready', label: 'Ready for Pickup', icon: 'bag-check-outline', desc: 'Head to the pickup location!' },
  { key: 'picked_up', label: 'Picked Up', icon: 'walk-outline', desc: 'You have collected your food' },
  { key: 'completed', label: 'Completed', icon: 'checkmark-done-circle-outline', desc: 'Order completed! Rate the seller' },
];

const STATUS_INDEX = {
  placed: 0, accepted: 1, cooking: 2, ready: 3, picked_up: 4, completed: 5,
  cancelled: -1, rejected: -1,
};

export default function OrderTrackingScreen({ route, navigation }) {
  const order = route?.params?.order || {};

  const [currentStatus, setCurrentStatus] = useState(order.status || 'placed');
  const [confirmingPickup, setConfirmingPickup] = useState(false);
  const currentIndex = STATUS_INDEX[currentStatus] ?? 0;

  const handleConfirmPickup = () => {
    Alert.alert(
      'Confirm Pickup',
      'Have you collected your food from the seller?',
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Yes, Picked Up',
          onPress: async () => {
            setConfirmingPickup(true);
            try {
              const uid = auth.currentUser?.uid;
              await ordersAPI.confirmPickup(order.id, { buyer_uid: uid });
              setCurrentStatus('completed');
              navigation.navigate('Rating', { order });
            } catch (error) {
              console.log('Confirm pickup error:', error);
              Alert.alert('Error', error.message || 'Failed to confirm pickup.');
            } finally {
              setConfirmingPickup(false);
            }
          },
        },
      ]
    );
  };

  const handleChatWithSeller = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !order.seller_uid) return;

    try {
      const chatsRef = collection(db, 'chats');
      const q = query(chatsRef, where('participants', 'array-contains', uid));
      const snapshot = await getDocs(q);

      let existingChat = null;
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (data.participants?.includes(order.seller_uid)) {
          existingChat = { id: d.id, ...data };
        }
      });

      if (existingChat) {
        navigation.navigate('Chat', { chatId: existingChat.id, otherUserName: order.seller_name || 'Seller' });
      } else {
        const chatRef = doc(collection(db, 'chats'));
        const userProfile = await authAPI.getProfile(uid);
        await setDoc(chatRef, {
          participants: [uid, order.seller_uid],
          participant_names: {
            [uid]: userProfile?.display_name || 'Buyer',
            [order.seller_uid]: order.seller_name || 'Seller',
          },
          dish_name: order.dish_name,
          order_id: order.id,
          last_message: '',
          last_message_at: serverTimestamp(),
          created_at: serverTimestamp(),
        });
        navigation.navigate('Chat', { chatId: chatRef.id, otherUserName: order.seller_name || 'Seller' });
      }
    } catch (error) {
      console.error('Chat error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Tracking</Text>
        <View style={styles.headerIcon} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Order Summary Card */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryLeft}>
              <Text style={styles.orderId}>#{order.id}</Text>
              <Text style={styles.dishNameText}>{order.dish_name}</Text>
              <Text style={styles.orderMeta}>
                {order.quantity} packets • ₹{order.total_price}
              </Text>
            </View>
            <StatusBadge status={currentStatus} />
          </View>
        </Card>

        {/* Vertical Stepper */}
        <View style={styles.stepperContainer}>
          <Text style={styles.stepperTitle}>Order Progress</Text>
          {ORDER_STEPS.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isActive = index === currentIndex;
            const isFuture = index > currentIndex;
            const isCancelled = currentStatus === 'cancelled' || currentStatus === 'rejected';

            const stepColor = isCancelled
              ? COLORS.textMuted
              : isCompleted
              ? COLORS.success
              : isActive
              ? COLORS.primary
              : COLORS.textMuted;

            return (
              <View key={step.key} style={styles.stepRow}>
                {/* Connector Line */}
                <View style={styles.stepLineContainer}>
                  <View
                    style={[
                      styles.stepDot,
                      {
                        backgroundColor: isCompleted ? COLORS.success : isActive ? COLORS.primary : COLORS.surface,
                        borderColor: stepColor,
                      },
                    ]}
                  >
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={14} color={COLORS.textOnPrimary} />
                    ) : (
                      <Ionicons name={step.icon} size={14} color={stepColor} />
                    )}
                  </View>
                  {index < ORDER_STEPS.length - 1 && (
                    <View
                      style={[
                        styles.stepLine,
                        {
                          backgroundColor: isCompleted ? COLORS.success : COLORS.border,
                        },
                      ]}
                    />
                  )}
                </View>

                {/* Step Content */}
                <View style={[styles.stepContent, isFuture && styles.stepContentFuture]}>
                  <Text
                    style={[
                      styles.stepLabel,
                      isActive && styles.stepLabelActive,
                      isFuture && styles.stepLabelFuture,
                    ]}
                  >
                    {step.label}
                  </Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                  {isActive && !isCancelled && (
                    <View style={styles.activeIndicator}>
                      <View style={styles.activePulse} />
                      <Text style={styles.activeText}>In Progress</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Action Buttons */}
        {currentStatus === 'ready' && (
          <PrimaryButton
            title="Confirm Pickup"
            icon="bag-check"
            onPress={handleConfirmPickup}
            loading={confirmingPickup}
            style={{ marginHorizontal: SPACING.xl, marginTop: SPACING.lg }}
          />
        )}

        {/* 💰 Payment Info Card */}
        <Card style={styles.paymentCard}>
          <View style={styles.paymentHeader}>
            <View style={[styles.paymentHeaderIcon, {
              backgroundColor: order.payment_mode === 'prepaid_upi' ? COLORS.primary + '15'
                : order.payment_mode === 'upi_on_delivery' ? COLORS.info + '15'
                : COLORS.success + '15'
            }]}>
              <Ionicons
                name={order.payment_mode === 'prepaid_upi' ? 'wallet' : order.payment_mode === 'upi_on_delivery' ? 'qr-code' : 'cash'}
                size={22}
                color={order.payment_mode === 'prepaid_upi' ? COLORS.primary : order.payment_mode === 'upi_on_delivery' ? COLORS.info : COLORS.success}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentTitle}>
                {order.payment_mode === 'cod' ? 'Cash on Delivery' :
                 order.payment_mode === 'upi_on_delivery' ? 'UPI at Pickup' :
                 'Prepaid Wallet'}
              </Text>
              <Text style={styles.paymentSubtitle}>
                {order.payment_mode === 'cod' ? 'Pay at pickup' :
                 order.payment_mode === 'upi_on_delivery' ? 'QR code payment' :
                 'Already paid'}
              </Text>
            </View>
            <View style={styles.paymentAmountBadge}>
              <Text style={styles.paymentAmountText}>₹{order.total_price}</Text>
            </View>
          </View>

          {/* Prepaid — Paid confirmation */}
          {order.payment_mode === 'prepaid_upi' && (
            <View style={styles.paidBanner}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text style={styles.paidBannerText}>
                ₹{order.total_price} deducted from wallet • Held securely by platform
              </Text>
            </View>
          )}

          {/* UPI on Delivery — Navigate to QR Payment Screen */}
          {order.payment_mode === 'upi_on_delivery' && (currentStatus === 'ready' || currentStatus === 'cooking' || currentStatus === 'accepted') && (
            <View style={styles.qrActionContainer}>
              <PrimaryButton
                title="Show Payment QR"
                icon="qr-code"
                onPress={() => navigation.navigate('QRPayment', { order })}
                style={{ marginTop: SPACING.md }}
              />
              <Text style={styles.qrActionHint}>
                Show this QR to the seller at pickup — amount will be deducted from your wallet
              </Text>
            </View>
          )}

          {/* COD — Cash instructions */}
          {order.payment_mode === 'cod' && (
            <View style={styles.codBanner}>
              <View style={styles.codIconRow}>
                <Text style={{ fontSize: 28 }}>💵</Text>
              </View>
              <Text style={styles.codText}>Pay ₹{order.total_price} in cash to the seller when you pick up your food</Text>
              <Text style={styles.codHint}>Please carry exact change if possible</Text>
            </View>
          )}
        </Card>

        {/* Pickup Location */}
        <Card style={styles.pickupCard}>
          <View style={styles.pickupHeader}>
            <Ionicons name="location" size={20} color={COLORS.primary} />
            <Text style={styles.pickupTitle}>Pickup Location</Text>
          </View>
          <Text style={styles.pickupSeller}>{order.seller_name}</Text>
          <Text style={styles.pickupAddress}>
            📍 Lat: {order.pickup_location?.latitude?.toFixed(4)},
            Lng: {order.pickup_location?.longitude?.toFixed(4)}
          </Text>
        </Card>
      </ScrollView>

      {/* Floating Chat Button */}
      <TouchableOpacity
        style={styles.chatFab}
        onPress={handleChatWithSeller}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color={COLORS.textOnPrimary} />
      </TouchableOpacity>
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
  headerIcon: { width: 42 },
  scrollContent: { paddingBottom: 100 },
  summaryCard: { marginHorizontal: SPACING.xl, marginBottom: SPACING.lg },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryLeft: { flex: 1 },
  orderId: { color: COLORS.textMuted, fontSize: FONTS.size.xs, fontWeight: '600', marginBottom: 4 },
  dishNameText: { color: COLORS.textPrimary, fontSize: FONTS.size.lg, fontWeight: '700' },
  orderMeta: { color: COLORS.textSecondary, fontSize: FONTS.size.sm, marginTop: 4 },

  stepperContainer: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl },
  stepperTitle: { fontSize: FONTS.size.lg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.lg },
  stepRow: { flexDirection: 'row', marginBottom: 0 },
  stepLineContainer: { alignItems: 'center', width: 36 },
  stepDot: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  stepLine: { width: 2, height: 40, marginVertical: -2 },
  stepContent: { flex: 1, paddingLeft: SPACING.md, paddingBottom: SPACING.xxl },
  stepContentFuture: { opacity: 0.4 },
  stepLabel: { fontSize: FONTS.size.md, fontWeight: '600', color: COLORS.textPrimary },
  stepLabelActive: { color: COLORS.primary, fontWeight: '700' },
  stepLabelFuture: { color: COLORS.textMuted },
  stepDesc: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginTop: 2 },
  activeIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  activePulse: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginRight: 6,
  },
  activeText: { color: COLORS.primary, fontSize: FONTS.size.xs, fontWeight: '700' },
  paymentCard: { marginHorizontal: SPACING.xl, marginTop: SPACING.base },
  paymentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  paymentHeaderIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.md,
  },
  paymentTitle: { fontSize: FONTS.size.base, fontWeight: '700', color: COLORS.textPrimary },
  paymentSubtitle: { fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: 1 },
  paymentAmountBadge: {
    backgroundColor: COLORS.primary + '15', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  paymentAmountText: { color: COLORS.primary, fontSize: FONTS.size.base, fontWeight: '800' },
  paidBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.success + '10', padding: SPACING.md, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.success + '20',
  },
  paidBannerText: { flex: 1, color: COLORS.success, fontSize: FONTS.size.sm, fontWeight: '600' },
  qrActionContainer: { alignItems: 'center', marginTop: SPACING.sm },
  qrActionHint: {
    color: COLORS.textMuted, fontSize: FONTS.size.xs, textAlign: 'center',
    marginTop: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  codBanner: {
    alignItems: 'center', backgroundColor: COLORS.success + '08', padding: SPACING.lg,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.success + '15',
  },
  codIconRow: { marginBottom: SPACING.sm },
  codText: {
    color: COLORS.textPrimary, fontSize: FONTS.size.md, fontWeight: '600', textAlign: 'center',
  },
  codHint: {
    color: COLORS.textMuted, fontSize: FONTS.size.xs, marginTop: SPACING.sm, textAlign: 'center',
  },
  pickupCard: { marginHorizontal: SPACING.xl, marginTop: SPACING.base },
  pickupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  pickupTitle: { color: COLORS.textPrimary, fontWeight: '700', marginLeft: SPACING.sm },
  pickupSeller: { color: COLORS.textSecondary, fontSize: FONTS.size.md, marginBottom: 4 },
  pickupAddress: { color: COLORS.textMuted, fontSize: FONTS.size.sm },
  chatFab: {
    position: 'absolute', bottom: 30, right: SPACING.xl,
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', ...SHADOWS.glow,
  },
});
