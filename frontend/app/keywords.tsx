import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/ThemeContext';
import { getKeywords, updateKeywords } from '../src/api';

export default function KeywordsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [loading, setLoading] = useState(true);

  const loadKeywords = async () => {
    setLoading(true);
    try {
      const kw = await getKeywords();
      setKeywords(kw.keywords || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadKeywords(); }, []);

  const handleAdd = async () => {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw) return;
    if (keywords.includes(kw)) { Alert.alert('Exists', 'This keyword already exists.'); return; }
    const updated = [...keywords, kw];
    try {
      await updateKeywords(updated);
      setKeywords(updated);
      setNewKeyword('');
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleRemove = async (kw: string) => {
    const updated = keywords.filter((k) => k !== kw);
    try {
      await updateKeywords(updated);
      setKeywords(updated);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity testID="keywords-back" onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text testID="keywords-header-title" style={[styles.headerTitle, { color: colors.textPrimary }]}>Action Keywords</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="information-outline" size={16} color={colors.secondary} />
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          {"These keywords trigger the Intent Router's heuristic fallback when the Chat Model doesn't emit an [ACTION:] signal."}
        </Text>
      </View>

      <View style={[styles.addRow, { borderColor: colors.border }]}>
        <TextInput
          testID="keyword-input"
          style={[styles.addInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
          value={newKeyword}
          onChangeText={setNewKeyword}
          placeholder="Add keyword..."
          placeholderTextColor={colors.textSecondary}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <TouchableOpacity testID="keyword-add-btn" style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={handleAdd}>
          <MaterialCommunityIcons name="plus" size={20} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadKeywords} tintColor={colors.primary} />}
      >
        <View style={styles.chipContainer}>
          {keywords.map((kw) => (
            <View key={kw} style={[styles.chip, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
              <Text style={[styles.chipText, { color: colors.textPrimary }]}>{kw}</Text>
              <TouchableOpacity testID={`remove-kw-${kw}`} onPress={() => handleRemove(kw)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Text style={[styles.countText, { color: colors.textSecondary }]}>
          {keywords.length} keywords configured
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, margin: 16, marginBottom: 0, padding: 12, borderRadius: 10, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
  addRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  addInput: { flex: 1, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  addBtn: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '500' },
  countText: { fontSize: 12, marginTop: 16, textAlign: 'center' },
});
