/**
 * ShareMyMeal — QR Payment Screen (Buyer)
 * =============================================
 * Displays a generated QR code for UPI-on-delivery orders.
 * The seller scans this QR to trigger payment.
 * 
 * QR Payload:
 * {
 *   order_id, amount, buyer_uid,
 *   payee: "sharemymeal.platform@sharemymeal"
 * }
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, Alert, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { auth } from '../../config/firebase';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../utils/theme';
import { PrimaryButton, Card } from '../../components/SharedComponents';

export default function QRPaymentScreen({ route, navigation }) {
  const order = route?.params?.order || {};
  const buyerUid = auth.currentUser?.uid;
  const [pulseAnim] = useState(new Animated.Value(0.95));

  // QR payload matching the system design spec
  const qrPayload = JSON.stringify({
    order_id: order.id,
    amount: order.total_price || 0,
    payee: 'sharemymeal.platform@sharemymeal',
    buyer_uid: buyerUid,
  });

  useEffect(() => {
    // Pulsing animation for the QR container
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.98, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment QR</Text>
        <View style={{ width: 42 }} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Amount Display */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount to Pay</Text>
          <Text style={styles.amountValue}>₹{order.total_price}</Text>
          <Text style={styles.amountDish}>{order.dish_name} × {order.quantity || 1}</Text>
        </View>

        {/* QR Code Card */}
        <Animated.View style={[styles.qrWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.qrGlowBorder}>
            <View style={styles.qrWhiteBox}>
              <QRCode
                value={qrPayload}
                size={200}
                backgroundColor="white"
                color="#1A1A2E"
              />
            </View>
          </View>
        </Animated.View>

        <Text style={styles.qrInstruction}>Show this QR to the seller</Text>

        {/* How it works */}
        <View style={styles.stepsContainer}>
          {[
            { icon: 'qr-code-outline', text: 'Show this QR to seller at pickup' },
            { icon: 'scan-outline', text: 'Seller scans → money deducted from wallet' },
            { icon: 'lock-closed-outline', text: 'Funds held by platform until you confirm' },
          ].map((step, i) => (
            <View key={i} style={styles.stepChip}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Ionicons name={step.icon} size={16} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>

        {/* Track Order Button */}
        <PrimaryButton
          title="Track Your Order"
          icon="navigate"
          onPress={() => navigation.replace('OrderTracking', { order })}
          style={{ width: '100%', marginTop: SPACING.xl }}
        />
      </View>
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
  content: { flex: 1, alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg },
  amountCard: { alignItems: 'center', marginBottom: SPACING.xl },
  amountLabel: { fontSize: FONTS.size.sm, color: COLORS.textMuted, fontWeight: '600' },
  amountValue: { fontSize: 42, fontWeight: '900', color: COLORS.primary, marginVertical: SPACING.xs },
  amountDish: { fontSize: FONTS.size.sm, color: COLORS.textSecondary },
  qrWrapper: { marginBottom: SPACING.lg },
  qrGlowBorder: {
    padding: 6, borderRadius: RADIUS.xxl, borderWidth: 2, borderColor: COLORS.info + '50',
    backgroundColor: COLORS.info + '08',
    ...SHADOWS.medium,
  },
  qrWhiteBox: {
    padding: SPACING.lg, borderRadius: RADIUS.xl, backgroundColor: '#FFFFFF',
    shadowColor: COLORS.info, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
  },
  qrInstruction: {
    fontSize: FONTS.size.base, fontWeight: '700', color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
  },
  detailsCard: { width: '100%', marginBottom: SPACING.lg },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  detailIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.info + '15',
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md,
  },
  detailInfo: { flex: 1 },
  detailLabel: { fontSize: FONTS.size.xs, color: COLORS.textMuted },
  detailValue: { fontSize: FONTS.size.sm, color: COLORS.textPrimary, fontWeight: '600' },
  arrowRow: { alignItems: 'center', paddingVertical: SPACING.xs, paddingLeft: 9 },
  stepsContainer: { width: '100%' },
  stepChip: {
    flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm,
    backgroundColor: COLORS.backgroundCard, padding: SPACING.md, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  stepNum: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.info + '20',
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm,
  },
  stepNumText: { color: COLORS.info, fontSize: FONTS.size.xs, fontWeight: '800' },
  stepText: { color: COLORS.textSecondary, fontSize: FONTS.size.xs, flex: 1 },
});
