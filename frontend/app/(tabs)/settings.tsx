import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/ThemeContext';
import { deleteAllData, getSettings, updateSettings } from '../../src/api';
import type { ThemeMode } from '../../src/theme';

type SettingsRow = {
  icon: string;
  label: string;
  subtitle?: string;
  route?: string;
  action?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
  testID: string;
};

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const router = useRouter();

  const themeModes: { label: string; value: ThemeMode; icon: string }[] = [
    { label: 'Light', value: 'light', icon: 'weather-sunny' },
    { label: 'Dark', value: 'dark', icon: 'weather-night' },
    { label: 'System', value: 'system', icon: 'cellphone' },
  ];

  const handleDeleteAll = () => {
    Alert.alert(
      'Delete All Data',
      'This will permanently wipe all conversations, memories, settings, and custom tools. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAllData();
              Alert.alert('Done', 'All data has been securely wiped.');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ],
    );
  };

  const sections: { title: string; rows: SettingsRow[] }[] = [
    {
      title: 'Agent',
      rows: [
        { icon: 'file-document-edit-outline', label: 'SOUL Document', subtitle: 'Edit personality & behavior', route: '/soul-editor', testID: 'settings-soul-editor' },
        { icon: 'swap-horizontal', label: 'Action Keywords', subtitle: 'Configure intent router', route: '/keywords', testID: 'settings-keywords' },
      ],
    },
    {
      title: 'Data',
      rows: [
        { icon: 'brain', label: 'Memory Manager', subtitle: 'Facts & conversation history', route: '/memory', testID: 'settings-memory' },
        { icon: 'folder-outline', label: 'File Manager', subtitle: 'Access & edit local files', route: '/files', testID: 'settings-files' },
        { icon: 'toolbox-outline', label: 'Tool Manager', subtitle: '16 built-in + custom tools', route: '/tools', testID: 'settings-tools' },
      ],
    },
    {
      title: 'Models',
      rows: [
        { icon: 'download-outline', label: 'Model Manager', subtitle: 'Download & manage models', route: '/models', testID: 'settings-models' },
        { icon: 'speedometer', label: 'Performance Benchmark', subtitle: 'Per-model inference metrics', route: '/benchmark', testID: 'settings-benchmark' },
      ],
    },
    {
      title: 'Danger Zone',
      rows: [
        { icon: 'trash-can-outline', label: 'Delete All Data', subtitle: 'Wipe everything permanently', action: handleDeleteAll, destructive: true, testID: 'settings-delete-all' },
      ],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <Text testID="settings-header-title" style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Theme Section */}
        <Text style={[styles.sectionTitle, { color: colors.secondary }]}>APPEARANCE</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.themeRow}>
            {themeModes.map((t) => (
              <TouchableOpacity
                key={t.value}
                testID={`theme-${t.value}`}
                style={[
                  styles.themeBtn,
                  {
                    backgroundColor: mode === t.value ? colors.primary + '15' : 'transparent',
                    borderColor: mode === t.value ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setMode(t.value)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={t.icon as any}
                  size={22}
                  color={mode === t.value ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.themeBtnLabel, { color: mode === t.value ? colors.primary : colors.textSecondary }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Other Sections */}
        {sections.map((section) => (
          <View key={section.title}>
            <Text style={[styles.sectionTitle, { color: colors.secondary }]}>{section.title.toUpperCase()}</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {section.rows.map((row, idx) => (
                <TouchableOpacity
                  key={row.label}
                  testID={row.testID}
                  style={[
                    styles.row,
                    idx < section.rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
                  ]}
                  onPress={() => {
                    if (row.route) router.push(row.route as any);
                    else if (row.action) row.action();
                  }}
                  activeOpacity={0.6}
                >
                  <MaterialCommunityIcons
                    name={row.icon as any}
                    size={22}
                    color={row.destructive ? colors.destructive : colors.textSecondary}
                  />
                  <View style={styles.rowTextWrap}>
                    <Text style={[styles.rowLabel, { color: row.destructive ? colors.destructive : colors.textPrimary }]}>
                      {row.label}
                    </Text>
                    {row.subtitle && (
                      <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{row.subtitle}</Text>
                    )}
                  </View>
                  {row.rightElement || (
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>LobsterLite v0.2.0</Text>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>Dual-Model • On-Device Agent</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 20, marginLeft: 4 },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  themeRow: { flexDirection: 'row', padding: 8, gap: 8 },
  themeBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1, gap: 4 },
  themeBtnLabel: { fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowTextWrap: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  footer: { alignItems: 'center', marginTop: 32, gap: 4 },
  footerText: { fontSize: 12 },
});
