import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, RefreshControl, ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/ThemeContext';
import {
  getFile, createFile, updateFile, deleteFile, renameFile,
  searchFiles, getDirectoryTree,
} from '../src/api';

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

type DirNode = {
  path: string;
  name: string;
  depth: number;
  file_count: number;
  total_size: number;
  files: FileDoc[];
};

type ViewMode = 'tree' | 'flat';

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
  return <MaterialCommunityIcons name={cfg.icon as any} size={22} color={cfg.color} />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── File Card (reused in tree & flat view) ───
function FileCard({ file, colors, onOpen, onDelete, onRename }: {
  file: FileDoc; colors: any;
  onOpen: () => void; onDelete: () => void; onRename: () => void;
}) {
  return (
    <TouchableOpacity
      testID={`file-item-${file.filename}`}
      style={[s.fileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onOpen}
      activeOpacity={0.7}
    >
      <FileIcon filename={file.filename} colors={colors} />
      <View style={s.fileInfo}>
        <Text style={[s.fileName, { color: colors.textPrimary }]} numberOfLines={1}>{file.filename}</Text>
        <Text style={[s.fileMeta, { color: colors.textSecondary }]} numberOfLines={1}>
          {formatSize(file.size_bytes)} · {new Date(file.updated_at).toLocaleDateString()}
        </Text>
      </View>
      <TouchableOpacity
        testID={`file-rename-${file.filename}`}
        onPress={onRename}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={s.actionBtn}
      >
        <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity
        testID={`file-delete-${file.filename}`}
        onPress={onDelete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={s.actionBtn}
      >
        <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.destructive} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Directory Folder Header ───
function DirHeader({ dir, expanded, onToggle, colors }: {
  dir: DirNode; expanded: boolean; onToggle: () => void; colors: any;
}) {
  return (
    <TouchableOpacity
      testID={`dir-${dir.path}`}
      style={[s.dirHeader, { marginLeft: dir.depth * 16, borderColor: colors.border }]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons
        name={expanded ? 'folder-open-outline' : 'folder-outline'}
        size={20}
        color={colors.accent}
      />
      <Text style={[s.dirName, { color: colors.textPrimary }]}>{dir.name}</Text>
      <Text style={[s.dirStats, { color: colors.textSecondary }]}>
        {dir.file_count} file{dir.file_count !== 1 ? 's' : ''} · {formatSize(dir.total_size)}
      </Text>
      <MaterialCommunityIcons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={18}
        color={colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

export default function FilesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tree, setTree] = useState<DirNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileDoc[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Editor
  const [selectedFile, setSelectedFile] = useState<FileDoc | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Rename
  const [renameTarget, setRenameTarget] = useState<FileDoc | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [newFilename, setNewFilename] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newDirectory, setNewDirectory] = useState('');
  const [creating, setCreating] = useState(false);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const t = await getDirectoryTree();
      setTree(t);
      // Auto-expand all dirs on first load
      if (expandedDirs.size === 0) {
        setExpandedDirs(new Set(t.map((d: DirNode) => d.path)));
      }
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

  // Flat list of all files
  const allFiles = useMemo(() => {
    const files: FileDoc[] = [];
    tree.forEach((dir) => dir.files.forEach((f) => files.push({ ...f, directory: dir.path === '/' ? '' : dir.path })));
    return files.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [tree]);

  const totalFileCount = allFiles.length;
  const totalSize = allFiles.reduce((sum, f) => sum + (f.size_bytes || 0), 0);

  // Search handler
  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const results = await searchFiles(q.trim());
      setSearchResults(results);
    } catch (e) {
      setSearchResults([]);
    }
    setSearching(false);
  }, []);

  // File operations
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
      loadTree();
    } catch (e: any) { Alert.alert('Error', e.message); }
    setSaving(false);
  }, [selectedFile, editContent, loadTree]);

  const handleDeleteFile = useCallback((fileDoc: FileDoc) => {
    Alert.alert('Delete File', `Delete "${fileDoc.path || fileDoc.filename}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteFile(fileDoc.id); loadTree(); } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  }, [loadTree]);

  const handleRenameStart = useCallback((file: FileDoc) => {
    setRenameTarget(file);
    setRenameValue(file.filename);
  }, []);

  const handleRenameConfirm = useCallback(async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await renameFile(renameTarget.id, renameValue.trim());
      setRenameTarget(null);
      setRenameValue('');
      loadTree();
    } catch (e: any) { Alert.alert('Error', e.message); }
  }, [renameTarget, renameValue, loadTree]);

  const handleCreateFile = useCallback(async () => {
    if (!newFilename.trim()) { Alert.alert('Error', 'Filename is required'); return; }
    setCreating(true);
    try {
      await createFile(newFilename.trim(), newContent, newDirectory.trim());
      setShowCreate(false);
      setNewFilename('');
      setNewContent('');
      setNewDirectory('');
      loadTree();
    } catch (e: any) { Alert.alert('Error', e.message); }
    setCreating(false);
  }, [newFilename, newContent, newDirectory, loadTree]);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // ─── File Editor View ───
  if (selectedFile) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[s.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity testID="file-editor-back" onPress={() => setSelectedFile(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text testID="file-editor-title" style={[s.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{selectedFile.filename}</Text>
            <Text style={[s.headerSub, { color: colors.textSecondary }]}>{selectedFile.path}</Text>
          </View>
          <TouchableOpacity testID="file-editor-save" onPress={handleSaveFile} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialCommunityIcons name="content-save-outline" size={24} color={colors.primary} />}
          </TouchableOpacity>
        </View>
        <View style={[s.editorMeta, { backgroundColor: colors.surfaceHighlight }]}>
          <Text style={[s.metaText, { color: colors.textSecondary }]}>
            {formatSize(selectedFile.size_bytes)} · Updated {new Date(selectedFile.updated_at).toLocaleString()}
          </Text>
        </View>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={s.flex}>
            <TextInput
              testID="file-editor-content"
              style={[s.editor, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.border }]}
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

  // ─── File list to render (search results or all) ───
  const displayingSearch = searchResults !== null;
  const filesToRender = displayingSearch ? searchResults : allFiles;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity testID="files-back" onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text testID="files-header-title" style={[s.headerTitle, { color: colors.textPrimary }]}>File Manager</Text>
        <TouchableOpacity testID="files-create-btn" onPress={() => setShowCreate(true)}>
          <MaterialCommunityIcons name="plus-circle-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[s.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[s.searchInputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={18} color={colors.textSecondary} />
          <TextInput
            testID="file-search-input"
            style={[s.searchInput, { color: colors.textPrimary }]}
            placeholder="Search files by name or content..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity testID="file-search-clear" onPress={() => { setSearchQuery(''); setSearchResults(null); }}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          {searching && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
      </View>

      {/* View Toggle + Stats */}
      <View style={[s.toolbar, { backgroundColor: colors.surfaceHighlight }]}>
        <MaterialCommunityIcons name="folder-outline" size={14} color={colors.textSecondary} />
        <Text style={[s.toolbarText, { color: colors.textSecondary }]}>
          {displayingSearch ? `${filesToRender?.length || 0} results` : `${totalFileCount} files · ${formatSize(totalSize)}`}
        </Text>
        {!displayingSearch && (
          <View style={s.viewToggle}>
            <TouchableOpacity
              testID="view-tree-btn"
              style={[s.viewBtn, viewMode === 'tree' && { backgroundColor: colors.primary + '20' }]}
              onPress={() => setViewMode('tree')}
            >
              <MaterialCommunityIcons name="file-tree-outline" size={16} color={viewMode === 'tree' ? colors.primary : colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="view-flat-btn"
              style={[s.viewBtn, viewMode === 'flat' && { backgroundColor: colors.primary + '20' }]}
              onPress={() => setViewMode('flat')}
            >
              <MaterialCommunityIcons name="format-list-bulleted" size={16} color={viewMode === 'flat' ? colors.primary : colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadTree} tintColor={colors.primary} />}
      >
        {/* Empty State */}
        {totalFileCount === 0 && !loading && !displayingSearch && (
          <View style={s.emptyState}>
            <MaterialCommunityIcons name="file-plus-outline" size={56} color={colors.textSecondary + '40'} />
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No files yet</Text>
            <Text style={[s.emptySubtitle, { color: colors.textSecondary }]}>
              Ask your agent to create files, or tap + to create one manually.{'\n\n'}
              Try: {'"'}Create a file called shopping-list.txt with milk, eggs, and bread{'"'}
            </Text>
          </View>
        )}

        {/* Search Results (always flat) */}
        {displayingSearch && (
          <>
            {(filesToRender?.length || 0) === 0 && !searching && (
              <View style={s.emptyState}>
                <MaterialCommunityIcons name="file-search-outline" size={48} color={colors.textSecondary + '40'} />
                <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No results</Text>
                <Text style={[s.emptySubtitle, { color: colors.textSecondary }]}>
                  No files matching {'"'}{searchQuery}{'"'}
                </Text>
              </View>
            )}
            {filesToRender?.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                colors={colors}
                onOpen={() => handleOpenFile(file)}
                onDelete={() => handleDeleteFile(file)}
                onRename={() => handleRenameStart(file)}
              />
            ))}
          </>
        )}

        {/* Tree View */}
        {!displayingSearch && viewMode === 'tree' && tree.map((dir) => (
          <View key={dir.path} style={{ marginBottom: 4 }}>
            <DirHeader
              dir={dir}
              expanded={expandedDirs.has(dir.path)}
              onToggle={() => toggleDir(dir.path)}
              colors={colors}
            />
            {expandedDirs.has(dir.path) && dir.files.map((file) => (
              <View key={file.id} style={{ marginLeft: (dir.depth + 1) * 16 }}>
                <FileCard
                  file={file}
                  colors={colors}
                  onOpen={() => handleOpenFile(file)}
                  onDelete={() => handleDeleteFile(file)}
                  onRename={() => handleRenameStart(file)}
                />
              </View>
            ))}
          </View>
        ))}

        {/* Flat View */}
        {!displayingSearch && viewMode === 'flat' && allFiles.map((file) => (
          <FileCard
            key={file.id}
            file={file}
            colors={colors}
            onOpen={() => handleOpenFile(file)}
            onDelete={() => handleDeleteFile(file)}
            onRename={() => handleRenameStart(file)}
          />
        ))}
      </ScrollView>

      {/* Rename Modal */}
      <Modal visible={!!renameTarget} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.renameModal, { backgroundColor: colors.surface }]}>
            <Text style={[s.renameTitle, { color: colors.textPrimary }]}>Rename File</Text>
            <Text style={[s.renameSub, { color: colors.textSecondary }]}>{renameTarget?.path}</Text>
            <TextInput
              testID="rename-input"
              style={[s.renameInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="New filename..."
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoFocus
              selectTextOnFocus
            />
            <View style={s.renameActions}>
              <TouchableOpacity
                testID="rename-cancel"
                style={[s.renameBtn, { borderColor: colors.border }]}
                onPress={() => setRenameTarget(null)}
              >
                <Text style={[s.renameBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="rename-confirm"
                style={[s.renameBtn, { backgroundColor: colors.primary }]}
                onPress={handleRenameConfirm}
              >
                <Text style={[s.renameBtnText, { color: colors.primaryForeground }]}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create File Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={s.modalWrapper}
          >
            <View style={[s.createModal, { backgroundColor: colors.surface }]}>
              <View style={s.createHeader}>
                <Text style={[s.createTitle, { color: colors.textPrimary }]}>Create File</Text>
                <TouchableOpacity testID="create-file-close" onPress={() => setShowCreate(false)}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={s.formGroup}>
                  <Text style={[s.label, { color: colors.textSecondary }]}>FILENAME *</Text>
                  <TextInput
                    testID="create-file-name"
                    style={[s.formInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
                    value={newFilename}
                    onChangeText={setNewFilename}
                    placeholder="e.g., notes.txt, todo.md"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                  />
                </View>
                <View style={s.formGroup}>
                  <Text style={[s.label, { color: colors.textSecondary }]}>DIRECTORY (optional)</Text>
                  <TextInput
                    testID="create-file-dir"
                    style={[s.formInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
                    value={newDirectory}
                    onChangeText={setNewDirectory}
                    placeholder="e.g., documents, projects/myapp"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                  />
                </View>
                <View style={s.formGroup}>
                  <Text style={[s.label, { color: colors.textSecondary }]}>CONTENT</Text>
                  <TextInput
                    testID="create-file-content"
                    style={[s.formTextarea, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
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
                  style={[s.createBtn, { backgroundColor: colors.primary }]}
                  onPress={handleCreateFile}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="file-plus-outline" size={18} color={colors.primaryForeground} />
                      <Text style={[s.createBtnText, { color: colors.primaryForeground }]}>Create File</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerCenter: { flex: 1, marginHorizontal: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 11, marginTop: 1 },

  // Search
  searchBar: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, gap: 6 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14 },

  // Toolbar
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 6 },
  toolbarText: { flex: 1, fontSize: 12 },
  viewToggle: { flexDirection: 'row', gap: 2 },
  viewBtn: { padding: 6, borderRadius: 6 },

  // Dir Header
  dirHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4 },
  dirName: { flex: 1, fontSize: 14, fontWeight: '700' },
  dirStats: { fontSize: 11 },

  // File Card
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: '600' },
  fileMeta: { fontSize: 11, marginTop: 2 },
  actionBtn: { padding: 4 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 14 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  // Editor
  editorMeta: { paddingHorizontal: 16, paddingVertical: 6 },
  metaText: { fontSize: 12 },
  editor: {
    flex: 1, margin: 12, padding: 14, borderRadius: 10, borderWidth: 1,
    fontSize: 14, lineHeight: 22, minHeight: 400,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Scroll
  scrollContent: { padding: 12, paddingBottom: 100 },

  // Rename Modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  renameModal: { width: '85%', borderRadius: 16, padding: 20 },
  renameTitle: { fontSize: 18, fontWeight: '700' },
  renameSub: { fontSize: 12, marginTop: 4, marginBottom: 14 },
  renameInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  renameActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  renameBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  renameBtnText: { fontSize: 15, fontWeight: '600' },

  // Create Modal
  modalWrapper: { flex: 1, justifyContent: 'flex-end' },
  createModal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  createHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  createTitle: { fontSize: 20, fontWeight: '700' },
  formGroup: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  formInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  formTextarea: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 100, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 4 },
  createBtnText: { fontSize: 15, fontWeight: '700' },
});
