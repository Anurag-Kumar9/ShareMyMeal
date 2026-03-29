/**
 * ShareMyMeal — Post a Meal Screen (Seller)
 * =============================================
 * Comprehensive form for sellers to post food listings.
 * Creates real listing via API with user's GPS as pickup location.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, StatusBar, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../../config/firebase';
import { listingsAPI } from '../../services/api';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../utils/theme';
import { PrimaryButton, InputField, Card } from '../../components/SharedComponents';

const PAYMENT_OPTIONS = [
  { id: 'cod', label: 'Cash on Delivery', icon: 'cash-outline', color: COLORS.success },
  { id: 'upi_on_delivery', label: 'UPI on Delivery', icon: 'phone-portrait-outline', color: COLORS.info },
  { id: 'prepaid_upi', label: 'Prepaid UPI', icon: 'wallet-outline', color: COLORS.primary },
];

export default function PostMealScreen({ navigation }) {
  const [dishName, setDishName] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [price, setPrice] = useState('');
  const [packets, setPackets] = useState('');
  const [prepStart, setPrepStart] = useState('');
  const [prepEnd, setPrepEnd] = useState('');
  const [paymentModes, setPaymentModes] = useState({ cod: true, upi_on_delivery: false, prepaid_upi: false });
  const [loading, setLoading] = useState(false);

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow camera access to upload a sample photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const togglePaymentMode = (mode) => {
    setPaymentModes((prev) => ({ ...prev, [mode]: !prev[mode] }));
  };

  const uploadPhoto = async (uri) => {
    try {
      const uid = auth.currentUser?.uid;
      const fileName = `listings/${uid}/${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);

      // React Native compatible blob creation via XMLHttpRequest
      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error('Photo upload failed'));
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
      });

      await uploadBytes(storageRef, blob);
      // Close the blob to free memory
      if (typeof blob.close === 'function') blob.close();

      return await getDownloadURL(storageRef);
    } catch (error) {
      console.log('Photo upload error:', error);
      return null;
    }
  };

  const handlePost = async () => {
    // Validation
    if (!dishName.trim()) return Alert.alert('Missing Info', 'Please enter the dish name.');
    if (!description.trim()) return Alert.alert('Missing Info', 'Please add a description.');
    if (!price || isNaN(price)) return Alert.alert('Missing Info', 'Please enter a valid price.');
    if (!packets || isNaN(packets)) return Alert.alert('Missing Info', 'Please enter number of packets.');
    if (!prepStart || !prepEnd) return Alert.alert('Missing Info', 'Please set preparation time window.');
    if (!Object.values(paymentModes).some(Boolean)) return Alert.alert('Missing Info', 'Select at least one payment mode.');

    setLoading(true);
    try {
      const uid = auth.currentUser?.uid;

      // Get current location for pickup point
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Needed', 'Please allow location access for pickup point.');
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});

      // Upload photo to Firebase Storage
      let photoUrl = null;
      if (photo) {
        photoUrl = await uploadPhoto(photo);
      }

      // Build payment modes array
      const selectedModes = Object.entries(paymentModes)
        .filter(([_, v]) => v)
        .map(([k]) => k);

      // Create listing via API
      const listingData = {
        seller_uid: uid,
        dish_name: dishName.trim(),
        description: description.trim(),
        sample_photo_url: photoUrl || 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400',
        price: parseFloat(price),
        packets_available: parseInt(packets),
        pickup_location: {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        },
        prep_time_start: prepStart,
        prep_time_end: prepEnd,
        payment_modes: selectedModes,
      };

      await listingsAPI.create(listingData);

      setLoading(false);
      Alert.alert('Meal Posted! 🎉', 'Your meal is now visible to nearby neighbors.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      setLoading(false);
      console.error('Post meal error:', error);
      Alert.alert('Error', error.message || 'Failed to post meal.');
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
        <Text style={styles.headerTitle}>Post a Meal</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Sample Photo Upload */}
        <Text style={styles.sectionLabel}>SAMPLE PHOTO</Text>
        <TouchableOpacity style={styles.photoUpload} onPress={handlePickPhoto} activeOpacity={0.7}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.previewImage} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={36} color={COLORS.textMuted} />
              <Text style={styles.photoText}>Tap to upload a sample photo</Text>
              <Text style={styles.photoHint}>This should be a previously cooked reference image</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Dish Details */}
        <InputField label="Dish Name" value={dishName} onChangeText={setDishName}
          placeholder="e.g., Rajma Chawal" icon="restaurant-outline" maxLength={100} />

        <InputField label="Description" value={description} onChangeText={setDescription}
          placeholder="Describe the dish, ingredients, taste..." icon="document-text-outline"
          multiline maxLength={500} />

        {/* Price & Quantity Row */}
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <InputField label="Price (₹/pkt)" value={price} onChangeText={setPrice}
              placeholder="60" keyboardType="numeric" icon="pricetag-outline" />
          </View>
          <View style={styles.halfInput}>
            <InputField label="Packets Available" value={packets} onChangeText={setPackets}
              placeholder="10" keyboardType="numeric" icon="cube-outline" />
          </View>
        </View>

        {/* Prep Time Window */}
        <Text style={styles.sectionLabel}>PREPARATION TIME</Text>
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <InputField label="Start Time" value={prepStart} onChangeText={setPrepStart}
              placeholder="12:00" icon="time-outline" />
          </View>
          <View style={styles.halfInput}>
            <InputField label="End Time" value={prepEnd} onChangeText={setPrepEnd}
              placeholder="13:30" icon="time-outline" />
          </View>
        </View>

        {/* Payment Modes */}
        <Text style={styles.sectionLabel}>ACCEPTED PAYMENT MODES</Text>
        {PAYMENT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.paymentRow, paymentModes[option.id] && styles.paymentRowActive]}
            onPress={() => togglePaymentMode(option.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.paymentIcon, { backgroundColor: option.color + '15' }]}>
              <Ionicons name={option.icon} size={20} color={option.color} />
            </View>
            <Text style={styles.paymentLabel}>{option.label}</Text>
            <Switch
              value={paymentModes[option.id]}
              onValueChange={() => togglePaymentMode(option.id)}
              trackColor={{ false: COLORS.surface, true: COLORS.primary + '60' }}
              thumbColor={paymentModes[option.id] ? COLORS.primary : COLORS.textMuted}
            />
          </TouchableOpacity>
        ))}

        {/* Pickup Location Note */}
        <Card style={styles.pickupNote}>
          <View style={styles.noteHeader}>
            <Ionicons name="location" size={18} color={COLORS.primary} />
            <Text style={styles.noteTitle}>Pickup Location</Text>
          </View>
          <Text style={styles.noteText}>
            Your current location will be used as the pickup point.
            Buyers will see it on the map.
          </Text>
        </Card>

        {/* Post Button */}
        <PrimaryButton
          title="Post Meal"
          icon="add-circle"
          onPress={handlePost}
          loading={loading}
          style={{ marginTop: SPACING.lg }}
        />
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
  sectionLabel: {
    fontSize: FONTS.size.xs, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 1, marginBottom: SPACING.sm, marginTop: SPACING.lg,
  },
  photoUpload: {
    borderRadius: RADIUS.xl, overflow: 'hidden', marginBottom: SPACING.lg,
    borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed',
  },
  previewImage: { width: '100%', height: 180, borderRadius: RADIUS.xl },
  photoPlaceholder: {
    height: 160, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
  },
  photoText: { color: COLORS.textSecondary, fontSize: FONTS.size.md, marginTop: SPACING.sm },
  photoHint: { color: COLORS.textMuted, fontSize: FONTS.size.xs, marginTop: 4, textAlign: 'center', paddingHorizontal: SPACING.xl },
  row: { flexDirection: 'row', gap: SPACING.md },
  halfInput: { flex: 1 },
  paymentRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg, padding: SPACING.base, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  paymentRowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  paymentIcon: {
    width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.md,
  },
  paymentLabel: { flex: 1, fontSize: FONTS.size.md, fontWeight: '600', color: COLORS.textPrimary },
  pickupNote: { marginTop: SPACING.lg },
  noteHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  noteTitle: { color: COLORS.textPrimary, fontWeight: '700', marginLeft: SPACING.sm },
  noteText: { color: COLORS.textSecondary, fontSize: FONTS.size.sm, lineHeight: 20 },
});
