import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth API
export const loginUser = async (username, password) => {
  const response = await api.post('/auth/login', { username, password });
  return response.data;
};

export const registerUser = async (username, password) => {
  const response = await api.post('/auth/register', { username, password });
  return response.data;
};

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

// Upload API - auto switches between local and S3 based on backend response
export const uploadDocument = async (file, onProgress) => {
  // Step 1: Ask backend which upload mode to use
  const { data: { upload_url, s3_key, use_local } } = await api.post('/upload/presigned-url', {
    filename: file.name,
    content_type: file.type || 'application/octet-stream',
  });

  let finalS3Key;

  if (use_local) {
    // Local mode: upload directly to backend
    const formData = new FormData();
    formData.append('file', file);
    const { data: localData } = await api.post(`${API_URL}/upload/local`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        if (onProgress) onProgress(percentCompleted);
      },
    });
    finalS3Key = localData.s3_key;
  } else {
    // AWS mode: upload directly to S3 via presigned PUT URL
    await axios.put(upload_url, file, {
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        if (onProgress) onProgress(percentCompleted);
      },
    });
    finalS3Key = s3_key;
  }

  // Step 3: Tell backend to process the file
  const response = await api.post('/upload/process', {
    s3_key: finalS3Key,
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

// Download file
export const downloadFile = async (filename) => {
  const response = await api.get(`/files/${encodeURIComponent(filename)}/download`);
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
