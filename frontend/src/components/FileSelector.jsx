import React, { useState, useEffect, useRef } from 'react';
import { listIndexedFiles, deleteFile } from '../services/api';
import { Folders, CaretDown, Trash, CheckSquare, Square, FileText, Hash, Folder } from '@phosphor-icons/react';

const FileSelector = ({ onSelectionChange, refreshTrigger, asHeaderIcon }) => {
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchFiles();
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

  const fetchFiles = async () => {
    try {
      const response = await listIndexedFiles();
      const fileList = response.files || [];
      setFiles(fileList);
      const allNames = fileList.map(f => f.filename);
      setSelectedFiles(allNames);
      onSelectionChange(allNames);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFile = (filename) => {
    setSelectedFiles(prev => {
      const next = prev.includes(filename)
        ? prev.filter(f => f !== filename)
        : [...prev, filename];
      onSelectionChange(next);
      return next;
    });
  };

  const selectAll = () => {
    const all = files.map(f => f.filename);
    setSelectedFiles(all);
    onSelectionChange(all);
  };

  const deselectAll = () => {
    setSelectedFiles([]);
    onSelectionChange([]);
  };

  const handleDelete = async (filename, e) => {
    e.stopPropagation();
    if (!confirm(`Delete "${filename}"?`)) return;
    try {
      await deleteFile(filename);
      await fetchFiles();
    } catch (err) {
      alert(`Failed to delete: ${err.response?.data?.detail || err.message}`);
    }
  };

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

  const allSelected = selectedFiles.length === files.length;
  const label = allSelected ? 'All Files' : `${selectedFiles.length} of ${files.length}`;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      {asHeaderIcon ? (
        <button
          onClick={() => setShowDropdown(o => !o)}
          className="flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity"
        >
          <Folder size={18} className="text-gray-500" />
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Files</span>
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

          <div className={`absolute top-full ${asHeaderIcon ? 'right-0 shadow-2xl' : 'left-0'} mt-2 w-72 glass-strong rounded-2xl z-30 overflow-hidden animate-scale-in`}
            style={{ border: '1px solid var(--border-subtle)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Select Documents</span>
              <div className="flex items-center gap-3">
                <button onClick={selectAll} className="text-xs text-purple-400 hover:text-purple-300 transition-colors">All</button>
                <span style={{ color: 'var(--border-subtle)' }}>|</span>
                <button onClick={deselectAll} className="text-xs" style={{ color: 'var(--text-muted)' }}>None</button>
              </div>
            </div>

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

                    <button
                      onClick={(e) => handleDelete(file.filename, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all hover:bg-red-500/10"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash size={12} className="hover:text-red-400 transition-colors" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
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
          </div>
        </>
      )}
    </div>
  );
};

export default FileSelector;
