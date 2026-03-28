import React from 'react';
import ChatInterface from './components/ChatInterface';
import './index.css';

function App() {
  return (
    /* position:fixed + inset:0 = always exactly fills the visible viewport, no overflow ever */
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-base)', overflow: 'hidden' }}>

      {/* Performance-optimized noise texture overlay (fixed position, no heavy SVG filter) */}
      <div
        style={{
          position: 'absolute', inset: 0,
          opacity: 0.015, pointerEvents: 'none',
          backgroundImage: `url("https://www.transparenttextures.com/patterns/noise-lines.png")`,
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
