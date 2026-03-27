import React from 'react';
import ChatInterface from './components/ChatInterface';
import './index.css';

function App() {
  return (
    /* position:fixed + inset:0 = always exactly fills the visible viewport, no overflow ever */
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-base)', overflow: 'hidden' }}>

      {/* Noise texture overlay */}
      <div
        style={{
          position: 'absolute', inset: 0,
          opacity: 0.03, pointerEvents: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />

      {/* App content — fills the fixed container */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%' }}>
        <ChatInterface />
      </div>
    </div>
  );
}

export default App;
