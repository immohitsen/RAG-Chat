'use client';

import React, { useState, useRef, useEffect } from 'react';
import { sendQuery, createSession, getSessionMessages } from '../services/api';
import MessageBubble from './MessageBubble';
import CitationCard from './CitationCard';
import FileUpload from './FileUpload';
import FileSelector from './FileSelector';
import ChatHistory from './ChatHistory';
import AuthModal from './AuthModal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  PaperPlaneRightIcon,
  BookOpenIcon,
  LightningIcon,
  DatabaseIcon,
  CaretDownIcon,
  DiamondsFourIcon ,
  PlusIcon,
  ListIcon,
  NotePencilIcon,
  UserCircleIcon,
  SignOutIcon,
  FileTextIcon,
  XIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon
} from '@phosphor-icons/react';


const ChatInterface = () => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme() || {};
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [topK, setTopK] = useState(3);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showContext, setShowContext] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const pendingSessionRef = useRef(null);
  const isSendingRef = useRef(false);
  const touchStartXRef = useRef(null);
  const touchCurrentXRef = useRef(null);
  const touchStartTimeRef = useRef(null);

  const EDGE_THRESHOLD = 50;
  const SWIPE_THRESHOLD = 80;
  const VELOCITY_THRESHOLD = 0.3;

  const handleTouchStart = (e) => {
    if (!isMobile) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchCurrentXRef.current = e.touches[0].clientX;
    touchStartTimeRef.current = Date.now();
  };

  const handleTouchMove = (e) => {
    if (!isMobile || touchStartXRef.current === null) return;
    touchCurrentXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!isMobile || touchStartXRef.current === null) return;
    const startX = touchStartXRef.current;
    const endX = touchCurrentXRef.current;
    const delta = endX - startX;
    const velocity = Math.abs(delta) / (Date.now() - touchStartTimeRef.current);
    touchStartXRef.current = null;
    touchCurrentXRef.current = null;
    touchStartTimeRef.current = null;

    if (startX <= EDGE_THRESHOLD && delta > SWIPE_THRESHOLD && (velocity > VELOCITY_THRESHOLD || delta > 120)) {
      setIsSidebarOpen(true);
    }
    if (isSidebarOpen && delta < -SWIPE_THRESHOLD && (velocity > VELOCITY_THRESHOLD || delta < -120)) {
      setIsSidebarOpen(false);
    }
  };

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Responsive detection
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Small timeout ensures the DOM has finished rendering & layout shifts before scrolling
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  // Re-focus the input box automatically after the AI finishes loading
  useEffect(() => {
    if (!loading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [loading]);

  // Auto-resize textarea — runs after DOM reflects new value (handles paste correctly)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || loading || isSendingRef.current) return;
    isSendingRef.current = true;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      try {
        const title = currentInput.slice(0, 35) + (currentInput.length > 35 ? '...' : '');
        const newSession = await createSession(title);
        activeSessionId = newSession._id;
        setCurrentSessionId(activeSessionId);
        setRefreshTrigger(t => t + 1);
      } catch (err) {
        console.error("Failed to create session", err);
      }
    }

    try {
      const response = await sendQuery(currentInput, topK, selectedFiles, activeSessionId);
      const aiMessage = {
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        metadata: response.metadata,
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Something went wrong: ${error.response?.data?.detail || error.message}`,
        isError: true,
      }]);
    } finally {
      setLoading(false);
      isSendingRef.current = false;
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleUploadSuccess = (result) => {
    // UI logic handled within FileUpload now (self-closing). Just refresh knowledge base globally.
    setRefreshTrigger(t => t + 1);
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
  };

  const handleSelectSession = async (sessionId) => {
    if (!sessionId) {
      handleNewChat();
      return;
    }
    setCurrentSessionId(sessionId);
    pendingSessionRef.current = sessionId;
    if (isMobile) setIsSidebarOpen(false);
    setLoading(true);

    try {
      const msgs = await getSessionMessages(sessionId);
      if (pendingSessionRef.current !== sessionId) return;
      setMessages(msgs);
    } catch (err) {
      console.error("Failed to load session", err);
    } finally {
      if (pendingSessionRef.current === sessionId) setLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* ── Sidebar Backdrop (Mobile) ── */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-all duration-300 ${
          isMobile && isSidebarOpen ? 'opacity-100 pointer-events-auto visibility-visible' : 'opacity-0 pointer-events-none invisible'
        }`}
        onClick={() => setIsSidebarOpen(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* ── Sidebar ── */}
      <aside className={`
        flex-shrink-0 flex flex-col gap-5 border-r z-50 overflow-hidden
        ${isMobile 
          ? `fixed inset-y-0 left-0 w-72 shadow-2xl p-4 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}` 
          : `relative transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isSidebarOpen ? 'w-72 p-4' : 'w-[76px] py-4 px-2 items-center'}`}
      `}
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>

        <div className={`flex w-full ${isSidebarOpen ? 'justify-between' : 'justify-center'} px-1 items-center`}>
          {!isMobile && (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-gray-500 dark:text-gray-400"
              title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <ListIcon size={22} className="flex-shrink-0" />
            </button>
          )}
          
          {isMobile && isSidebarOpen && (
             <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-gray-400"
             >
                <CaretDownIcon size={20} className="rotate-90" />
             </button>
          )}
        </div>

        {/* New Chat Button */}
        <button
          onClick={() => {
            handleNewChat();
            if (isMobile) setIsSidebarOpen(false);
          }}
          className={`group flex items-center rounded-xl font-medium transition-all duration-300 flex-shrink-0 overflow-hidden hover:bg-black/5 dark:hover:bg-white/5 ${
            isSidebarOpen ? 'justify-start gap-3 px-3 py-2.5 w-full mx-0' : 'justify-center p-0 w-11 h-11'
          }`}
          style={{ color: 'var(--text-secondary)' }}
          title="New chat"
        >
          <NotePencilIcon size={isSidebarOpen ? 20 : 20} className="flex-shrink-0 transition-transform duration-300 group-hover:scale-105 opacity-80" />
          <span 
            className={`whitespace-nowrap transition-all duration-300 text-[15px] ${isSidebarOpen ? 'w-auto opacity-100' : 'w-0 opacity-0 hidden'}`}
          >
            New chat
          </span>
        </button>

        {/* Lower Sidebar Content */}
        <div className={`flex flex-col flex-1 min-h-0 transition-opacity duration-300 ${
            isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`} style={{ width: '100%' }}>
          
          {/* History */}
          <div className="flex flex-col flex-1 min-h-0">
            <p className="text-xs font-semibold mb-3 px-2 flex-shrink-0 tracking-wider" style={{ color: 'var(--text-muted)' }}>RECENT CHATS</p>
            <div className="flex-1 overflow-y-auto px-1">
              {user ? (
                <ChatHistory
                  currentSessionId={currentSessionId}
                  onSelectSession={handleSelectSession}
                  refreshTrigger={refreshTrigger}
                />
              ) : (
                <div className="px-2 py-3 text-sm rounded-xl text-center" style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}>
                  <button onClick={() => setShowAuthModal(true)} className="text-purple-400 hover:underline">Login</button> to see your chats
                </div>
              )}
            </div>
          </div>

          
        </div>
      </aside>

      {/* ── Main Chat ── */}
      <div
        className="flex-1 flex flex-col min-w-0 relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >

        {/* Header */}
        <header className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 flex-shrink-0 relative z-20 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2 md:gap-3">
             {isMobile && (
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400"
                >
                  <ListIcon size={22} />
                </button>
             )}
            <span className="text-base md:text-lg font-semibold tracking-tight" style={{ color: 'var(--text-secondary)' }}>
              Maester
            </span>
          </div>
          <div className="flex items-center gap-3 md:gap-5">
            {user && <FileSelector asHeaderIcon={true} onSelectionChange={setSelectedFiles} selectedFiles={selectedFiles} refreshTrigger={refreshTrigger} />}
            <div className="hidden sm:block w-px h-6" style={{ background: 'var(--border-subtle)' }} />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] md:text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {isMobile ? 'Llama 3.1' : 'Llama 3.1 • Groq'}
              </span>
            </div>
            <div className="hidden sm:block w-px h-6" style={{ background: 'var(--border-subtle)' }} />
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(o => !o)}
                  className="p-1 rounded-full hover:opacity-80 transition-opacity"
                  title={user.username}
                >
                  <UserCircleIcon size={22} className="text-purple-400" />
                </button>

                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-52 glass-strong rounded-2xl z-30 overflow-hidden animate-scale-in"
                      style={{ border: '1px solid var(--border-subtle)' }}>
                      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user.username}</p>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Logged in</p>
                      </div>

                      {/* Theme Toggle */}
                      <div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <p className="text-[10px] uppercase font-semibold tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Theme</p>
                        <div className="flex rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                          {[
                            { key: 'light', icon: <SunIcon size={14} />, label: 'Light' },
                            { key: 'dark', icon: <MoonIcon size={14} />, label: 'Dark' },
                            { key: 'system', icon: <MonitorIcon size={14} />, label: 'Auto' },
                          ].map(opt => (
                            <button
                              key={opt.key}
                              onClick={() => setTheme(opt.key)}
                              className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium transition-all duration-200 ${
                                theme === opt.key
                                  ? 'text-purple-500 dark:text-purple-400'
                                  : 'hover:bg-black/5 dark:hover:bg-white/5'
                              }`}
                              style={{
                                color: theme === opt.key ? 'var(--accent-purple)' : 'var(--text-muted)',
                                background: theme === opt.key ? 'var(--bg-surface-hover)' : 'transparent',
                              }}
                            >
                              {opt.icon}
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => { logout(); handleNewChat(); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-red-500/10 text-left"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <SignOutIcon size={14} className="text-red-400" />
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-4 py-1.5 rounded-xl text-xs font-medium text-white btn-gradient transition-opacity hover:opacity-90"
              >
                Login
              </button>
            )}
          </div>
        </header>

        {/* Top spacer — flex-1 when no messages, centers the welcome+input block */}
        {messages.length === 0 && <div className="flex-1" />}

        {/* Messages — takes space only when messages exist */}
        {messages.length > 0 && (
          <div
            className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center"
            style={{ overflowAnchor: 'auto', willChange: 'transform' }}
          >
            <div className="w-full max-w-3xl flex flex-col space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className="animate-fade-in">
                  <MessageBubble message={msg} />
                  {msg.sources && <CitationCard sources={msg.sources} />}
                </div>
              ))}
              {loading && (
                <div className="flex justify-start mb-4 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full btn-gradient flex items-center justify-center flex-shrink-0">
                      <DiamondsFourIcon size={14} className="text-white" />
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
          </div>
        )}

        {/* Input */}
        <div
          className="px-4 md:px-6 pt-2 pb-4 md:pb-6 flex flex-col items-center flex-shrink-0 z-10 relative"
          style={messages.length > 0 ? { background: 'linear-gradient(to top, var(--bg-base) 20%, transparent)' } : {}}
        >
          {/* Welcome text — sits just above input on welcome screen */}
          {messages.length === 0 && (
            <div className="w-full max-w-3xl mb-5 animate-fade-in">
              <span className="text-xl md:text-2xl font-regular block" style={{ color: 'var(--text-secondary)' }}>Hi {user?.username || 'Buddy'}</span>
              <span className="text-3xl md:text-4xl leading-tight block" style={{ color: 'var(--text-primary)', fontWeight: 400 }}>Where should we start?</span>
            </div>
          )}
          <div className="relative w-full max-w-3xl">
            <div className="gemini-bloom-glow" />
            <div 
              className="w-full rounded-[24px] md:rounded-[30px] flex flex-col p-1.5 md:p-2 transition-all duration-200 shadow-sm border-[1px] relative z-10" 
              style={{ 
                background: 'var(--bg-base)', 
                borderColor: 'var(--border-subtle)'
              }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                onClick={() => { if (!user) setShowAuthModal(true); }}
                placeholder={user ? (isMobile ? "Ask anything..." : "Ask With Context") : "Login to start chatting..."}
                className="w-full bg-transparent resize-none text-[15px] p-3 leading-relaxed focus:outline-none focus:ring-0 placeholder:text-gray-500 dark:placeholder:text-gray-500"
                style={{ color: 'var(--text-primary)', minHeight: '50px', maxHeight: '50px', overflowY: 'auto' }}
                rows={1}
                disabled={loading || !user}
              />

              {/* Selected file tickers */}
              {selectedFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-2 pb-1 pt-0.5 max-h-[72px] overflow-y-auto">
                  {selectedFiles.map(filename => (
                    <span
                      key={filename}
                      className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 hover:bg-purple-100 dark:hover:bg-purple-500/20 group cursor-default"
                      style={{
                        background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(139,92,246,0.12))',
                        color: 'var(--accent-purple)',
                        border: '1px solid rgba(168,85,247,0.15)',
                      }}
                    >
                      <FileTextIcon size={12} weight="duotone" className="flex-shrink-0 opacity-70" />
                      <span className="truncate max-w-[120px]">{filename}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFiles(prev => {
                            const next = prev.filter(f => f !== filename);
                            return next;
                          });
                        }}
                        className="ml-0.5 p-0.5 rounded-md opacity-50 hover:opacity-100 hover:bg-purple-200/50 transition-all flex-shrink-0"
                      >
                        <XIcon size={10} weight="bold" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between w-full mt-1 px-1 pb-1">
                <div className="flex items-center gap-1 md:gap-2">
                  <button
                    onClick={() => setShowUpload(true)}
                    className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    title="Upload Document"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <PlusIcon size={20} style={{ color: 'var(--text-muted)' }} />
                  </button>
                  
                  {/* Custom Popover for Top-K */}
                  <div className="relative flex items-center">
                    <button
                      onClick={() => setShowContext(!showContext)}
                      className="h-7 md:h-8 px-2 md:px-3 flex items-center justify-center gap-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                      title="Context Chunks"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <DatabaseIcon size={14} style={{ color: 'var(--text-muted)' }} />
                      <span className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{isMobile ? 'Chunks: ' : 'Context: '}{topK}</span>
                      <CaretDownIcon size={12} className="opacity-70" />
                    </button>
                    
                    {showContext && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowContext(false)} />
                        <div className="absolute bottom-full left-0 mb-2 w-auto min-w-[64px] p-1.5 animate-scale-in z-50 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] flex flex-col gap-0.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                          <div className="text-[10px] uppercase font-bold px-2 py-1 mb-1 text-center tracking-wider" style={{ color: 'var(--text-muted)' }}>Chunks</div>
                          {[1, 3, 5, 7, 10].map(k => (
                            <button
                              key={k}
                              onClick={() => {
                                setTopK(k);
                                setShowContext(false);
                              }}
                              className={`w-full py-2 text-[13px] font-medium rounded-xl transition-colors ${topK === k ? 'dark:bg-white/10 bg-gray-100' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                              style={{ color: topK === k ? 'var(--text-primary)' : 'var(--text-muted)' }}
                            >
                              {k}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {/* Send Button replaces mic visually when typing or just sits next to it. Let's place it here. */}
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 hover:bg-gray-100 dark:hover:bg-white/10"
                  >
                    <PaperPlaneRightIcon size={20} style={{ color: !input.trim() || loading ? 'var(--text-muted)' : 'var(--text-primary)' }} weight="fill"/>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-xs mt-3 w-full max-w-3xl" style={{ color: 'var(--text-muted)' }}>
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>

        {/* Bottom spacer — equal to top spacer, perfectly centers welcome+input */}
        {messages.length === 0 && <div className="flex-1" />}
      </div>

      {/* ── Auth Modal ── */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      {/* ── Upload Modal ── */}
      {showUpload && (
        <>
          <div 
            className={`blur-backdrop ${isIndexing ? 'cursor-not-allowed' : 'cursor-pointer'}`} 
            onClick={() => !isIndexing && setShowUpload(false)} 
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="pointer-events-auto animate-scale-in">
              <FileUpload
                onUploadSuccess={handleUploadSuccess}
                onClose={() => setShowUpload(false)}
                onBusyStateChange={setIsIndexing}
                selectedFiles={selectedFiles}
                onSelectionChange={setSelectedFiles}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatInterface;
