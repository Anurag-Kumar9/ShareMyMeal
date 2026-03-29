/**
 * ShareMyMeal — Rating & Review Screen
 * ========================================
 * Star rating (1–5) with optional text review.
 * Shown after buyer confirms food pickup.
 * Submits real rating via API.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../config/firebase';
import { ratingsAPI } from '../../services/api';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../utils/theme';
import { PrimaryButton, StarRatingInput, Card } from '../../components/SharedComponents';

export default function RatingScreen({ route, navigation }) {
  const order = route?.params?.order || {};
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rate the Seller', 'Please select at least 1 star.');
      return;
    }

    setLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      await ratingsAPI.submit({
        order_id: order.id,
        buyer_uid: uid,
        seller_uid: order.seller_uid,
        stars: rating,
        review_text: reviewText.trim() || null,
      });

      setLoading(false);
      Alert.alert('Thank You! 🎉', 'Your review helps build a safer community.', [
        { text: 'OK', onPress: () => navigation.navigate('MainApp', { screen: 'Dashboard' }) },
      ]);
    } catch (error) {
      setLoading(false);
      console.error('Rating error:', error);
      Alert.alert('Error', error.message || 'Failed to submit review.');
    }
  };

  const QUICK_REVIEWS = ['Excellent food! 🔥', 'Fresh & tasty', 'Good portion size', 'Will order again'];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate & Review</Text>
        <View style={{ width: 42 }} />
      </View>

      <View style={styles.content}>
        {/* Order Info */}
        <Card style={styles.orderCard}>
          <Text style={styles.dishName}>{order.dish_name}</Text>
          <Text style={styles.sellerName}>by {order.seller_name || 'Seller'}</Text>
        </Card>

        {/* Star Rating */}
        <Text style={styles.promptText}>How was the food?</Text>
        <StarRatingInput rating={rating} onRate={setRating} size={44} />
        <Text style={styles.ratingLabel}>
          {rating === 0 ? 'Tap to rate' : ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}
        </Text>

        {/* Quick Review Tags */}
        <View style={styles.quickTags}>
          {QUICK_REVIEWS.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[styles.quickTag, reviewText === tag && styles.quickTagActive]}
              onPress={() => setReviewText(tag)}
            >
              <Text style={[styles.quickTagText, reviewText === tag && styles.quickTagTextActive]}>
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Review Text */}
        <View style={styles.reviewInput}>
          <TextInput
            style={styles.textArea}
            value={reviewText}
            onChangeText={setReviewText}
            placeholder="Share your experience (optional)..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={500}
          />
          <Text style={styles.charCount}>{reviewText.length}/500</Text>
        </View>
      </View>

      {/* Submit */}
      <View style={styles.bottomCTA}>
        <PrimaryButton
          title="Submit Review"
          icon="star"
          onPress={handleSubmit}
          loading={loading}
          disabled={rating === 0}
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
  content: { flex: 1, paddingHorizontal: SPACING.xl, alignItems: 'center' },
  orderCard: { width: '100%', alignItems: 'center', marginBottom: SPACING.xxl },
  dishName: { fontSize: FONTS.size.xl, fontWeight: '700', color: COLORS.textPrimary },
  sellerName: { fontSize: FONTS.size.md, color: COLORS.textSecondary, marginTop: 4 },
  promptText: {
    fontSize: FONTS.size.xxl, fontWeight: '800', color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  ratingLabel: {
    fontSize: FONTS.size.lg, fontWeight: '600', color: COLORS.accent,
    marginTop: SPACING.md, marginBottom: SPACING.xl,
  },
  quickTags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
  quickTag: {
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm, borderRadius: RADIUS.full,
    backgroundColor: COLORS.backgroundCard, borderWidth: 1, borderColor: COLORS.border,
  },
  quickTagActive: { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary },
  quickTagText: { color: COLORS.textSecondary, fontSize: FONTS.size.sm },
  quickTagTextActive: { color: COLORS.primary, fontWeight: '600' },
  reviewInput: {
    width: '100%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.base,
  },
  textArea: {
    color: COLORS.textPrimary, fontSize: FONTS.size.md, minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: { alignSelf: 'flex-end', color: COLORS.textMuted, fontSize: FONTS.size.xs, marginTop: 4 },
  bottomCTA: {
    paddingHorizontal: SPACING.xl, paddingBottom: 40, paddingTop: SPACING.lg,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
});
