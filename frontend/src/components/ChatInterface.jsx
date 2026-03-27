import React, { useState, useRef, useEffect } from 'react';
import { sendQuery, createSession, getSessionMessages } from '../services/api';
import MessageBubble from './MessageBubble';
import CitationCard from './CitationCard';
import FileUpload from './FileUpload';
import FileSelector from './FileSelector';
import ChatHistory from './ChatHistory';
import { 
  PaperPlaneRightIcon,
  BookOpenIcon,
  LightningIcon,
  DatabaseIcon,
  CaretDownIcon,
  DiamondsFourIcon ,
  PlusIcon,
  ListIcon,
  NotePencilIcon
} from '@phosphor-icons/react';


const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [topK, setTopK] = useState(3);
  const [selectedFiles, setSelectedFiles] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [stats, setStats] = useState({ queries: 0, sources: 0 });
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Re-focus the input box automatically after the AI finishes loading
  useEffect(() => {
    if (!loading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
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
    // UI logic handled within FileUpload now (self-closing). Just refresh knowledge base globally.
    setRefreshTrigger(t => t + 1);
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setStats({ queries: 0, sources: 0 });
  };

  const handleSelectSession = async (sessionId) => {
    if (!sessionId) {
      handleNewChat();
      return;
    }
    setCurrentSessionId(sessionId);
    setLoading(true);
    try {
      const msgs = await getSessionMessages(sessionId);
      setMessages(msgs);
      setStats({
        queries: msgs.filter(m => m.role === 'user').length,
        sources: msgs.reduce((acc, m) => acc + (m.sources?.length || 0), 0)
      });
    } catch (err) {
      console.error("Failed to load session", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* ── Sidebar ── */}
      <aside className={`flex-shrink-0 flex flex-col gap-5 border-r transition-[width,padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${
        isSidebarOpen ? 'w-72 p-4' : 'w-[76px] py-4 px-2 items-center'
      }`}
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>

        <div className={`flex w-full ${isSidebarOpen ? 'justify-start' : 'justify-start'} px-1`}>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="p-2 rounded-xl hover:bg-black/5 transition-colors text-gray-500"
            title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <ListIcon size={22} className="flex-shrink-0" />
          </button>
        </div>

        {/* New Chat Button */}
        <button
          onClick={handleNewChat}
          className={`group flex items-center rounded-xl text-gray-700 font-medium transition-all duration-300 flex-shrink-0 overflow-hidden hover:bg-black/5 ${
            isSidebarOpen ? 'justify-start gap-3 px-3 py-2.5 w-full mx-0' : 'justify-start p-0 w-11 h-11'
          }`}
          title="New chat"
        >
          <NotePencilIcon size={isSidebarOpen ? 20 : 22} className="flex-shrink-0 transition-transform duration-300 group-hover:scale-105 opacity-80" />
          <span 
            className={`whitespace-nowrap transition-all duration-300 text-[15px] ${isSidebarOpen ? 'w-auto opacity-100' : 'w-0 opacity-0 hidden'}`}
          >
            New chat
          </span>
        </button>

        {/* Removed File Selector from here */}

        {/* Removed Top-K from here */}

        {/* Pipeline Progress Widget Removed */}

        {/* Lower Sidebar Content - Hides Smoothly */}
        <div className={`flex flex-col flex-1 min-h-0 transition-opacity duration-300 ${
            isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`} style={{ width: '256px' }}>
          
          {/* History */}
          <div className="flex flex-col flex-1 min-h-0">
            <p className="text-xs font-medium mb-3 px-2 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>RECENT CHATS</p>
            <div className="flex-1 overflow-y-auto min-h-0 px-1">
              <ChatHistory 
                currentSessionId={currentSessionId} 
                onSelectSession={handleSelectSession} 
                refreshTrigger={refreshTrigger} 
              />
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 flex-shrink-0 px-1">
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
        </div>
      </aside>

      {/* ── Main Chat ── */}
      <div className="flex-1 flex flex-col min-w-0 relative">

        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 flex-shrink-0 relative z-20">
          <div className="flex items-center gap-3">
            <span className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
              Maester
            </span>
          </div>
          <div className="flex items-center gap-5">
            <FileSelector asHeaderIcon={true} onSelectionChange={setSelectedFiles} refreshTrigger={refreshTrigger} />
            <div className="w-px h-6 bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Llama 3.1 • Groq</span>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center">
          <div className={`w-full max-w-3xl flex flex-col ${messages.length === 0 ? 'flex-1' :      'space-y-4'}`}>
            {/* Welcome State */}
            {messages.length === 0 && (
            <div className="absolute top-[32%] left-0 right-0 flex justify-center animate-fade-in px-6 pointer-events-none z-0">
              <div className="w-full max-w-3xl flex flex-col items-start gap-1">
                <span className="text-2xl font-regular" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}>Hi Buddy</span>
                <span className="text-4xl" style={{ color: 'var(--text-primary)', fontWeight: 400, fontFamily: 'inherit' }}>Where should we start?</span>
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
                  <DiamondsFourIcon  size={14} className="text-white" />
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

        {/* Input */}
        <div 
          className={`px-6 pt-2 flex flex-col items-center flex-shrink-0 z-10 transition-all duration-500 ease-in-out ${
            messages.length === 0 
              ? 'absolute top-[50%] left-0 right-0 w-full' 
              : 'pb-6 relative'
          }`} 
          style={messages.length === 0 ? {} : { background: 'linear-gradient(to top, var(--bg-surface) 60%, transparent)' }}
        >
          <div className="w-full max-w-3xl bg-white rounded-[28px] flex flex-col p-2 transition-all duration-200 shadow-[0_4px_16px_rgba(0,0,0,0.04)] border-2 border-gray-100">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask With Context"
              className="w-full bg-transparent resize-none text-[15px] p-3 leading-relaxed focus:outline-none focus:ring-0 placeholder:text-gray-500"
              style={{ color: 'var(--text-primary)', minHeight: '60px', maxHeight: '200px' }}
              rows={1}
              disabled={loading}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
              }}
            />
            
            <div className="flex items-center justify-between w-full mt-1 px-1 pb-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowUpload(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                  title="Upload Document"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <PlusIcon size={22} className="text-gray-500" />
                </button>
                
                {/* Custom Popover for Top-K */}
                <div className="relative flex items-center">
                  <button
                    onClick={() => setShowContext(!showContext)}
                    className="h-8 px-3 flex items-center justify-center gap-1.5 rounded-full hover:bg-gray-100 transition-colors"
                    title="Context Chunks"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <DatabaseIcon size={16} className="text-gray-500" />
                    <span className="text-[13px] font-medium text-gray-600">Context: {topK}</span>
                    <CaretDownIcon size={14} className="opacity-70" />
                  </button>
                  
                  {showContext && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowContext(false)} />
                      <div className="absolute bottom-full left-0 mb-2 w-auto min-w-[64px] bg-white p-1.5 animate-scale-in z-50 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 flex flex-col gap-0.5">
                        <div className="text-[10px] uppercase font-bold text-gray-400 px-2 py-1 mb-1 text-center tracking-wider">Chunks</div>
                        {[1, 3, 5, 7, 10].map(k => (
                          <button
                            key={k}
                            onClick={() => {
                              setTopK(k);
                              setShowContext(false);
                            }}
                            className={`w-full py-2 text-[13px] font-medium rounded-xl transition-colors ${topK === k ? 'bg-gray-100 text-black' : 'hover:bg-gray-50 text-gray-500'}`}
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
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 hover:bg-gray-100"
                >
                  <PaperPlaneRightIcon size={20} className={!input.trim() || loading ? "text-gray-400" : "text-black"} weight="fill"/>
                </button>
              </div>
            </div>
          </div>
          <p className="text-center text-xs mt-3 w-full max-w-3xl" style={{ color: 'var(--text-muted)' }}>
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
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatInterface;
