/**
 * ShareMyMeal — Chat List Screen
 * ==================================
 * Shows all conversations the current user is involved in.
 * Real-time Firestore listener on the `chats` collection.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import { EmptyState } from '../../components/SharedComponents';

export default function ChatListScreen({ navigation }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!currentUid) {
      setLoading(false);
      return;
    }

    // Listen for chats where current user is a participant
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', currentUid),
      orderBy('last_message_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setChats(chatList);
      setLoading(false);
    }, (error) => {
      console.error('Chat list error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUid]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    if (diff < 86400000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 172800000) return 'Yesterday';
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  const getOtherUserName = (chat) => {
    if (!currentUid) return 'Unknown';
    return chat.participant_names?.[
      chat.participants?.find((p) => p !== currentUid)
    ] || 'User';
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => navigation.navigate('Chat', {
        chatId: item.id,
        otherUserName: getOtherUserName(item),
        orderId: item.order_id,
      })}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Ionicons name="person" size={20} color={COLORS.primary} />
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatTopRow}>
          <Text style={styles.chatName} numberOfLines={1}>{getOtherUserName(item)}</Text>
          <Text style={styles.chatTime}>{formatTime(item.last_message_at)}</Text>
        </View>
        <Text style={styles.chatPreview} numberOfLines={1}>
          {item.last_message || 'No messages yet'}
        </Text>
        {item.dish_name && (
          <Text style={styles.chatDish} numberOfLines={1}>🍽️ {item.dish_name}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading chats...</Text>
        </View>
      ) : chats.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="No conversations yet"
          subtitle="Start a conversation by ordering a meal or receiving an order."
        />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: SPACING.xl, paddingTop: 50, paddingBottom: SPACING.md,
  },
  headerTitle: { fontSize: FONTS.size.xxl, fontWeight: '800', color: COLORS.textPrimary },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.textMuted, fontSize: FONTS.size.md },
  listContent: { paddingHorizontal: SPACING.xl, paddingBottom: 100 },
  chatItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary + '15',
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md,
  },
  chatInfo: { flex: 1 },
  chatTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { fontSize: FONTS.size.base, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  chatTime: { fontSize: FONTS.size.xs, color: COLORS.textMuted, marginLeft: SPACING.sm },
  chatPreview: { fontSize: FONTS.size.sm, color: COLORS.textSecondary },
  chatDish: { fontSize: FONTS.size.xs, color: COLORS.primary, marginTop: 2, fontWeight: '600' },
});
