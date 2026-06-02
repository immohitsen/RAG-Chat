'use client';

import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import ChatInterface from '../src/components/ChatInterface';

export default function Page() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.015,
          pointerEvents: 'none',
          backgroundImage: `url("https://www.transparenttextures.com/patterns/noise-lines.png")`,
          backgroundRepeat: 'repeat',
        }}
      />
      <div style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%' }}>
        <ThemeProvider>
          <AuthProvider>
            <ChatInterface />
          </AuthProvider>
        </ThemeProvider>
      </div>
    </div>
  );
}
