/**
 * ShareMyMeal — My Orders Screen (Buyer + Seller)
 * ==================================================
 * Top toggle: "My Orders" (buyer) / "Received" (seller)
 * Within each: Active / History tabs
 * Seller can Accept/Reject incoming orders.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
  RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../../config/firebase';
import { ordersAPI } from '../../services/api';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import { Card, StatusBadge, EmptyState, PrimaryButton } from '../../components/SharedComponents';

export default function MyOrdersScreen({ navigation }) {
  const [viewMode, setViewMode] = useState('buyer'); // 'buyer' or 'seller'
  const [activeTab, setActiveTab] = useState('active');
  const [buyerOrders, setBuyerOrders] = useState([]);
  const [sellerOrders, setSellerOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      fetchAllOrders();
    }, [])
  );

  const fetchAllOrders = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) { setLoading(false); return; }

      const [bOrders, sOrders] = await Promise.all([
        ordersAPI.getBuyerOrders(uid).catch(() => []),
        ordersAPI.getSellerOrders(uid).catch(() => []),
      ]);
      setBuyerOrders(bOrders || []);
      setSellerOrders(sOrders || []);
    } catch (error) {
      console.log('Orders fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllOrders();
    setRefreshing(false);
  };

  // Seller actions: accept or reject an order
  const handleSellerAction = async (orderId, newStatus) => {
    const uid = auth.currentUser?.uid;
    setUpdatingId(orderId);
    try {
      await ordersAPI.updateStatus(orderId, {
        status: newStatus,
        updated_by: uid,
      });
      // Refresh data
      await fetchAllOrders();
    } catch (error) {
      Alert.alert('Error', error.message || `Failed to ${newStatus} order.`);
    } finally {
      setUpdatingId(null);
    }
  };

  // Seller: update cooking status
  const handleSellerStatusUpdate = (orderId, newStatus) => {
    const uid = auth.currentUser?.uid;
    Alert.alert(
      'Update Status',
      `Mark order as "${newStatus.replace(/_/g, ' ')}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setUpdatingId(orderId);
            try {
              await ordersAPI.updateStatus(orderId, { status: newStatus, updated_by: uid });
              await fetchAllOrders();
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to update status.');
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  };

  const orders = viewMode === 'buyer' ? buyerOrders : sellerOrders;
  const activeOrders = orders.filter((o) => !['completed', 'cancelled', 'rejected'].includes(o.status));
  const historyOrders = orders.filter((o) => ['completed', 'cancelled', 'rejected'].includes(o.status));
  const displayOrders = activeTab === 'active' ? activeOrders : historyOrders;

  // Get next seller action for order status
  const getSellerActions = (order) => {
    const s = order.status;
    if (s === 'placed') return ['accepted', 'rejected'];
    if (s === 'accepted') return ['cooking'];
    if (s === 'cooking') return ['ready'];
    return [];
  };

  const ACTION_LABELS = {
    accepted: { label: 'Accept', icon: 'checkmark-circle', color: COLORS.success },
    rejected: { label: 'Reject', icon: 'close-circle', color: COLORS.error },
    cooking: { label: 'Start Cooking', icon: 'flame', color: COLORS.primary },
    ready: { label: 'Mark Ready', icon: 'bag-check', color: COLORS.success },
  };

  // ── Buyer Order Card ────────────────────────────────────────
  const renderBuyerCard = ({ item }) => (
    <Card
      style={styles.orderCard}
      onPress={() => navigation.navigate('OrderTracking', { order: item })}
    >
      <View style={styles.orderTop}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderId}>#{item.id?.slice(-8)}</Text>
          <Text style={styles.dishName}>{item.dish_name}</Text>
          <Text style={styles.orderMeta}>
            {item.quantity} pkt • ₹{item.total_price} • {item.seller_name || 'Seller'}
          </Text>
        </View>
        <StatusBadge status={item.status} />
      </View>
      <View style={styles.orderBottom}>
        <View style={styles.paymentInfo}>
          <Ionicons name="wallet-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.paymentText}>{(item.payment_mode || '').replace(/_/g, ' ')}</Text>
        </View>
        <View style={styles.trackButton}>
          <Text style={styles.trackText}>
            {item.status === 'completed' ? 'View Details' : 'Track Order'}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
        </View>
      </View>
    </Card>
  );

  // ── Seller Order Card (with action buttons) ─────────────────
  const renderSellerCard = ({ item }) => {
    const actions = getSellerActions(item);
    const isUpdating = updatingId === item.id;

    return (
      <Card style={styles.orderCard}>
        <View style={styles.orderTop}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderId}>#{item.id?.slice(-8)}</Text>
            <Text style={styles.dishName}>{item.dish_name}</Text>
            <Text style={styles.orderMeta}>
              {item.quantity} pkt • ₹{item.total_price} • {item.buyer_name || 'Buyer'}
            </Text>
            <View style={styles.paymentChip}>
              <Ionicons
                name={item.payment_mode === 'cod' ? 'cash-outline' : item.payment_mode === 'upi_on_delivery' ? 'qr-code-outline' : 'wallet-outline'}
                size={12}
                color={COLORS.textSecondary}
              />
              <Text style={styles.paymentChipText}>
                {(item.payment_mode || '').replace(/_/g, ' ')}
              </Text>
            </View>
          </View>
          <StatusBadge status={item.status} />
        </View>

        {/* Action Buttons for seller */}
        {actions.length > 0 && (
          <View style={styles.actionRow}>
            {actions.map((action) => {
              const meta = ACTION_LABELS[action];
              return (
                <TouchableOpacity
                  key={action}
                  style={[
                    styles.actionBtn,
                    { backgroundColor: meta.color + '15', borderColor: meta.color + '30' },
                    isUpdating && styles.actionBtnDisabled,
                  ]}
                  onPress={() => {
                    if (action === 'rejected') {
                      Alert.alert('Reject Order', 'Are you sure you want to reject this order?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Reject', style: 'destructive', onPress: () => handleSellerAction(item.id, action) },
                      ]);
                    } else if (action === 'accepted') {
                      handleSellerAction(item.id, action);
                    } else {
                      handleSellerStatusUpdate(item.id, action);
                    }
                  }}
                  disabled={isUpdating}
                  activeOpacity={0.7}
                >
                  <Ionicons name={meta.icon} size={16} color={meta.color} />
                  <Text style={[styles.actionBtnText, { color: meta.color }]}>{meta.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Scan QR button for UPI on delivery when order is ready */}
        {item.payment_mode === 'upi_on_delivery' && item.status === 'ready' && item.payment_status === 'pending' && (
          <TouchableOpacity
            style={styles.scanQrBtn}
            onPress={() => navigation.navigate('QRScanner', { order: item })}
            activeOpacity={0.7}
          >
            <Ionicons name="scan" size={18} color={COLORS.info} />
            <Text style={styles.scanQrText}>Scan Buyer's Payment QR</Text>
          </TouchableOpacity>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        {navigation.canGoBack() ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 42 }} />
        )}
        <Text style={styles.headerTitle}>Orders</Text>
        <View style={{ width: 42 }} />
      </View>

      {/* Buyer / Seller Toggle */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, viewMode === 'buyer' && styles.modeBtnActive]}
          onPress={() => { setViewMode('buyer'); setActiveTab('active'); }}
        >
          <Ionicons name="bag-handle-outline" size={16} color={viewMode === 'buyer' ? COLORS.textOnPrimary : COLORS.textMuted} />
          <Text style={[styles.modeText, viewMode === 'buyer' && styles.modeTextActive]}>
            My Orders ({buyerOrders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, viewMode === 'seller' && styles.modeBtnActive]}
          onPress={() => { setViewMode('seller'); setActiveTab('active'); }}
        >
          <Ionicons name="storefront-outline" size={16} color={viewMode === 'seller' ? COLORS.textOnPrimary : COLORS.textMuted} />
          <Text style={[styles.modeText, viewMode === 'seller' && styles.modeTextActive]}>
            Received ({sellerOrders.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active / History Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Active ({activeOrders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            History ({historyOrders.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : displayOrders.length === 0 ? (
        <EmptyState
          icon={viewMode === 'seller' ? 'storefront-outline' : 'receipt-outline'}
          title={viewMode === 'seller'
            ? (activeTab === 'active' ? 'No incoming orders' : 'No past orders')
            : (activeTab === 'active' ? 'No active orders' : 'No order history')
          }
          subtitle={viewMode === 'seller'
            ? 'Orders from buyers will appear here.'
            : 'Your orders will appear here.'}
          actionTitle={viewMode === 'buyer' && activeTab === 'active' ? 'Browse Meals' : undefined}
          onAction={viewMode === 'buyer' && activeTab === 'active'
            ? () => navigation.navigate('MainApp', { screen: 'Dashboard' })
            : undefined}
        />
      ) : (
        <FlatList
          data={displayOrders}
          keyExtractor={(item) => item.id}
          renderItem={viewMode === 'buyer' ? renderBuyerCard : renderSellerCard}
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
  headerTitle: { fontSize: FONTS.size.lg, fontWeight: '700', color: COLORS.textPrimary },
  modeRow: {
    flexDirection: 'row', marginHorizontal: SPACING.xl, marginBottom: SPACING.md,
    backgroundColor: COLORS.backgroundCard, borderRadius: RADIUS.lg, padding: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: SPACING.md, borderRadius: RADIUS.md,
  },
  modeBtnActive: { backgroundColor: COLORS.secondary },
  modeText: { fontSize: FONTS.size.sm, fontWeight: '600', color: COLORS.textMuted },
  modeTextActive: { color: COLORS.textOnPrimary },
  tabRow: {
    flexDirection: 'row', marginHorizontal: SPACING.xl, marginBottom: SPACING.base,
    backgroundColor: COLORS.backgroundCard, borderRadius: RADIUS.lg, padding: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: SPACING.md, alignItems: 'center', borderRadius: RADIUS.md },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: FONTS.size.md, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.textOnPrimary },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.textMuted, fontSize: FONTS.size.md },
  listContent: { paddingHorizontal: SPACING.xl, paddingBottom: 100 },
  orderCard: { marginBottom: SPACING.md },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md },
  orderInfo: { flex: 1 },
  orderId: { color: COLORS.textMuted, fontSize: FONTS.size.xs, fontWeight: '600' },
  dishName: { color: COLORS.textPrimary, fontSize: FONTS.size.base, fontWeight: '700', marginTop: 2 },
  orderMeta: { color: COLORS.textSecondary, fontSize: FONTS.size.sm, marginTop: 4 },
  paymentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6,
    backgroundColor: COLORS.surface, alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.sm,
  },
  paymentChipText: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, textTransform: 'capitalize' },
  orderBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.divider,
  },
  paymentInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paymentText: { color: COLORS.textMuted, fontSize: FONTS.size.xs, textTransform: 'capitalize' },
  trackButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trackText: { color: COLORS.primary, fontSize: FONTS.size.sm, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm,
    paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.divider,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: FONTS.size.sm, fontWeight: '700' },
  scanQrBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    marginTop: SPACING.sm, paddingVertical: SPACING.md, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.info + '10', borderWidth: 1, borderColor: COLORS.info + '30',
  },
  scanQrText: { color: COLORS.info, fontSize: FONTS.size.sm, fontWeight: '700' },
});
