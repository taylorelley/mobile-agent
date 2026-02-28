const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const API_URL = `${BASE_URL}/api`;

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Chat
export const sendChat = (message: string, session_id: string) =>
  request('/chat/send', { method: 'POST', body: JSON.stringify({ message, session_id }) });

// SOUL
export const getSoul = () => request('/soul');
export const updateSoul = (content: string) =>
  request('/soul', { method: 'PUT', body: JSON.stringify({ content }) });

// Memory
export const getFacts = () => request('/memory/facts');
export const createFact = (category: string, key: string, value: string) =>
  request('/memory/facts', { method: 'POST', body: JSON.stringify({ category, key, value }) });
export const deleteFact = (factKey: string) =>
  request(`/memory/facts/${encodeURIComponent(factKey)}`, { method: 'DELETE' });
export const forgetTopic = (topic: string) =>
  request('/memory/forget', { method: 'POST', body: JSON.stringify({ topic }) });

// Conversations
export const getConversations = (sessionId?: string, limit = 50) => {
  const params = new URLSearchParams();
  if (sessionId) params.set('session_id', sessionId);
  params.set('limit', String(limit));
  return request(`/conversations?${params.toString()}`);
};
export const deleteConversations = () => request('/conversations', { method: 'DELETE' });

// Tools
export const getTools = () => request('/tools');
export const addCustomTool = (tool: any) =>
  request('/tools/custom', { method: 'POST', body: JSON.stringify(tool) });
export const deleteCustomTool = (name: string) =>
  request(`/tools/custom/${encodeURIComponent(name)}`, { method: 'DELETE' });

// Keywords
export const getKeywords = () => request('/keywords');
export const updateKeywords = (keywords: string[]) =>
  request('/keywords', { method: 'PUT', body: JSON.stringify({ keywords }) });

// Models
export const getModels = () => request('/models');
export const downloadModel = (modelId: string) =>
  request('/models/download', { method: 'POST', body: JSON.stringify({ model_id: modelId }) });
export const getModelStatus = (modelId: string) => request(`/models/${modelId}/status`);

// Files
export const getFiles = (directory?: string, pattern?: string) => {
  const params = new URLSearchParams();
  if (directory) params.set('directory', directory);
  if (pattern) params.set('pattern', pattern);
  const qs = params.toString();
  return request(`/files${qs ? `?${qs}` : ''}`);
};
export const getFile = (fileId: string) => request(`/files/${encodeURIComponent(fileId)}`);
export const createFile = (filename: string, content: string, directory?: string) =>
  request('/files', { method: 'POST', body: JSON.stringify({ filename, content, directory: directory || '' }) });
export const updateFile = (fileId: string, content: string, mode?: string, find_text?: string, replace_text?: string) =>
  request(`/files/${encodeURIComponent(fileId)}`, {
    method: 'PUT',
    body: JSON.stringify({ content, mode: mode || 'overwrite', find_text, replace_text }),
  });
export const deleteFile = (fileId: string) =>
  request(`/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });

// Settings
export const getSettings = () => request('/settings');
export const updateSettings = (settings: any) =>
  request('/settings', { method: 'PUT', body: JSON.stringify(settings) });

// Data
export const deleteAllData = () => request('/data', { method: 'DELETE' });

// Health
export const healthCheck = () => request('/health');
