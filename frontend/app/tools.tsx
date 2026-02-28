import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/ThemeContext';
import { getTools, deleteCustomTool } from '../src/api';

type Tool = {
  name: string;
  description: string;
  parameters: Record<string, any>;
  android_action: string;
  permissions: string[];
  builtin: boolean;
};

export default function ToolsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTools = async () => {
    setLoading(true);
    try {
      const t = await getTools();
      setTools(t);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadTools(); }, []);

  const handleDelete = (name: string) => {
    Alert.alert('Remove Tool', `Delete custom tool "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteCustomTool(name); loadTools(); } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const builtIn = tools.filter((t) => t.builtin);
  const custom = tools.filter((t) => !t.builtin);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity testID="tools-back" onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text testID="tools-header-title" style={[styles.headerTitle, { color: colors.textPrimary }]}>Tool Manager</Text>
        <View style={[styles.countBadge, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[styles.countText, { color: colors.primary }]}>{tools.length}/30</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadTools} tintColor={colors.primary} />}
      >
        <Text style={[styles.sectionTitle, { color: colors.secondary }]}>BUILT-IN TOOLS ({builtIn.length})</Text>
        {builtIn.map((tool) => (
          <View key={tool.name} style={[styles.toolCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.toolHeader}>
              <MaterialCommunityIcons name="lightning-bolt" size={18} color={colors.accent} />
              <Text style={[styles.toolName, { color: colors.textPrimary }]}>{tool.name}</Text>
              {tool.permissions.length > 0 && (
                <View style={[styles.permBadge, { backgroundColor: colors.accent + '20' }]}>
                  <MaterialCommunityIcons name="shield-alert-outline" size={12} color={colors.accent} />
                  <Text style={[styles.permText, { color: colors.accent }]}>{tool.permissions.join(', ')}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.toolDesc, { color: colors.textSecondary }]}>{tool.description}</Text>
            <View style={styles.toolMeta}>
              <Text style={[styles.toolAction, { color: colors.textSecondary }]}>
                {tool.android_action}
              </Text>
              <Text style={[styles.toolParams, { color: colors.textSecondary }]}>
                {Object.keys(tool.parameters).length} params
              </Text>
            </View>
          </View>
        ))}

        {custom.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.secondary }]}>CUSTOM TOOLS ({custom.length})</Text>
            {custom.map((tool) => (
              <View key={tool.name} style={[styles.toolCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.toolHeader}>
                  <MaterialCommunityIcons name="puzzle-outline" size={18} color={colors.primary} />
                  <Text style={[styles.toolName, { color: colors.textPrimary }]}>{tool.name}</Text>
                  <TouchableOpacity testID={`delete-tool-${tool.name}`} onPress={() => handleDelete(tool.name)}>
                    <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.toolDesc, { color: colors.textSecondary }]}>{tool.description}</Text>
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
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', marginLeft: 12 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  countText: { fontSize: 12, fontWeight: '700' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 10, marginTop: 8, marginLeft: 4 },
  toolCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  toolHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  toolName: { flex: 1, fontSize: 15, fontWeight: '700', fontFamily: 'monospace' },
  toolDesc: { fontSize: 13, lineHeight: 20 },
  toolMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  toolAction: { fontSize: 11, fontFamily: 'monospace' },
  toolParams: { fontSize: 11 },
  permBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  permText: { fontSize: 10, fontWeight: '600' },
});
