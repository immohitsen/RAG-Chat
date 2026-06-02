'use client';

import { useState, useEffect, useRef } from 'react';
import { listIndexedFiles, deleteFile, downloadFile } from '../services/api';
import { Folders, CaretDown, Trash, CheckSquare, Square, Hash, Folder, DownloadSimple } from '@phosphor-icons/react';

const FileSelector = ({ onSelectionChange, selectedFiles = [], refreshTrigger, asHeaderIcon }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchFiles(true);
  }, []);

  useEffect(() => {
    if (refreshTrigger > 0) fetchFiles(false);
  }, [refreshTrigger]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchFiles = async (isInitial = false) => {
    try {
      const response = await listIndexedFiles();
      const fileList = response.files || [];
      setFiles(fileList);
      // if (isInitial) {
      //   const allNames = fileList.map(f => f.filename);
      //   onSelectionChange(allNames);
      // }
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFile = (filename) => {
    const next = selectedFiles.includes(filename)
      ? selectedFiles.filter(f => f !== filename)
      : [...selectedFiles, filename];
    onSelectionChange(next);
  };

  const selectAll = () => {
    const all = files.map(f => f.filename);
    onSelectionChange(all);
  };

  const deselectAll = () => {
    onSelectionChange([]);
  };

  const handleDelete = async (filename, e) => {
    e.stopPropagation();
    if (!confirm(`Delete "${filename}"?`)) return;
    try {
      await deleteFile(filename);
      const next = selectedFiles.filter(f => f !== filename);
      onSelectionChange(next);
      await fetchFiles();
    } catch (err) {
      alert(`Failed to delete: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleDownload = async (filename, e) => {
    e.stopPropagation();
    try {
      const { download_url } = await downloadFile(filename);
      window.open(download_url, '_blank');
    } catch (err) {
      alert(`Failed to download: ${err.response?.data?.detail || err.message}`);
    }
  };

  // For inline (non-header) mode: show loading/empty states as before
  if (!asHeaderIcon) {
    if (loading) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <div className="w-3 h-3 rounded-full border border-purple-500 border-t-transparent animate-spin" />
          Loading files...
        </div>
      );
    }

    if (files.length === 0) {
      return (
        <div className="px-3 py-2.5 glass rounded-xl text-xs" style={{ color: 'var(--text-muted)' }}>
          <Folders size={14} className="inline mr-2 text-purple-400" />
          No documents indexed yet
        </div>
      );
    }
  }

  const allSelected = files.length > 0 && selectedFiles.length === files.length;
  const label = allSelected ? 'All Files' : `${selectedFiles.length} of ${files.length}`;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      {asHeaderIcon ? (
        <button
          onClick={() => setShowDropdown(o => !o)}
          className="flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity relative"
        >
          <Folder size={18} style={{ color: files.length === 0 ? 'var(--text-muted)' : 'var(--text-secondary)' }} />
          <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Files</span>
          {files.length === 0 && !loading && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
          )}
        </button>
      ) : (
        <button
          onClick={() => setShowDropdown(o => !o)}
          className="flex items-center justify-between gap-2 w-full px-3 py-2.5 glass rounded-xl text-xs font-medium transition-all hover:border-purple-500/30"
          style={{ color: 'var(--text-secondary)' }}
        >
          <div className="flex items-center gap-2">
            <Folders size={13} className="text-purple-400" />
            <span>{label}</span>
          </div>
          <CaretDown size={13} className={`transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <>
          {/* Blur backdrop (just for the dropdown area feel) */}
          <div className="fixed inset-0 z-20" onClick={() => setShowDropdown(false)} />

          <div className={`${asHeaderIcon ? 'fixed top-[56px] left-2 right-2 md:absolute md:top-full md:left-auto md:right-0 md:w-72 shadow-2xl dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)]' : 'absolute top-full left-0 w-72'} mt-0 md:mt-2 glass-strong rounded-2xl z-30 overflow-hidden animate-scale-in`}
            style={{ border: '1px solid var(--border-subtle)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Select Documents</span>
              {files.length > 0 && (
              <div className="flex items-center gap-3">
                <button onClick={selectAll} className="text-xs text-purple-400 hover:text-purple-300 transition-colors">All</button>
                <span style={{ color: 'var(--border-subtle)' }}>|</span>
                <button onClick={deselectAll} className="text-xs" style={{ color: 'var(--text-muted)' }}>None</button>
              </div>
              )}
            </div>

            {/* Loading / Empty / File List */}
            {loading ? (
              <div className="flex items-center gap-2 px-4 py-5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <div className="w-3 h-3 rounded-full border border-purple-500 border-t-transparent animate-spin" />
                Loading files...
              </div>
            ) : files.length === 0 ? (
              <div className="px-4 py-5 text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <Folders size={14} className="text-purple-400 flex-shrink-0" />
                No documents indexed yet
              </div>
            ) : null}

            {/* File List */}
            <div className="max-h-56 overflow-y-auto py-2">
              {files.map(file => {
                const checked = selectedFiles.includes(file.filename);
                return (
                  <div
                    key={file.filename}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors group"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => toggleFile(file.filename)}
                  >
                    {/* Checkbox */}
                    <div className={`flex-shrink-0 transition-colors ${checked ? 'text-purple-400' : ''}`}
                      style={{ color: checked ? 'var(--accent-purple)' : 'var(--text-muted)' }}>
                      {checked ? <CheckSquare size={14} /> : <Square size={14} />}
                    </div>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {file.filename}
                      </p>
                      <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        <Hash size={9} />{file.chunk_count} chunks
                      </p>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => handleDownload(file.filename, e)}
                        className="p-1 rounded-lg hover:bg-purple-500/10"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <DownloadSimple size={12} className="hover:text-purple-400 transition-colors" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(file.filename, e)}
                        className="p-1 rounded-lg hover:bg-red-500/10"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Trash size={12} className="hover:text-red-400 transition-colors" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            {files.length > 0 && (
            <div className="px-4 py-2.5 border-t flex items-center justify-between"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {selectedFiles.length} selected
              </span>
              <div className="flex gap-1">
                {files.slice(0, 3).map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full"
                    style={{ background: i < selectedFiles.length ? 'var(--accent-purple)' : 'var(--border-subtle)' }} />
                ))}
              </div>
            </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FileSelector;
