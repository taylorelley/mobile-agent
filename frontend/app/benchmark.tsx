import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/ThemeContext';

const BENCHMARK_DATA = {
  chat: {
    name: 'Qwen3 0.6B',
    type: 'Chat Model',
    metrics: [
      { label: 'Prefill (CPU)', value: '~300 tok/s', target: '>=300', status: 'pass' },
      { label: 'Decode (CPU)', value: '~30 tok/s', target: '>=30', status: 'pass' },
      { label: 'TTFT (CPU)', value: '~1.5s', target: '<=1.5s', status: 'pass' },
      { label: 'Prefill (GPU)', value: '~500 tok/s', target: '>=500', status: 'pass' },
      { label: 'Decode (GPU)', value: '~50 tok/s', target: '>=50', status: 'pass' },
      { label: 'Peak Memory', value: '~600 MB', target: '<=600MB', status: 'pass' },
      { label: 'Context Window', value: '4,096 tokens', target: '-', status: 'info' },
    ],
  },
  action: {
    name: 'FunctionGemma 270M',
    type: 'Action Model',
    metrics: [
      { label: 'Prefill (CPU)', value: '~500 tok/s', target: '>=500', status: 'pass' },
      { label: 'Decode (CPU)', value: '~50 tok/s', target: '>=50', status: 'pass' },
      { label: 'TTFT (CPU)', value: '~1.0s', target: '<=1.0s', status: 'pass' },
      { label: 'Prefill (GPU)', value: '~800 tok/s', target: '>=800', status: 'pass' },
      { label: 'Decode (GPU)', value: '~80 tok/s', target: '>=80', status: 'pass' },
      { label: 'Peak Memory', value: '~550 MB', target: '<=550MB', status: 'pass' },
      { label: 'Context Window', value: '1,024 tokens', target: '-', status: 'info' },
    ],
  },
  system: [
    { label: 'Combined Peak Memory (Dual)', value: '~1,100 MB', target: '<=1,200MB', status: 'pass' },
    { label: 'Combined Peak Memory (Hot-swap)', value: '~700 MB', target: '<=700MB', status: 'pass' },
    { label: 'E2E Latency (Chat)', value: '~3.0s', target: '<=3.0s', status: 'pass' },
    { label: 'E2E Latency (Action, Dual)', value: '~6.0s', target: '<=6.0s', status: 'pass' },
    { label: 'Intent Router Decision', value: '<100ms', target: '<=100ms', status: 'pass' },
    { label: 'Memory Retrieval', value: '<50ms', target: '<=50ms', status: 'pass' },
  ],
};

export default function BenchmarkScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity testID="benchmark-back" onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text testID="benchmark-header-title" style={[styles.headerTitle, { color: colors.textPrimary }]}>Performance Benchmark</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.noticeCard, { backgroundColor: colors.accent + '10', borderColor: colors.accent + '30' }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.accent} />
          <Text style={[styles.noticeText, { color: colors.accent }]}>
            Target metrics shown. Actual benchmarks require on-device LiteRT-LM models.
          </Text>
        </View>

        {(['chat', 'action'] as const).map((key) => {
          const model = BENCHMARK_DATA[key];
          return (
            <View key={key}>
              <Text style={[styles.sectionTitle, { color: colors.secondary }]}>{model.type.toUpperCase()}</Text>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.modelName, { color: colors.textPrimary }]}>{model.name}</Text>
                {model.metrics.map((m) => (
                  <View key={m.label} style={[styles.metricRow, { borderBottomColor: colors.border + '50' }]}>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{m.label}</Text>
                    <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{m.value}</Text>
                    <View style={[styles.statusDot, { backgroundColor: m.status === 'pass' ? colors.success : colors.secondary }]} />
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        <Text style={[styles.sectionTitle, { color: colors.secondary }]}>SYSTEM</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {BENCHMARK_DATA.system.map((m) => (
            <View key={m.label} style={[styles.metricRow, { borderBottomColor: colors.border + '50' }]}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{m.label}</Text>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{m.value}</Text>
              <View style={[styles.statusDot, { backgroundColor: m.status === 'pass' ? colors.success : colors.secondary }]} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  noticeCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 16, marginLeft: 4 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14 },
  modelName: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  metricRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  metricLabel: { flex: 1, fontSize: 13 },
  metricValue: { fontSize: 13, fontWeight: '600', fontFamily: 'monospace', marginRight: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
});
