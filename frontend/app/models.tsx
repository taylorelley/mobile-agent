import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/ThemeContext';
import { getModels, downloadModel, getModelStatus } from '../src/api';

type Model = {
  id: string;
  name: string;
  type: string;
  description: string;
  huggingface_url: string;
  size_mb: number;
  quantization: string;
  format: string;
  context_window: number;
  status: string;
  progress: number;
  download_speed: string | null;
  is_default: boolean;
};

export default function ModelsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const loadModels = async () => {
    setLoading(true);
    try {
      const m = await getModels();
      setModels(m);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    loadModels();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleDownload = async (modelId: string) => {
    try {
      await downloadModel(modelId);
      // Start polling for progress
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const status = await getModelStatus(modelId);
          setModels((prev) => prev.map((m) => m.id === modelId ? { ...m, ...status } : m));
          if (status.status === 'downloaded') {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch (e) {}
      }, 600);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity testID="models-back" onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text testID="models-header-title" style={[styles.headerTitle, { color: colors.textPrimary }]}>Model Manager</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadModels} tintColor={colors.primary} />}
      >
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="information-outline" size={18} color={colors.secondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Models are downloaded from HuggingFace for on-device inference. Total install size: ~650MB.
          </Text>
        </View>

        {models.map((model) => (
          <View key={model.id} style={[styles.modelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modelHeader}>
              <View style={[styles.typeBadge, { backgroundColor: model.type === 'chat' ? colors.primary + '20' : colors.secondary + '20' }]}>
                <Text style={[styles.typeText, { color: model.type === 'chat' ? colors.primary : colors.secondary }]}>
                  {model.type === 'chat' ? 'CHAT MODEL' : 'ACTION MODEL'}
                </Text>
              </View>
              {model.is_default && (
                <View style={[styles.defaultBadge, { backgroundColor: colors.accent + '20' }]}>
                  <Text style={[styles.defaultText, { color: colors.accent }]}>DEFAULT</Text>
                </View>
              )}
            </View>

            <Text style={[styles.modelName, { color: colors.textPrimary }]}>{model.name}</Text>
            <Text style={[styles.modelDesc, { color: colors.textSecondary }]}>{model.description}</Text>

            <View style={styles.specRow}>
              <SpecChip label={`${model.size_mb} MB`} icon="harddisk" colors={colors} />
              <SpecChip label={model.quantization} icon="cpu-64-bit" colors={colors} />
              <SpecChip label={`${model.context_window} tok`} icon="text-box-outline" colors={colors} />
            </View>

            {model.status === 'not_downloaded' && (
              <TouchableOpacity
                testID={`download-${model.id}`}
                style={[styles.downloadBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleDownload(model.id)}
              >
                <MaterialCommunityIcons name="download-outline" size={18} color={colors.primaryForeground} />
                <Text style={[styles.downloadBtnText, { color: colors.primaryForeground }]}>
                  Download from HuggingFace
                </Text>
              </TouchableOpacity>
            )}

            {model.status === 'downloading' && (
              <View>
                <View style={styles.progressRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                    Downloading... {model.progress}%
                  </Text>
                  {model.download_speed && (
                    <Text style={[styles.speedText, { color: colors.textSecondary }]}>{model.download_speed}</Text>
                  )}
                </View>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View style={[styles.progressFill, { width: `${model.progress}%`, backgroundColor: colors.primary }]} />
                </View>
              </View>
            )}

            {model.status === 'downloaded' && (
              <View style={[styles.downloadedRow, { backgroundColor: colors.success + '10' }]}>
                <MaterialCommunityIcons name="check-circle" size={18} color={colors.success} />
                <Text style={[styles.downloadedText, { color: colors.success }]}>Downloaded & Ready</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.hfLink}
              onPress={() => Alert.alert('HuggingFace', model.huggingface_url)}
            >
              <MaterialCommunityIcons name="open-in-new" size={14} color={colors.textSecondary} />
              <Text style={[styles.hfLinkText, { color: colors.textSecondary }]}>View on HuggingFace</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function SpecChip({ label, icon, colors }: { label: string; icon: string; colors: any }) {
  return (
    <View style={[styles.specChip, { backgroundColor: colors.surfaceHighlight }]}>
      <MaterialCommunityIcons name={icon as any} size={14} color={colors.textSecondary} />
      <Text style={[styles.specText, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 20 },
  modelCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 14 },
  modelHeader: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  defaultBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  defaultText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  modelName: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  modelDesc: { fontSize: 13, lineHeight: 20, marginTop: 4 },
  specRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  specChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  specText: { fontSize: 11, fontWeight: '600' },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 14 },
  downloadBtnText: { fontSize: 14, fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  progressText: { fontSize: 13, fontWeight: '600' },
  speedText: { fontSize: 12, marginLeft: 'auto' },
  progressBar: { height: 6, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  downloadedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, marginTop: 14 },
  downloadedText: { fontSize: 14, fontWeight: '600' },
  hfLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },
  hfLinkText: { fontSize: 12 },
});
