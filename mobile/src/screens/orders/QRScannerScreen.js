/**
 * ShareMyMeal — QR Scanner Screen (Seller)
 * =============================================
 * Seller opens camera to scan buyer's payment QR code.
 * On successful scan, sends decoded payload to backend /scan-qr endpoint.
 * Money flow: Buyer wallet → Company account (held until pickup confirmed).
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { paymentsAPI } from '../../services/api';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../utils/theme';
import { PrimaryButton, Card } from '../../components/SharedComponents';

export default function QRScannerScreen({ route, navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);

    try {
      // Parse the QR payload
      const payload = JSON.parse(data);

      if (!payload.order_id || !payload.amount || !payload.buyer_uid) {
        Alert.alert('Invalid QR', 'This QR code is not a valid ShareMyMeal payment QR.');
        setScanned(false);
        setProcessing(false);
        return;
      }

      // Confirm with seller before processing
      Alert.alert(
        'Confirm Payment',
        `Collect ₹${payload.amount} from buyer for Order #${payload.order_id.slice(-8)}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setScanned(false);
              setProcessing(false);
            },
          },
          {
            text: '✅ Confirm',
            onPress: async () => {
              try {
                // Call backend scan-qr endpoint
                const response = await paymentsAPI.scanQRPayment({
                  order_id: payload.order_id,
                  buyer_uid: payload.buyer_uid,
                  amount: payload.amount,
                });

                setResult({
                  success: true,
                  amount: payload.amount,
                  orderId: payload.order_id,
                  message: response.message || 'Payment collected successfully!',
                });
              } catch (error) {
                setResult({
                  success: false,
                  message: error.message || 'Payment failed. Please try again.',
                });
              } finally {
                setProcessing(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Invalid QR', 'Could not read this QR code.');
      setScanned(false);
      setProcessing(false);
    }
  };

  // Permission not yet determined
  if (!permission) {
    return <View style={styles.container} />;
  }

  // Permission not granted
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to scan payment QR codes from buyers.
          </Text>
          <PrimaryButton
            title="Grant Permission"
            icon="camera"
            onPress={requestPermission}
            style={{ marginTop: SPACING.xl }}
          />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelLink}>
            <Text style={styles.cancelText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Success/Error result screen
  if (result) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <View style={styles.resultContainer}>
          <View style={[styles.resultIcon, {
            backgroundColor: result.success ? COLORS.success + '15' : COLORS.error + '15',
          }]}>
            <Ionicons
              name={result.success ? 'checkmark-circle' : 'close-circle'}
              size={64}
              color={result.success ? COLORS.success : COLORS.error}
            />
          </View>
          <Text style={styles.resultTitle}>
            {result.success ? 'Payment Collected!' : 'Payment Failed'}
          </Text>
          {result.success && (
            <Text style={styles.resultAmount}>₹{result.amount}</Text>
          )}
          <Text style={styles.resultMessage}>{result.message}</Text>
          {result.success && (
            <Card style={styles.resultCard}>
              <View style={styles.resultDetailRow}>
                <Text style={styles.resultDetailLabel}>Order</Text>
                <Text style={styles.resultDetailValue}>#{(result.orderId || '').slice(-8)}</Text>
              </View>
              <View style={styles.resultDetailRow}>
                <Text style={styles.resultDetailLabel}>Status</Text>
                <Text style={[styles.resultDetailValue, { color: COLORS.success }]}>Held by Platform</Text>
              </View>
              <View style={styles.resultDetailRow}>
                <Text style={styles.resultDetailLabel}>Payout</Text>
                <Text style={styles.resultDetailValue}>After buyer confirms pickup</Text>
              </View>
            </Card>
          )}
          <PrimaryButton
            title="Done"
            icon="checkmark"
            onPress={() => navigation.goBack()}
            style={{ marginTop: SPACING.xl, width: '100%' }}
          />
          {!result.success && (
            <TouchableOpacity
              onPress={() => { setResult(null); setScanned(false); }}
              style={styles.retryLink}
            >
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Camera scanner view
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Top bar */}
          <View style={styles.scanHeader}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.scanBackBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.scanTitle}>Scan Payment QR</Text>
            <View style={{ width: 42 }} />
          </View>

          {/* Viewfinder */}
          <View style={styles.viewfinderContainer}>
            <View style={styles.viewfinder}>
              {/* Corner brackets */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {processing && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.processingText}>Processing...</Text>
                </View>
              )}
            </View>
          </View>

          {/* Bottom instruction */}
          <View style={styles.scanBottom}>
            <View style={styles.scanInstruction}>
              <Ionicons name="qr-code-outline" size={20} color={COLORS.primary} />
              <Text style={styles.scanInstructionText}>
                Point camera at buyer's payment QR code
              </Text>
            </View>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  // Permission screen
  permissionContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xxl,
  },
  permissionTitle: {
    fontSize: FONTS.size.xl, fontWeight: '700', color: COLORS.textPrimary,
    marginTop: SPACING.xl, marginBottom: SPACING.md, textAlign: 'center',
  },
  permissionText: {
    fontSize: FONTS.size.md, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22,
  },
  cancelLink: { marginTop: SPACING.lg },
  cancelText: { color: COLORS.textMuted, fontSize: FONTS.size.md },
  // Result screen
  resultContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xxl,
  },
  resultIcon: {
    width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center',
  },
  resultTitle: {
    fontSize: FONTS.size.xxl, fontWeight: '800', color: COLORS.textPrimary,
    marginTop: SPACING.xl,
  },
  resultAmount: {
    fontSize: 48, fontWeight: '900', color: COLORS.success, marginVertical: SPACING.sm,
  },
  resultMessage: {
    fontSize: FONTS.size.md, color: COLORS.textSecondary, textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  resultCard: { width: '100%' },
  resultDetailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  resultDetailLabel: { fontSize: FONTS.size.sm, color: COLORS.textMuted },
  resultDetailValue: { fontSize: FONTS.size.sm, color: COLORS.textPrimary, fontWeight: '600' },
  retryLink: { marginTop: SPACING.lg },
  retryText: { color: COLORS.primary, fontSize: FONTS.size.md, fontWeight: '600' },
  // Camera scanner
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  scanHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: 54, paddingBottom: SPACING.md,
  },
  scanBackBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  scanTitle: { fontSize: FONTS.size.lg, fontWeight: '700', color: '#FFFFFF' },
  viewfinderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewfinder: {
    width: 260, height: 260, borderRadius: RADIUS.xl,
    backgroundColor: 'transparent', borderWidth: 0,
    position: 'relative',
  },
  corner: {
    position: 'absolute', width: 30, height: 30,
    borderColor: COLORS.primary, borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: RADIUS.md },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: RADIUS.md },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: RADIUS.md },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: RADIUS.md },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: RADIUS.xl,
  },
  processingText: { color: '#FFFFFF', marginTop: SPACING.md, fontWeight: '600' },
  scanBottom: {
    paddingHorizontal: SPACING.xl, paddingBottom: 40,
  },
  scanInstruction: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.1)', padding: SPACING.base, borderRadius: RADIUS.xl,
  },
  scanInstructionText: {
    color: '#FFFFFF', fontSize: FONTS.size.sm, fontWeight: '600',
  },
});
