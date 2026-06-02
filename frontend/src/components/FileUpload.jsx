'use client';

import React, { useState, useCallback } from 'react';
import { uploadDocument, listIndexedFiles, deleteFile, downloadFile } from '../services/api';
import { UploadSimple, X, CheckCircle, FileText, CheckSquare, Square, Trash, DownloadSimple, Hash } from '@phosphor-icons/react';

const FileUpload = ({ onUploadSuccess, onClose, onProgress, onBusyStateChange, selectedFiles = [], onSelectionChange }) => {
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState(''); // 'uploading', 'chunking', 'embedding', 'done'
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState(null);

  // Notify parent if we are in a state that shouldn't be interrupted
  const isBusy = uploading && !success && stage !== 'error';
  
  React.useEffect(() => {
    if (onBusyStateChange) {
      onBusyStateChange(isBusy);
    }
  }, [isBusy, onBusyStateChange]);

  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);

  const fetchFiles = async () => {
    try {
      const response = await listIndexedFiles();
      setFiles(response.files || []);
    } catch (err) {
      console.error('Failed to fetch files in FileUpload:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  React.useEffect(() => {
    fetchFiles();
  }, []);

  const processFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setUploading(true);
    setStage('uploading');
    setError(null);
    setProgress(10);
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
        await fetchFiles(); // Refresh files list
        if (onSelectionChange && result.filename) {
          onSelectionChange(prev => {
            const next = Array.isArray(prev) ? prev : [];
            if (!next.includes(result.filename)) {
              return [...next, result.filename];
            }
            return next;
          });
        }
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
    <div className="glass-strong rounded-2xl p-6 w-[92vw] md:w-[760px] md:max-w-3xl relative transition-all duration-300" style={{ border: '2px solid var(--border-subtle)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl btn-gradient flex items-center justify-center">
            <UploadSimple size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-regular text-lg" style={{ color: 'var(--text-primary)' }}>Manage Documents</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Upload new files or select context documents</p>
          </div>
        </div>
        
        {/* Only show close button if not busy OR if there was an error */}
        {(!isBusy || stage === 'error') && (
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg glass flex items-center justify-center hover:border-red-500/30 transition-all animate-fade-in"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Main Body Layout */}
      <div className="flex flex-col md:flex-row gap-6 mt-2">
        {/* Left Side: Upload zone and uploading status */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {/* Drop Zone */}
          {!uploading && !success && (
            <label
              className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 min-h-[220px] ${
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
                <p className="text-sm font-regular" style={{ color: 'var(--text-secondary)' }}>
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
            <div className="py-6 animate-fade-in flex flex-col justify-center min-h-[220px]">
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
                {stage === 'chunking' && <span className="text-sm font-semibold gradient-text w-10 text-right">75%</span>}
                {stage === 'embedding' && <span className="text-sm font-semibold gradient-text w-10 text-right">90%</span>}
                {stage === 'done' && <span className="text-sm font-semibold gradient-text w-10 text-right">100%</span>}
                {stage === 'error' && (
                  <button type="button" onClick={() => { setUploading(false); setStage(''); }} className="text-xs text-red-500 hover:underline">Retry</button>
                )}
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--progress-bg)' }}>
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    stage === 'error' ? 'bg-red-500' : 
                    'btn-gradient'
                  }`}
                  style={{ 
                    width: 
                      stage === 'uploading' ? `${Math.round(progress * 0.6)}%` : 
                      stage === 'chunking' ? '75%' :
                      stage === 'embedding' ? '90%' :
                      stage === 'done' ? '100%' : '0%'
                  }}
                />
              </div>
            </div>
          )}

          {/* Success state */}
          {success && (
            <div className="flex flex-col items-center justify-center py-6 gap-3 animate-scale-in min-h-[220px]">
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
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px self-stretch" style={{ background: 'var(--border-subtle)' }} />

        {/* Right Side: Select Files List */}
        <div className="flex-1 min-w-0 flex flex-col justify-start">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Select Files ({selectedFiles.length} selected)
            </span>
            {files.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onSelectionChange(files.map(f => f.filename))}
                  className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  Select All
                </button>
                <span className="text-[10px]" style={{ color: 'var(--border-subtle)' }}>|</span>
                <button
                  type="button"
                  onClick={() => onSelectionChange([])}
                  className="text-xs font-medium transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {loadingFiles ? (
            <div className="flex items-center gap-2 py-8 text-xs justify-center flex-1" style={{ color: 'var(--text-muted)' }}>
              <div className="w-3.5 h-3.5 rounded-full border border-purple-500 border-t-transparent animate-spin" />
              Loading indexed files...
            </div>
          ) : files.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 text-xs text-center border border-dashed rounded-xl" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)', background: 'rgba(0,0,0,0.02)' }}>
              No documents uploaded yet.
            </div>
          ) : (
            <div className="max-h-[220px] overflow-y-auto pr-1 flex flex-col gap-1.5 scrollbar-thin">
              {files.map(file => {
                const isSelected = selectedFiles.includes(file.filename);
                return (
                  <div
                    key={file.filename}
                    onClick={() => {
                      if (isSelected) {
                        onSelectionChange(selectedFiles.filter(f => f !== file.filename));
                      } else {
                        onSelectionChange([...selectedFiles, file.filename]);
                      }
                    }}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all border ${
                      isSelected 
                        ? 'bg-purple-500/5 border-purple-500/20' 
                        : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="flex-shrink-0" style={{ color: isSelected ? 'var(--accent-purple)' : 'var(--text-muted)' }}>
                      {isSelected ? <CheckSquare size={16} weight="fill" /> : <Square size={16} />}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {file.filename}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {file.chunk_count} chunks
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const { download_url } = await downloadFile(file.filename);
                            window.open(download_url, '_blank');
                          } catch (err) {
                            alert(`Failed to download: ${err.message}`);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-purple-500/10 text-gray-400 hover:text-purple-400 transition-all"
                        title="Download"
                      >
                        <DownloadSimple size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`Delete "${file.filename}"?`)) return;
                          try {
                            await deleteFile(file.filename);
                            onSelectionChange(selectedFiles.filter(f => f !== file.filename));
                            fetchFiles();
                          } catch (err) {
                            alert(`Failed to delete: ${err.message}`);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all"
                        title="Delete"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
