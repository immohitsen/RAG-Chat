'use client';

import React from 'react';
import { Clock, Database, DiamondsFourIcon } from '@phosphor-icons/react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* ── Component ── */

/* ── Component ── */
const MessageBubble = ({ message }) => {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[85%] md:max-w-[75%] bg-black/5 dark:bg-white/5 rounded-[22px] px-4 py-2.5 md:px-5 md:py-3 text-[15px] md:text-[16px] leading-relaxed break-words" style={{ color: 'var(--text-primary)' }}>
          {message.content}
        </div>
      </div>
    );
  }

  // AI message
  return (
    <div className="flex gap-2.5 md:gap-4 mb-5 max-w-[95%] md:max-w-[85%]">
      {/* Diamond icon */}
      <div className="flex-shrink-0 mt-1">
        <DiamondsFourIcon size={20} className="md:w-6 md:h-6 text-purple-600" />
      </div>

      <div className="flex-1 min-w-0">
        {message.isError ? (
          <p className="text-red-500 leading-relaxed">{message.content}</p>
        ) : (
          <div className="text-[14px] md:text-[15px] leading-relaxed markdown-prose">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({node, ...props}) => <p style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }} {...props} />,
                ul: ({node, ...props}) => <ul style={{ paddingLeft: 24, margin: '8px 0', listStyleType: 'disc', color: 'var(--text-primary)' }} {...props} />,
                ol: ({node, ...props}) => <ol style={{ paddingLeft: 24, margin: '8px 0', listStyleType: 'decimal', color: 'var(--text-primary)' }} {...props} />,
                li: ({node, ...props}) => <li style={{ marginBottom: 6 }} {...props} />,
                h1: ({node, ...props}) => <h1 style={{ fontSize: 20, fontWeight: 700, margin: '16px 0 8px', color: 'var(--text-primary)' }} {...props} />,
                h2: ({node, ...props}) => <h2 style={{ fontSize: 18, fontWeight: 700, margin: '16px 0 8px', color: 'var(--text-primary)' }} {...props} />,
                h3: ({node, ...props}) => <h3 style={{ fontSize: 16, fontWeight: 700, margin: '12px 0 6px', color: 'var(--text-primary)' }} {...props} />,
                a: ({node, ...props}) => <a style={{ color: 'var(--accent-purple)', textDecoration: 'underline' }} {...props} />,
                blockquote: ({node, ...props}) => <blockquote style={{ borderLeft: '3px solid var(--border-subtle)', paddingLeft: 12, margin: '12px 0', color: 'var(--text-muted)' }} {...props} />,
                code: ({node, inline, ...props}) => 
                  inline ? (
                    <code style={{ background: 'var(--code-bg)', borderRadius: 4, padding: '2px 6px', fontSize: '0.85em', fontFamily: 'monospace', color: 'var(--text-primary)' }} {...props} />
                  ) : (
                    <pre style={{ background: 'var(--bg-surface-hover, rgba(0,0,0,0.03))', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px', overflowX: 'auto', margin: '12px 0', fontSize: 13 }}>
                      <code style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }} {...props} />
                    </pre>
                  ),
                strong: ({node, ...props}) => <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }} {...props} />
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Metadata */}
        {message.metadata && (
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              <Clock size={10} /> {message.metadata.query_time}s
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              <Database size={10} /> {message.metadata.chunks_used} sources
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
