import React, { useState, useCallback, useEffect } from 'react';
import { uploadDocument, fetchLogs } from '../services/api';
import { UploadCloud, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';

const FileUpload = ({ onUploadSuccess, onClose, onLog, onBackendLogs }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState(null);

  useEffect(() => {
    let interval;
    // Poll backend logs while uploading
    if (uploading && onBackendLogs) {
      interval = setInterval(async () => {
        try {
          const res = await fetchLogs();
          if (res && res.logs) {
            onBackendLogs(res.logs);
          }
        } catch (e) {
          console.error("Log fetch error:", e);
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [uploading, onBackendLogs]);

  const processFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setUploading(true);
    setError(null);
    setProgress(0);
    setSuccess(null);

    if (onLog) onLog(`Initializing upload for ${file.name}...`);

    try {
      const result = await uploadDocument(file, (pct) => {
        setProgress(pct);
        if (pct === 100 && onLog) {
           onLog(`Upload complete. Extracting text and chunking...`, 'text-purple-400');
           onLog(`Generating semantic embeddings for FAISS index...`, 'opacity-70');
        }
      });
      if (result.success) {
        setSuccess(result);
        if (onLog) {
           onLog(`✅ Successfully indexed ${result.filename}`, 'text-emerald-400');
           onLog(`📊 Added ${result.chunks_added} chunks to knowledge base`, 'text-emerald-400');
        }
        setTimeout(() => onUploadSuccess(result), 1200);
      }
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Upload failed. Please try again.';
      setError(errMsg);
      if (onLog) onLog(`❌ Error: ${errMsg}`, 'text-red-400');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => processFile(e.target.files[0]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  return (
    <div className="glass-strong rounded-2xl p-6 w-[480px] relative" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl btn-gradient flex items-center justify-center">
            <UploadCloud size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Upload Document</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>PDF, TXT, CSV, Excel, Word, JSON</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg glass flex items-center justify-center hover:border-red-500/30 transition-all"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Drop Zone */}
      {!uploading && !success && (
        <label
          className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
            dragOver ? 'drag-over' : ''
          }`}
          style={{ borderColor: dragOver ? 'var(--accent-purple)' : 'var(--border-subtle)', background: dragOver ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.02)' }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${dragOver ? 'btn-gradient' : 'glass'}`}>
            <UploadCloud size={22} className={dragOver ? 'text-white' : 'text-purple-400'} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              {dragOver ? 'Drop to upload' : 'Drag & drop or click to browse'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Max file size: 50MB</p>
          </div>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.txt,.csv,.xlsx,.docx,.json"
            onChange={handleFileChange}
          />
        </label>
      )}

      {/* Uploading state */}
      {uploading && (
        <div className="py-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg glass flex items-center justify-center">
              <FileText size={16} className="text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{fileName}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Indexing chunks...</p>
            </div>
            <span className="text-sm font-semibold gradient-text">{progress}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div
              className="h-1.5 rounded-full btn-gradient transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Success state */}
      {success && (
        <div className="flex flex-col items-center py-6 gap-3 animate-scale-in">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
            <CheckCircle size={28} className="text-emerald-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-emerald-400">Upload Successful!</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {success.chunks_added} chunks added to knowledge base
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 flex items-start gap-2 p-3 rounded-xl animate-fade-in"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
