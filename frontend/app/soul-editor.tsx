import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/ThemeContext';
import { getSoul, updateSoul } from '../src/api';

export default function SoulEditorScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const soul = await getSoul();
        setContent(soul.content || '');
        setTokenCount(Math.floor((soul.content || '').length / 4));
      } catch (e) {}
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    setTokenCount(Math.floor(content.length / 4));
  }, [content]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateSoul(content);
      let msg = 'SOUL document saved.';
      if (res.warning) msg += `\n\n${res.warning}`;
      Alert.alert('Saved', msg);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setSaving(false);
  };

  const handleReset = () => {
    Alert.alert('Reset', 'Reset to default SOUL document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        onPress: () => {
          setContent(`# Identity\n- Name: LobsterLite\n- Role: Personal AI assistant\n\n# Personality\n- Tone: Friendly, concise, and helpful\n- Style: Direct answers with a touch of warmth\n\n# Rules\n- Always respect user privacy\n- Never make up information\n- Be honest about limitations\n\n# Knowledge\n- General purpose assistant\n`);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity testID="soul-back" onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text testID="soul-header-title" style={[styles.headerTitle, { color: colors.textPrimary }]}>SOUL Editor</Text>
        <TouchableOpacity testID="soul-save" onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialCommunityIcons name="content-save-outline" size={24} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.tokenBar, { backgroundColor: colors.surfaceHighlight }]}>
        <MaterialCommunityIcons name="information-outline" size={14} color={colors.textSecondary} />
        <Text style={[styles.tokenText, { color: colors.textSecondary }]}>
          ~{tokenCount} tokens {tokenCount > 512 ? '(will be truncated)' : '(within budget)'}
        </Text>
        <TouchableOpacity testID="soul-reset" onPress={handleReset}>
          <Text style={[styles.resetText, { color: colors.destructive }]}>Reset</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.sectionHelp, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.helpTitle, { color: colors.textPrimary }]}>Sections</Text>
        <Text style={[styles.helpText, { color: colors.textSecondary }]}>
          # Identity · # Personality · # Rules · # Knowledge
        </Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.flex}>
          <TextInput
            testID="soul-editor-input"
            style={[styles.editor, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.border }]}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            placeholder="Write your SOUL document here..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  tokenBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
  tokenText: { flex: 1, fontSize: 12 },
  resetText: { fontSize: 12, fontWeight: '600' },
  sectionHelp: { marginHorizontal: 16, marginTop: 8, padding: 10, borderRadius: 8, borderWidth: 1 },
  helpTitle: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  helpText: { fontSize: 11 },
  editor: {
    flex: 1,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 400,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
