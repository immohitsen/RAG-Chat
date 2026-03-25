import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Chat API
export const sendQuery = async (query, topK = 3, selectedFiles = null) => {
  const response = await api.post('/chat', {
    query,
    top_k: topK,
    selected_files: selectedFiles,
  });
  return response.data;
};

// Upload API
export const uploadDocument = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round(
        (progressEvent.loaded * 100) / progressEvent.total
      );
      if (onProgress) onProgress(percentCompleted);
    },
  });

  return response.data;
};

// List documents
export const listDocuments = async () => {
  const response = await api.get('/documents');
  return response.data;
};

// Health check
export const checkHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

// Get indexed files
export const listIndexedFiles = async () => {
  const response = await api.get('/files');
  return response.data;
};

// Delete file
export const deleteFile = async (filename) => {
  const response = await api.delete(`/files/${encodeURIComponent(filename)}`);
  return response.data;
};

// Fetch terminal logs
export const fetchLogs = async () => {
  const response = await api.get('/logs');
  return response.data;
};

export default api;
