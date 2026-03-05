import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './store/ProjectContext';

// Global styles
const style = document.createElement('style');
style.textContent = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', 'Noto Sans JP', sans-serif;
    color: #1f2937;
    background: #fff;
    -webkit-font-smoothing: antialiased;
  }
  ::selection { background: #bfdbfe; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
  dialog::backdrop { background: rgba(0,0,0,0.4); }
  .markdown-body h1 { font-size: 1.2em; font-weight: 700; margin: 8px 0 4px; }
  .markdown-body h2 { font-size: 1.1em; font-weight: 700; margin: 8px 0 4px; }
  .markdown-body h3 { font-size: 1em; font-weight: 700; margin: 6px 0 3px; }
  .markdown-body p { margin: 4px 0; }
  .markdown-body ul, .markdown-body ol { padding-left: 1.4em; margin: 4px 0; }
  .markdown-body li { margin: 2px 0; }
  .markdown-body strong { font-weight: 700; }
  .markdown-body em { font-style: italic; }
  .markdown-body code { background: rgba(0,0,0,0.08); border-radius: 3px; padding: 1px 4px; font-family: monospace; font-size: 0.9em; }
  .markdown-body pre { background: rgba(0,0,0,0.08); border-radius: 6px; padding: 8px; margin: 6px 0; overflow-x: auto; }
  .markdown-body pre code { background: none; padding: 0; }
  .markdown-body hr { border: none; border-top: 1px solid rgba(0,0,0,0.15); margin: 8px 0; }
  .markdown-body blockquote { border-left: 3px solid #9ca3af; padding-left: 8px; color: #6b7280; margin: 4px 0; }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
