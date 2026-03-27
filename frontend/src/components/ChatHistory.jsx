import React, { useState, useEffect } from 'react';
import { getSessions, deleteSession } from '../services/api';
import { Chat, Trash, Clock } from '@phosphor-icons/react';

const ChatHistory = ({ currentSessionId, onSelectSession, refreshTrigger }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, [refreshTrigger]);

  const fetchSessions = async () => {
    try {
      const data = await getSessions();
      setSessions(data || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, sessionId) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat history?')) return;
    try {
      await deleteSession(sessionId);
      if (currentSessionId === sessionId) {
        onSelectSession(null); // clear current if deleted
      }
      fetchSessions();
    } catch (err) {
      alert('Failed to delete session');
    }
  };

  if (loading) {
    return <div className="text-xs text-slate-400 px-2 py-4">Loading history...</div>;
  }

  if (sessions.length === 0) {
    return <div className="text-xs text-slate-500 px-2 py-4">No recent chats</div>;
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto max-h-48 pr-2">
      {sessions.map(session => {
        const isActive = session._id === currentSessionId;
        return (
          <div
            key={session._id}
            onClick={() => onSelectSession(session._id)}
            className={`group flex items-center justify-between px-3 py-1 rounded-[20px] cursor-pointer transition-colors ${
              isActive ? 'bg-purple-500/10 text-purple-600' : 'hover:bg-white/5 text-slate-600 hover:text-slate-400'
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-sm font-medium truncate">
                {session.title ? session.title.charAt(0).toUpperCase() + session.title.slice(1) : ''}
              </span>
            </div>
            
            <button
              onClick={(e) => handleDelete(e, session._id)}
              className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 hover:text-red-400 ${
                isActive ? 'opacity-100' : ''
              }`}
            >
              <Trash size={18} className='text-red-500 ml-4'/>
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ChatHistory;
