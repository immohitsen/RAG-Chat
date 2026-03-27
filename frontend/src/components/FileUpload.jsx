import React, { useState, useCallback } from 'react';
import { uploadDocument } from '../services/api';
import { UploadSimple, X, FileText, CheckCircle } from '@phosphor-icons/react';

const FileUpload = ({ onUploadSuccess, onClose, onProgress }) => {
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState(''); // 'uploading', 'chunking', 'embedding', 'done'
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState(null);



  const processFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setUploading(true);
    setStage('uploading');
    setError(null);
    setProgress(0);
    setSuccess(null);

    if (onProgress) onProgress({ stage: 'uploading', percent: 0, filename: file.name });

    let stageTimer;
    let hasReached100 = false;

    try {
      const result = await uploadDocument(file, (pct) => {
        setProgress(pct);
        if (pct < 100) {
          if (!hasReached100) setStage('uploading');
          if (onProgress) onProgress({ stage: 'uploading', percent: Math.round(pct * 0.4), filename: file.name });
        } else if (pct >= 100 && !hasReached100) {
          hasReached100 = true;
          setStage('chunking');
          stageTimer = setTimeout(() => setStage('embedding'), 2000);
          if (onProgress) onProgress({ stage: 'indexing', percent: 60, filename: file.name });
        }
      });
      clearTimeout(stageTimer);
      setStage('done');
      if (result.success) {
        setSuccess(result);
        if (onProgress) onProgress({ stage: 'done', percent: 100, filename: result.filename, chunks: result.chunks_added });
        setTimeout(() => {
          onUploadSuccess(result);
          onClose();
        }, 1500);
      }
    } catch (err) {
      clearTimeout(stageTimer);
      console.error("Upload Error details:", err);
      const errMsg = err.response?.data?.detail || err.message || 'Upload failed. Please check network/CORS.';
      setError(errMsg);
      setStage('error');
      if (onProgress) onProgress({ stage: 'error', percent: 0, error: errMsg });
    }
    // We intentionally don't setUploading(false) on error so the modal doesn't flash back to the dropzone
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
    <div className="glass-strong rounded-2xl p-6 w-[480px] relative drop-shadow-sm" style={{ border: '1px solid rgba(255,255,255,0.12) border-radius: 16px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl btn-gradient flex items-center justify-center">
            <UploadSimple size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-regular text-lg" style={{ color: 'var(--text-primary)' }}>Upload Document</h3>
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
          style={{ borderColor: dragOver ? 'var(--accent-purple)' : 'var(--border-subtle)', background: dragOver ? 'rgba(139,92,246,0.08)' : 'var(--bg-surface)' }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${dragOver ? 'btn-gradient' : 'glass'}`}>
            <UploadSimple size={22} className={dragOver ? 'text-white' : 'text-purple-400'} />
          </div>
          <div className="text-center">
            <p className="text-md font-regular" style={{ color: 'var(--text-secondary)' }}>
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
      {uploading && !success && (
        <div className="py-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg glass flex items-center justify-center transition-all duration-300">
              {stage === 'embedding' || stage === 'chunking' ? (
                <div className="w-4 h-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              ) : (
                <FileText size={16} className="text-purple-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: stage === 'error' ? '#ef4444' : 'var(--text-primary)' }}>{fileName}</p>
              <p className="text-xs transition-opacity duration-300" style={{ color: stage === 'error' ? '#fca5a5' : 'var(--text-muted)' }}>
                {stage === 'uploading' && 'Uploading document to server...'}
                {stage === 'chunking' && 'Extracting & chunking text...'}
                {stage === 'embedding' && 'Generating vector embeddings...'}
                {stage === 'done' && 'Finalizing context...'}
                {stage === 'error' && `Error: ${error}`}
              </p>
            </div>
            {stage === 'uploading' && <span className="text-sm font-semibold gradient-text w-10 text-right">{progress}%</span>}
            {stage === 'error' && (
               <button onClick={() => { setUploading(false); setStage(''); }} className="text-xs text-red-500 hover:underline">Retry</button>
            )}
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }}>
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${stage === 'error' ? 'bg-red-500' : stage !== 'uploading' ? 'btn-gradient animate-pulse' : 'btn-gradient'}`}
              style={{ width: stage === 'uploading' ? `${progress}%` : '100%' }}
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

      {/* Error is now handled inline above, so we don't need this standalone popup in the DropZone anymore unless dropzone fails */}
    </div>
  );
};

export default FileUpload;
