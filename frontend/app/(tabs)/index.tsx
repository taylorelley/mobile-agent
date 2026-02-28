import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/ThemeContext';
import { sendChat } from '../../src/api';

type ToolCall = { call?: any; result?: any };
type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  routing?: string;
  toolCalls?: ToolCall;
  preamble?: string | null;
  rawChatOutput?: string;
  actionOutput?: string | null;
  timestamp: number;
};

const SESSION_ID = `session-${Date.now()}`;

function ActionCard({ toolCalls, colors }: { toolCalls: ToolCall; colors: any }) {
  const call = toolCalls?.call;
  const result = toolCalls?.result;
  if (!call && !result) return null;

  return (
    <View testID="action-card" style={[styles.actionCard, { backgroundColor: colors.actionCardBg, borderLeftColor: colors.actionCardBorder }]}>
      <View style={styles.actionCardHeader}>
        <MaterialCommunityIcons name="lightning-bolt" size={16} color={colors.secondary} />
        <Text style={[styles.actionCardTitle, { color: colors.secondary }]}>
          {call?.tool || 'Action'}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: result?.success ? colors.success + '20' : colors.destructive + '20' }]}>
          <Text style={[styles.statusText, { color: result?.success ? colors.success : colors.destructive }]}>
            {result?.success ? 'Success' : 'Failed'}
          </Text>
        </View>
      </View>
      {call?.params && (
        <Text style={[styles.actionParams, { color: colors.textSecondary }]}>
          {Object.entries(call.params).map(([k, v]) => `${k}: ${v}`).join(' · ')}
        </Text>
      )}
      {result?.result && (
        <Text style={[styles.actionResult, { color: colors.textPrimary }]}>
          {result.result}
        </Text>
      )}
    </View>
  );
}

function ChatBubble({ msg, colors, onLongPress }: { msg: Message; colors: any; onLongPress: () => void }) {
  const isUser = msg.role === 'user';

  return (
    <Pressable
      testID={`chat-bubble-${msg.id}`}
      onLongPress={onLongPress}
      style={[
        styles.bubble,
        isUser ? styles.bubbleUser : styles.bubbleAi,
        {
          backgroundColor: isUser ? colors.bubbleUser : colors.bubbleAi,
          borderColor: isUser ? 'transparent' : colors.bubbleAiBorder,
          borderWidth: isUser ? 0 : 1,
        },
      ]}
    >
      {!isUser && msg.routing && msg.routing !== 'chat_only' && (
        <View style={styles.routingBadge}>
          <MaterialCommunityIcons name="swap-horizontal" size={12} color={colors.accent} />
          <Text style={[styles.routingText, { color: colors.accent }]}>
            {msg.routing === 'action_routed_signal' ? 'Action Routed' :
             msg.routing === 'action_routed_heuristic' ? 'Heuristic Match' :
             msg.routing === 'heuristic_requery' ? 'Re-queried' : msg.routing}
          </Text>
        </View>
      )}
      <Text style={[styles.bubbleText, { color: isUser ? colors.primaryForeground : colors.textPrimary }]}>
        {msg.text}
      </Text>
      {msg.toolCalls && <ActionCard toolCalls={msg.toolCalls} colors={colors} />}
    </Pressable>
  );
}

export default function ChatScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);
    scrollToBottom();

    try {
      const data = await sendChat(text, SESSION_ID);
      const aiMsg: Message = {
        id: data.id || `a-${Date.now()}`,
        role: 'assistant',
        text: data.response,
        routing: data.routing_decision,
        toolCalls: data.tool_calls,
        preamble: data.preamble,
        rawChatOutput: data.raw_chat_output,
        actionOutput: data.action_output,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg: Message = {
        id: `e-${Date.now()}`,
        role: 'system',
        text: `Error: ${err.message || 'Something went wrong'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  }, [inputText, isLoading, scrollToBottom]);

  const handleLongPress = useCallback((msg: Message) => {
    const options: any[] = [{ text: 'Cancel', style: 'cancel' }];
    if (msg.rawChatOutput) {
      options.unshift({
        text: 'View Raw',
        onPress: () => {
          Alert.alert(
            'Raw Output',
            `Routing: ${msg.routing || 'chat_only'}\n\nChat Model:\n${msg.rawChatOutput}\n\n${msg.actionOutput ? `Action Model:\n${msg.actionOutput}` : ''}${msg.toolCalls ? `\n\nTool Calls:\n${JSON.stringify(msg.toolCalls, null, 2)}` : ''}`,
          );
        },
      });
    }
    Alert.alert('Message Options', undefined, options);
  }, []);

  const renderItem = useCallback(({ item }: { item: Message }) => (
    <ChatBubble msg={item} colors={colors} onLongPress={() => handleLongPress(item)} />
  ), [colors, handleLongPress]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="robot-excited-outline" size={64} color={colors.primary + '40'} />
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>LobsterLite</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Your on-device AI agent. Ask me anything or request a device action.
      </Text>
      <View style={styles.emptyChips}>
        {['Tell me a joke', 'Set an alarm for 7am', 'What can you do?'].map((txt) => (
          <TouchableOpacity
            key={txt}
            testID={`suggestion-${txt.replace(/\s/g, '-').toLowerCase()}`}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => setInputText(txt)}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }]}>{txt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  ), [colors]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <MaterialCommunityIcons name="robot-excited-outline" size={28} color={colors.primary} />
        <View style={styles.headerTextWrap}>
          <Text testID="chat-header-title" style={[styles.headerTitle, { color: colors.textPrimary }]}>LobsterLite</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.statusLabel, { color: colors.success }]}>On-Device</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.messageList, messages.length === 0 && styles.emptyList]}
          ListEmptyComponent={renderEmpty}
          onContentSizeChange={scrollToBottom}
          showsVerticalScrollIndicator={false}
        />

        {isLoading && (
          <View style={[styles.typingRow, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <View style={[styles.typingDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.typingText, { color: colors.textSecondary }]}>Processing...</Text>
          </View>
        )}

        <View style={[styles.inputArea, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            testID="chat-input"
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="Message LobsterLite..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            testID="chat-send-button"
            style={[styles.sendBtn, { backgroundColor: inputText.trim() ? colors.primary : colors.border }]}
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <MaterialCommunityIcons name="arrow-up" size={22} color={colors.primaryForeground} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  messageList: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  emptyList: { flex: 1, justifyContent: 'center' },
  bubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, maxWidth: '82%' },
  bubbleUser: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  bubbleAi: { alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  routingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  routingText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  actionCard: {
    marginTop: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderRadius: 8,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  actionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCardTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 'auto' },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  actionParams: { fontSize: 12, marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  actionResult: { fontSize: 13, marginTop: 4, fontWeight: '500' },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  typingDot: { width: 8, height: 8, borderRadius: 4 },
  typingText: { fontSize: 13, fontWeight: '500' },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: { alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 28, fontWeight: '700', marginTop: 16, letterSpacing: -0.5 },
  emptySubtitle: { fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  emptyChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 24 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '500' },
});
