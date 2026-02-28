import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, RefreshControl, ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/ThemeContext';
import { getFiles, getFile, createFile, updateFile, deleteFile } from '../src/api';

type FileDoc = {
  id: string;
  filename: string;
  directory: string;
  path: string;
  content: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
};

function FileIcon({ filename, colors }: { filename: string; colors: any }) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, { icon: string; color: string }> = {
    txt: { icon: 'file-document-outline', color: colors.primary },
    md: { icon: 'language-markdown-outline', color: colors.secondary },
    json: { icon: 'code-json', color: colors.accent },
    js: { icon: 'language-javascript', color: '#F7DF1E' },
    ts: { icon: 'language-typescript', color: '#3178C6' },
    py: { icon: 'language-python', color: '#3776AB' },
    html: { icon: 'language-html5', color: '#E34F26' },
    css: { icon: 'language-css3', color: '#1572B6' },
    csv: { icon: 'file-table-outline', color: colors.success },
    xml: { icon: 'file-xml-box', color: colors.accent },
    sh: { icon: 'console', color: colors.textSecondary },
    log: { icon: 'file-clock-outline', color: colors.textSecondary },
  };
  const cfg = iconMap[ext] || { icon: 'file-outline', color: colors.textSecondary };
  return <MaterialCommunityIcons name={cfg.icon as any} size={24} color={cfg.color} />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [files, setFiles] = useState<FileDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<FileDoc | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newFilename, setNewFilename] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newDirectory, setNewDirectory] = useState('');
  const [creating, setCreating] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const f = await getFiles();
      setFiles(f);
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleOpenFile = useCallback(async (fileDoc: FileDoc) => {
    try {
      const full = await getFile(fileDoc.id);
      setSelectedFile(full);
      setEditContent(full.content);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }, []);

  const handleSaveFile = useCallback(async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await updateFile(selectedFile.id, editContent);
      Alert.alert('Saved', `File "${selectedFile.filename}" updated.`);
      setSelectedFile(null);
      loadFiles();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setSaving(false);
  }, [selectedFile, editContent, loadFiles]);

  const handleDeleteFile = useCallback((fileDoc: FileDoc) => {
    Alert.alert('Delete File', `Delete "${fileDoc.path}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteFile(fileDoc.id);
            loadFiles();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  }, [loadFiles]);

  const handleCreateFile = useCallback(async () => {
    if (!newFilename.trim()) { Alert.alert('Error', 'Filename is required'); return; }
    setCreating(true);
    try {
      await createFile(newFilename.trim(), newContent, newDirectory.trim());
      setShowCreate(false);
      setNewFilename('');
      setNewContent('');
      setNewDirectory('');
      loadFiles();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setCreating(false);
  }, [newFilename, newContent, newDirectory, loadFiles]);

  // File editor view
  if (selectedFile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity testID="file-editor-back" onPress={() => setSelectedFile(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text testID="file-editor-title" style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{selectedFile.filename}</Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{selectedFile.path}</Text>
          </View>
          <TouchableOpacity testID="file-editor-save" onPress={handleSaveFile} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <MaterialCommunityIcons name="content-save-outline" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.fileMeta, { backgroundColor: colors.surfaceHighlight }]}>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {formatSize(selectedFile.size_bytes)} · Updated {new Date(selectedFile.updated_at).toLocaleString()}
          </Text>
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.flex}>
            <TextInput
              testID="file-editor-content"
              style={[styles.editor, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.border }]}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              textAlignVertical="top"
              placeholder="File content..."
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity testID="files-back" onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text testID="files-header-title" style={[styles.headerTitle, { color: colors.textPrimary }]}>File Manager</Text>
        <TouchableOpacity testID="files-create-btn" onPress={() => setShowCreate(true)}>
          <MaterialCommunityIcons name="plus-circle-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.infoBar, { backgroundColor: colors.surfaceHighlight }]}>
        <MaterialCommunityIcons name="folder-outline" size={16} color={colors.textSecondary} />
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          {files.length} file{files.length !== 1 ? 's' : ''} in local storage · Managed by agent via chat
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadFiles} tintColor={colors.primary} />}
      >
        {files.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="file-plus-outline" size={56} color={colors.textSecondary + '40'} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No files yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Ask your agent to create files, or tap + to create one manually.{'\n\n'}
              Try saying: "Create a file called shopping-list.txt with milk, eggs, and bread"
            </Text>
          </View>
        )}

        {files.map((file) => (
          <TouchableOpacity
            key={file.id}
            testID={`file-item-${file.filename}`}
            style={[styles.fileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleOpenFile(file)}
            activeOpacity={0.7}
          >
            <FileIcon filename={file.filename} colors={colors} />
            <View style={styles.fileInfo}>
              <Text style={[styles.fileName, { color: colors.textPrimary }]} numberOfLines={1}>{file.filename}</Text>
              <Text style={[styles.filePath, { color: colors.textSecondary }]} numberOfLines={1}>
                {file.directory ? `${file.directory}/` : '/'} · {formatSize(file.size_bytes)}
              </Text>
              <Text style={[styles.fileTime, { color: colors.textSecondary }]}>
                {new Date(file.updated_at).toLocaleString()}
              </Text>
            </View>
            <View style={styles.fileActions}>
              <TouchableOpacity
                testID={`file-delete-${file.filename}`}
                onPress={() => handleDeleteFile(file)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Create File Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalWrapper}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Create File</Text>
                <TouchableOpacity testID="create-file-close" onPress={() => setShowCreate(false)}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>FILENAME *</Text>
                <TextInput
                  testID="create-file-name"
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
                  value={newFilename}
                  onChangeText={setNewFilename}
                  placeholder="e.g., notes.txt, todo.md"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>DIRECTORY (optional)</Text>
                <TextInput
                  testID="create-file-dir"
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
                  value={newDirectory}
                  onChangeText={setNewDirectory}
                  placeholder="e.g., documents, projects/myapp"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>CONTENT</Text>
                <TextInput
                  testID="create-file-content"
                  style={[styles.formTextarea, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
                  value={newContent}
                  onChangeText={setNewContent}
                  placeholder="File content..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  textAlignVertical="top"
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                testID="create-file-submit"
                style={[styles.createBtn, { backgroundColor: colors.primary }]}
                onPress={handleCreateFile}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="file-plus-outline" size={18} color={colors.primaryForeground} />
                    <Text style={[styles.createBtnText, { color: colors.primaryForeground }]}>Create File</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerCenter: { flex: 1, marginHorizontal: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 11, marginTop: 1 },
  infoBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
  infoText: { flex: 1, fontSize: 12 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 15, fontWeight: '600' },
  filePath: { fontSize: 12, marginTop: 2 },
  fileTime: { fontSize: 11, marginTop: 2 },
  fileActions: { gap: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  fileMeta: { paddingHorizontal: 16, paddingVertical: 6 },
  metaText: { fontSize: 12 },
  editor: {
    flex: 1, margin: 12, padding: 14, borderRadius: 10, borderWidth: 1,
    fontSize: 14, lineHeight: 22, minHeight: 400,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalWrapper: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  formInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  formTextarea: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 120, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 4 },
  createBtnText: { fontSize: 15, fontWeight: '700' },
});
