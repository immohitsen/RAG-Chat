import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Chat API
export const sendQuery = async (query, topK = 3, selectedFiles = null, sessionId = null) => {
  const response = await api.post('/chat', {
    query,
    top_k: topK,
    selected_files: selectedFiles,
    session_id: sessionId
  });
  console.log(response);
  return response.data;
};

// Upload API - S3 presigned URL flow
export const uploadDocument = async (file, onProgress) => {
  // Step 1: Get presigned POST data
  const { data: { upload_url, fields, s3_key } } = await api.post('/upload/presigned-url', {
    filename: file.name,
    content_type: file.type || 'application/octet-stream',
  });

  // Step 2: Upload directly to S3 using multipart form POST
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
  formData.append('file', file);

  await axios.post(upload_url, formData, {
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round(
        (progressEvent.loaded * 100) / progressEvent.total
      );
      if (onProgress) onProgress(percentCompleted);
    },
  });

  // Step 3: Tell backend to process the file
  const response = await api.post('/upload/process', {
    s3_key,
    filename: file.name,
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

// --- History API ---
export const getSessions = async () => {
  const response = await api.get('/history/sessions');
  return response.data;
};

export const createSession = async (title) => {
  const response = await api.post('/history/sessions', { title });
  return response.data;
};

export const getSessionMessages = async (sessionId) => {
  const response = await api.get(`/history/sessions/${sessionId}`);
  return response.data;
};

export const deleteSession = async (sessionId) => {
  const response = await api.delete(`/history/sessions/${sessionId}`);
  return response.data;
};

export default api;
