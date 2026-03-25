import React, { useState, useRef, useEffect } from 'react';
import { sendQuery } from '../services/api';
import MessageBubble from './MessageBubble';
import CitationCard from './CitationCard';
import FileUpload from './FileUpload';
import FileSelector from './FileSelector';
import {
  Send, Sparkles, BookOpen, Zap, Database, ChevronDown,
  UploadCloud, MessageSquare, Settings2, Cpu
} from 'lucide-react';

const SUGGESTIONS = [
  { icon: '🗄️', text: 'What is DBMS?' },
  { icon: '⚙️', text: 'Explain ACID properties' },
  { icon: '💻', text: 'What is an operating system?' },
  { icon: '🔗', text: 'How does indexing work in databases?' },
];

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [topK, setTopK] = useState(3);
  const [selectedFiles, setSelectedFiles] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [stats, setStats] = useState({ queries: 0, sources: 0 });
  const [backendLogs, setBackendLogs] = useState([]);
  const [activityLogs, setActivityLogs] = useState([{
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    text: 'System ready. Waiting for documents...',
    color: 'text-purple-400'
  }]);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const logsEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activityLogs, backendLogs]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendQuery(input, topK, selectedFiles);
      const aiMessage = {
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        metadata: response.metadata,
      };
      setMessages(prev => [...prev, aiMessage]);
      setStats(prev => ({
        queries: prev.queries + 1,
        sources: prev.sources + (response.sources?.length || 0),
      }));
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Something went wrong: ${error.response?.data?.detail || error.message}`,
        isError: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleUploadSuccess = (result) => {
    setShowUpload(false);
  };

  const handleLog = (text, color = 'text-gray-300') => {
    setActivityLogs(prev => [...prev, {
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text,
      color
    }]);
  };

  const handleSuggestion = (text) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex h-full">
      {/* ── Sidebar ── */}
      <aside className="w-72 flex-shrink-0 flex flex-col p-4 gap-4 border-r"
        style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-2 pt-2 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="w-9 h-9 rounded-xl btn-gradient flex items-center justify-center flex-shrink-0">
            <Cpu size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>RAG Pipeline</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>AI Knowledge Base</p>
          </div>
        </div>

        {/* Upload Button */}
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass text-sm font-medium transition-all duration-200 hover:border-purple-500/40 w-full"
          style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}
        >
          <UploadCloud size={16} className="text-purple-400" />
          Upload Document
        </button>

        {/* File Selector */}
        <div>
          <p className="text-xs font-medium mb-2 px-1" style={{ color: 'var(--text-muted)' }}>KNOWLEDGE BASE</p>
          <FileSelector onSelectionChange={setSelectedFiles} />
        </div>

        {/* Top-K */}
        <div>
          <p className="text-xs font-medium mb-2 px-1" style={{ color: 'var(--text-muted)' }}>RETRIEVAL DEPTH</p>
          <div className="flex gap-2 flex-wrap">
            {[1, 3, 5, 7, 10].map(k => (
              <button
                key={k}
                onClick={() => setTopK(k)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
                  topK === k
                    ? 'btn-gradient text-white'
                    : 'glass text-slate-400 hover:text-white'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <p className="text-xs mt-2 px-1" style={{ color: 'var(--text-muted)' }}>Top-{topK} chunks retrieved</p>
        </div>

        {/* Activity Terminal */}
        <div className="flex-1 mt-4 mb-2 flex flex-col min-h-[160px] rounded-xl overflow-hidden glass" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.03)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Activity Terminal</span>
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-400/80" />
              <div className="w-2 h-2 rounded-full bg-amber-400/80" />
              <div className="w-2 h-2 rounded-full bg-emerald-400/80" />
            </div>
          </div>
          <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1.5" style={{ color: 'var(--text-muted)' }}>
            {activityLogs.map((log, i) => (
              <div key={`act-${i}`} className={`break-words ${log.color}`}>
                <span className="opacity-50 mr-2">[{log.time}]</span>
                {log.text}
              </div>
            ))}
            {backendLogs.map((log, i) => (
              <div key={`bck-${i}`} className="text-gray-300 break-words whitespace-pre-wrap">
                {log}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Stats */}
        <div className="mt-auto">
          <div className="glass-card p-4 flex gap-4">
            <div className="flex-1 text-center">
              <div className="text-xl font-bold gradient-text">{stats.queries}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Queries</div>
            </div>
            <div className="w-px" style={{ background: 'var(--border-subtle)' }} />
            <div className="flex-1 text-center">
              <div className="text-xl font-bold gradient-text">{stats.sources}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Sources</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Chat ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-3">
            <MessageSquare size={18} className="text-purple-400" />
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Chat with your documents
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Llama 3.1 • Groq</span>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-2">

          {/* Welcome State */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-max-full text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl btn-gradient flex items-center justify-center mb-6 animate-pulse-glow">
                <Sparkles className="text-white" size={28} />
              </div>
              <h2 className="text-2xl font-bold mb-2 gradient-text">Ask Anything</h2>
              <p className="text-sm mb-8 max-w-sm" style={{ color: 'var(--text-muted)' }}>
                Chat with your uploaded documents using AI-powered semantic search
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestion(s.text)}
                    className="glass rounded-xl px-4 py-3 text-left text-sm transition-all duration-200 hover:border-purple-500/40 group"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span className="mr-2">{s.icon}</span>
                    <span className="group-hover:text-white transition-colors">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, idx) => (
            <div key={idx} className="animate-fade-in">
              <MessageBubble message={msg} />
              {msg.sources && <CitationCard sources={msg.sources} />}
            </div>
          ))}

          {/* Loading */}
          {loading && (
            <div className="flex justify-start mb-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full btn-gradient flex items-center justify-center flex-shrink-0">
                  <Cpu size={14} className="text-white" />
                </div>
                <div className="glass msg-ai px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 flex-shrink-0 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="glass rounded-2xl flex items-end gap-3 p-3 focus-within:border-purple-500/40 transition-all duration-200">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about your documents..."
              className="flex-1 bg-transparent resize-none focus:outline-none text-sm py-1 leading-relaxed focus-glow"
              style={{ color: 'var(--text-primary)', minHeight: '24px', maxHeight: '120px' }}
              rows={1}
              disabled={loading}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="btn-gradient w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            >
              <Send size={15} className="text-white" />
            </button>
          </div>
          <p className="text-center text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* ── Upload Modal ── */}
      {showUpload && (
        <>
          <div className="blur-backdrop" onClick={() => setShowUpload(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="pointer-events-auto animate-scale-in">
              <FileUpload
                onUploadSuccess={handleUploadSuccess}
                onClose={() => setShowUpload(false)}
                onLog={handleLog}
                onBackendLogs={setBackendLogs}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatInterface;
