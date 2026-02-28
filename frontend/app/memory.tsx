import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/ThemeContext';
import { getFacts, deleteFact, forgetTopic, getConversations, deleteConversations } from '../src/api';

type Fact = { category: string; key: string; value: string; created_at?: string; updated_at?: string };
type Conversation = { id: string; user_input: string; chat_output: string; routing_decision: string; timestamp: string };

export default function MemoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<'facts' | 'conversations'>('facts');
  const [facts, setFacts] = useState<Fact[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [forgetText, setForgetText] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'facts') {
        const f = await getFacts();
        setFacts(f);
      } else {
        const c = await getConversations(undefined, 100);
        setConversations(c);
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [tab]);

  const handleDeleteFact = (key: string) => {
    Alert.alert('Delete Fact', `Delete "${key}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteFact(key);
            loadData();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const handleForget = async () => {
    if (!forgetText.trim()) return;
    try {
      const res = await forgetTopic(forgetText.trim());
      Alert.alert('Done', `Deleted ${res.deleted_count} memories about "${forgetText}"`);
      setForgetText('');
      loadData();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleClearConversations = () => {
    Alert.alert('Clear All', 'Delete all conversation history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          try { await deleteConversations(); loadData(); } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const categoryIcons: Record<string, string> = {
    identity: 'account-circle-outline',
    preference: 'heart-outline',
    schedule: 'calendar-clock',
    context: 'information-outline',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity testID="memory-back" onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text testID="memory-header-title" style={[styles.headerTitle, { color: colors.textPrimary }]}>Memory Manager</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {(['facts', 'conversations'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            testID={`memory-tab-${t}`}
            style={[styles.tab, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.textSecondary }]}>
              {t === 'facts' ? 'Semantic Facts' : 'Conversations'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.primary} />}
      >
        {tab === 'facts' && (
          <>
            <View style={[styles.forgetRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                testID="forget-input"
                style={[styles.forgetInput, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.border }]}
                placeholder='Say "forget [topic]"...'
                placeholderTextColor={colors.textSecondary}
                value={forgetText}
                onChangeText={setForgetText}
              />
              <TouchableOpacity testID="forget-btn" style={[styles.forgetBtn, { backgroundColor: colors.destructive }]} onPress={handleForget}>
                <MaterialCommunityIcons name="eraser" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
            {facts.length === 0 && !loading && (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="brain" size={48} color={colors.textSecondary + '40'} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No facts stored yet. Chat with your agent to build memory.</Text>
              </View>
            )}
            {facts.map((f, i) => (
              <View key={`${f.category}-${f.key}-${i}`} style={[styles.factCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.factHeader}>
                  <MaterialCommunityIcons name={(categoryIcons[f.category] || 'information-outline') as any} size={18} color={colors.secondary} />
                  <Text style={[styles.factCategory, { color: colors.secondary }]}>{f.category}</Text>
                  <TouchableOpacity testID={`delete-fact-${f.key}`} onPress={() => handleDeleteFact(f.key)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.factKey, { color: colors.textPrimary }]}>{f.key}</Text>
                <Text style={[styles.factValue, { color: colors.textSecondary }]}>{f.value}</Text>
              </View>
            ))}
          </>
        )}

        {tab === 'conversations' && (
          <>
            {conversations.length > 0 && (
              <TouchableOpacity testID="clear-conversations" style={[styles.clearBtn, { borderColor: colors.destructive }]} onPress={handleClearConversations}>
                <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.destructive} />
                <Text style={[styles.clearBtnText, { color: colors.destructive }]}>Clear All Conversations</Text>
              </TouchableOpacity>
            )}
            {conversations.length === 0 && !loading && (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="message-text-outline" size={48} color={colors.textSecondary + '40'} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No conversations yet.</Text>
              </View>
            )}
            {conversations.map((c) => (
              <View key={c.id} style={[styles.convoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.convoHeader}>
                  <View style={[styles.routingBadge, { backgroundColor: c.routing_decision.includes('action') ? colors.accent + '20' : colors.success + '20' }]}>
                    <Text style={[styles.routingBadgeText, { color: c.routing_decision.includes('action') ? colors.accent : colors.success }]}>
                      {c.routing_decision === 'chat_only' ? 'Chat' : 'Action'}
                    </Text>
                  </View>
                  <Text style={[styles.convoTime, { color: colors.textSecondary }]}>
                    {new Date(c.timestamp).toLocaleString()}
                  </Text>
                </View>
                <Text style={[styles.convoUser, { color: colors.textPrimary }]} numberOfLines={2}>
                  {c.user_input}
                </Text>
                <Text style={[styles.convoAssistant, { color: colors.textSecondary }]} numberOfLines={3}>
                  {c.chat_output}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: '600' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  forgetRow: { flexDirection: 'row', gap: 8, marginBottom: 16, padding: 12, borderRadius: 12, borderWidth: 1 },
  forgetInput: { flex: 1, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  forgetBtn: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  factCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  factHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  factCategory: { flex: 1, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  factKey: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  factValue: { fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginBottom: 16 },
  clearBtnText: { fontSize: 13, fontWeight: '600' },
  convoCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  convoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  routingBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  routingBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  convoTime: { fontSize: 11 },
  convoUser: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  convoAssistant: { fontSize: 13 },
});
