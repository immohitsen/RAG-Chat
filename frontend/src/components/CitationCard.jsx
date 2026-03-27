import React, { useState } from 'react';
import { CaretDown, FileText } from '@phosphor-icons/react';

const confidenceColor = (score) => {
  if (score >= 0.7) return { bar: 'bg-emerald-400', text: 'text-emerald-400' };
  if (score >= 0.4) return { bar: 'bg-amber-400', text: 'text-amber-400' };
  return { bar: 'bg-red-400', text: 'text-red-400' };
};

const CitationCard = ({ sources }) => {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;

  return (
    <div className="ml-11 mb-4 animate-fade-in">
      {/* Toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs px-3 py-1.5 glass rounded-lg mb-2 transition-all hover:border-purple-500/30"
        style={{ color: 'var(--text-muted)' }}
      >
        <FileText size={12} className="text-purple-400" />
        <span>{sources.length} source{sources.length !== 1 ? 's' : ''}</span>
        <CaretDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Sources list */}
      {open && (
        <div className="space-y-2 animate-slide-up">
          {sources.map((source, idx) => {
            const pct = Math.round(source.confidence * 100);
            const { bar, text } = confidenceColor(source.confidence);
            return (
              <div key={idx} className="glass-card p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={12} className="text-purple-400 flex-shrink-0" />
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                      {source.file}
                      {source.page && <span style={{ color: 'var(--text-muted)' }}> · p.{source.page}</span>}
                    </span>
                  </div>
                  <span className={`text-xs font-semibold flex-shrink-0 ${text}`}>{pct}%</span>
                </div>

                {/* Confidence bar */}
                <div className="w-full h-1 rounded-full mb-2" style={{ background: 'var(--border-subtle)' }}>
                  <div
                    className={`conf-bar ${bar}`}
                    style={{ '--fill-width': `${pct}%`, width: `${pct}%` }}
                  />
                </div>

                {/* Snippet */}
                {source.snippet && (
                  <p className="text-xs italic leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                    "{source.snippet}..."
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CitationCard;
