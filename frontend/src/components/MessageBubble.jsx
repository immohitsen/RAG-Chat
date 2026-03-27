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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <div style={{
          maxWidth: '72%',
          background: 'var(--bg-surface-hover, rgba(0,0,0,0.06))',
          borderRadius: 22,
          padding: '12px 18px',
          fontSize: 16,
          lineHeight: 1.65,
          color: 'var(--text-primary)',
          wordBreak: 'break-word',
        }}>
          {message.content}
        </div>
      </div>
    );
  }

  // AI message
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 20, gap: 12 }}>
      {/* Diamond icon */}
      <div style={{ flexShrink: 0, marginTop: 3 }}>
        <DiamondsFourIcon  size={24} style={{ color: 'var(--accent-purple, #7c3aed)' }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {message.isError ? (
          <p style={{ color: '#ef4444', lineHeight: 1.7 }}>{message.content}</p>
        ) : (
          <div style={{ fontSize: 15, lineHeight: 1.75 }} className="markdown-prose">
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
                    <code style={{ background: 'rgba(0,0,0,0.05)', borderRadius: 4, padding: '2px 6px', fontSize: '0.85em', fontFamily: 'monospace', color: 'var(--text-primary)' }} {...props} />
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
