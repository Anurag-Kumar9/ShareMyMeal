/**
 * ShareMyMeal — Chat Screen
 * ============================
 * Real-time buyer-seller chat per conversation thread.
 * WhatsApp-style keyboard behavior — messages push up when typing.
 * Built on Firestore real-time listeners.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

export default function ChatScreen({ route, navigation }) {
  const chatId = route?.params?.chatId;
  const otherUserName = route?.params?.otherUserName || 'Chat';
  const orderId = route?.params?.orderId;
  const currentUserUid = auth.currentUser?.uid;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef(null);

  useEffect(() => {
    if (!chatId) return;

    // Real-time listener for messages
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setMessages(msgs);
    }, (error) => {
      console.error('Chat messages error:', error);
    });

    return () => unsubscribe();
  }, [chatId]);

  // Scroll to bottom when keyboard shows (Android)
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        // Small delay to let the layout settle
        setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
      }
    );
    return () => showSub.remove();
  }, []);

  const sendMessage = async () => {
    if (!inputText.trim() || !chatId || !currentUserUid) return;

    const text = inputText.trim();
    setInputText('');

    try {
      // Add message to Firestore
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        sender_uid: currentUserUid,
        text: text,
        timestamp: serverTimestamp(),
      });

      // Update the chat document with last message info
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        last_message: text,
        last_message_at: serverTimestamp(),
        last_message_by: currentUserUid,
      });
    } catch (error) {
      console.error('Send message error:', error);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }) => {
    const isMe = item.sender_uid === currentUserUid;
    return (
      <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
        <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{item.text}</Text>
          <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{otherUserName}</Text>
          {orderId && <Text style={styles.headerSub}>Order #{orderId}</Text>}
        </View>
        <View style={styles.onlineIndicator}>
          <View style={styles.onlineDot} />
        </View>
      </View>

      {/* Chat body with keyboard avoidance */}
      <KeyboardAvoidingView
        style={styles.chatBody}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Messages — inverted FlatList (newest at bottom) */}
        {messages.length === 0 ? (
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubble-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyChatText}>Start the conversation!</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            inverted
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          />
        )}

        {/* Input Area */}
        <View style={styles.inputArea}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={500}
              onFocus={() => {
                setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 200);
              }}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
            activeOpacity={0.7}
          >
            <Ionicons name="send" size={20} color={COLORS.textOnPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl,
    paddingTop: 50, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: RADIUS.md, backgroundColor: COLORS.backgroundCard,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  headerInfo: { flex: 1, marginLeft: SPACING.md },
  headerTitle: { fontSize: FONTS.size.lg, fontWeight: '700', color: COLORS.textPrimary },
  headerSub: { fontSize: FONTS.size.xs, color: COLORS.textMuted },
  onlineIndicator: { paddingRight: SPACING.sm },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success },
  chatBody: { flex: 1 },
  emptyChat: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  emptyChatText: {
    color: COLORS.textMuted, fontSize: FONTS.size.md, marginTop: SPACING.md,
  },
  messageList: { paddingHorizontal: SPACING.base, paddingVertical: SPACING.md },
  messageRow: { marginBottom: SPACING.md, flexDirection: 'row' },
  messageRowMe: { justifyContent: 'flex-end' },
  messageBubble: {
    maxWidth: '75%', paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
  },
  bubbleOther: {
    backgroundColor: COLORS.backgroundCard, borderBottomLeftRadius: RADIUS.xs,
    borderWidth: 1, borderColor: COLORS.border,
  },
  bubbleMe: {
    backgroundColor: COLORS.primary, borderBottomRightRadius: RADIUS.xs,
  },
  messageText: { fontSize: FONTS.size.md, color: COLORS.textPrimary, lineHeight: 20 },
  messageTextMe: { color: COLORS.textOnPrimary },
  messageTime: { fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  messageTimeMe: { color: COLORS.white40 },
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm, paddingBottom: Platform.OS === 'ios' ? SPACING.lg : SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  inputContainer: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.base, marginRight: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border, maxHeight: 100,
  },
  textInput: {
    color: COLORS.textPrimary, fontSize: FONTS.size.md, paddingVertical: SPACING.md,
    minHeight: 40,
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  sendButtonDisabled: { backgroundColor: COLORS.surface },
});
