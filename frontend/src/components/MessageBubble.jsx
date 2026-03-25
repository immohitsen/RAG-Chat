import React from 'react';
import { Cpu, User, Clock, Database } from 'lucide-react';

const MessageBubble = ({ message }) => {
  const isUser = message.role === 'user';

  const formatContent = (text) => {
    // Bold **text**
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex items-start gap-3 max-w-2xl ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>

        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-gradient-to-br from-violet-500 to-indigo-600' : 'btn-gradient'
        }`}>
          {isUser
            ? <User size={14} className="text-white" />
            : <Cpu size={14} className="text-white" />
          }
        </div>

        {/* Bubble */}
        <div>
          <div className={`px-4 py-3 text-sm leading-relaxed ${
            isUser ? 'msg-user text-white' : message.isError
              ? 'rounded-2xl border text-red-300'
              : 'msg-ai'
          }`}
            style={message.isError ? {
              background: 'rgba(239,68,68,0.08)',
              borderColor: 'rgba(239,68,68,0.2)',
              color: '#fca5a5',
            } : !isUser ? { color: 'var(--text-primary)' } : {}}
          >
            <p
              className="whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
            />
          </div>

          {/* Metadata */}
          {!isUser && message.metadata && (
            <div className="flex items-center gap-3 mt-1.5 px-1">
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Clock size={10} />
                {message.metadata.query_time}s
              </span>
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Database size={10} />
                {message.metadata.chunks_used} sources
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
