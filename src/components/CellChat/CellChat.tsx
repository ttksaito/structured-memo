import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../store/ProjectContext';
import { sendChatMessage } from '../../services/anthropic';
import { ChatMessageItem } from './ChatMessage';
import { CellInterest } from '../../types';

export function CellChat() {
  const { state, dispatch } = useApp();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState('');
  const [editingValue, setEditingValue] = useState(false);
  const [editValueText, setEditValueText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.selectedCellId, streamingText]);

  if (!state.projectData || !state.selectedCellId) {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14, textAlign: 'center' }}>
        セルを選択してチャットを開始
      </div>
    );
  }

  const cell = state.projectData.cells.find(c => c.id === state.selectedCellId);
  if (!cell) return null;

  const row = state.projectData.rows.find(r => r.id === cell.rowId);
  const column = state.projectData.columns.find(c => c.id === cell.columnId);
  if (!row || !column) return null;

  const thread = state.projectData.threads.find(t => t.cellId === cell.id);
  const messages = thread?.messages || [];
  const interest = state.projectData.interests.find(i => i.cellId === cell.id);
  const rowCells = state.projectData.cells.filter(c => c.rowId === cell.rowId);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!state.apiKey) {
      setError('APIキーが設定されていません。ホーム画面で設定してください。');
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setError('');

    const userMsg = {
      id: 'msg-' + Date.now(),
      role: 'user' as const,
      content: userMessage,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_MESSAGE', cellId: cell.id, message: userMsg });

    setIsLoading(true);
    setStreamingText('');

    try {
      const fullText = await sendChatMessage(
        state.apiKey,
        { row, column, cell, rowCells, columns: state.projectData!.columns, history: messages },
        userMessage,
        (text) => setStreamingText(text)
      );

      const assistantMsg = {
        id: 'msg-' + (Date.now() + 1),
        role: 'assistant' as const,
        content: fullText,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_MESSAGE', cellId: cell.id, message: assistantMsg });

      // Update interest
      const newInterest: CellInterest = {
        cellId: cell.id,
        chatCount: (interest?.chatCount || 0) + 1,
        lastChattedAt: new Date().toISOString(),
        star: interest?.star || false,
      };
      dispatch({ type: 'UPDATE_INTEREST', interest: newInterest });
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setIsLoading(false);
      setStreamingText('');
    }
  };

  const handleSaveToCell = () => {
    if (messages.length === 0) return;
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) return;
    dispatch({ type: 'UPDATE_CELL', cell: { ...cell, value: lastAssistant.content } });
  };

  const handleSaveToAnnotation = () => {
    if (messages.length === 0) return;
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) return;
    const newAnnotation = cell.annotation
      ? cell.annotation + '\n\n---\n\n' + lastAssistant.content
      : lastAssistant.content;
    dispatch({ type: 'UPDATE_CELL', cell: { ...cell, annotation: newAnnotation } });
  };

  const handleToggleStar = () => {
    const newInterest: CellInterest = {
      cellId: cell.id,
      chatCount: interest?.chatCount || 0,
      lastChattedAt: interest?.lastChattedAt || null,
      star: !(interest?.star || false),
    };
    dispatch({ type: 'UPDATE_INTEREST', interest: newInterest });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12 }}>
      {/* Cell info header */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #e5e7eb', paddingBottom: 10, marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{row.name}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>{column.name}</div>
          </div>
          <button
            onClick={handleToggleStar}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: interest?.star ? '#f59e0b' : '#d1d5db',
            }}
          >
            &#9733;
          </button>
        </div>
        {editingValue ? (
          <textarea
            value={editValueText}
            onChange={e => setEditValueText(e.target.value)}
            onBlur={() => {
              dispatch({ type: 'UPDATE_CELL', cell: { ...cell, value: editValueText } });
              setEditingValue(false);
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') { setEditingValue(false); }
              if (e.key === 'Enter' && e.ctrlKey) {
                dispatch({ type: 'UPDATE_CELL', cell: { ...cell, value: editValueText } });
                setEditingValue(false);
              }
            }}
            autoFocus
            style={{
              width: '100%',
              marginTop: 6,
              minHeight: 60,
              padding: '4px 6px',
              border: '1px solid #3b82f6',
              borderRadius: 4,
              fontSize: 12,
              lineHeight: 1.5,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <div
            onClick={() => { setEditValueText(cell.value); setEditingValue(true); }}
            title="クリックして編集"
            style={{
              fontSize: 12,
              color: cell.value ? '#6b7280' : '#d1d5db',
              marginTop: 6,
              lineHeight: 1.5,
              maxHeight: 60,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              cursor: 'text',
              padding: '2px 4px',
              borderRadius: 4,
              border: '1px solid transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.border = '1px solid #e5e7eb')}
            onMouseLeave={e => (e.currentTarget.style.border = '1px solid transparent')}
          >
            {cell.value || '（クリックして入力）'}
          </div>
        )}
        {/* Meta info */}
        <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
          <span>会話: {interest?.chatCount || 0}回</span>
          {interest?.lastChattedAt && (
            <span>最終: {new Date(interest.lastChattedAt).toLocaleDateString('ja-JP')}</span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {messages.map(msg => (
          <ChatMessageItem key={msg.id} message={msg} />
        ))}
        {isLoading && streamingText && (
          <div style={{ marginBottom: 8 }}>
            <div style={{
              maxWidth: '85%',
              padding: '10px 14px',
              borderRadius: '16px 16px 16px 4px',
              background: '#f3f4f6',
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {streamingText}
            </div>
          </div>
        )}
        {isLoading && !streamingText && (
          <div style={{ padding: 12, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            考え中...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div style={{ flexShrink: 0, padding: 8, background: '#fef2f2', borderRadius: 6, marginTop: 4, fontSize: 12, color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* Input */}
      <div style={{ flexShrink: 0, marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="メッセージを入力..."
            rows={2}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontSize: 13,
              resize: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            style={{
              padding: '8px 14px',
              background: isLoading || !input.trim() ? '#9ca3af' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: isLoading || !input.trim() ? 'default' : 'pointer',
              fontWeight: 600,
              fontSize: 13,
              alignSelf: 'flex-end',
            }}
          >
            送信
          </button>
        </div>
      </div>
    </div>
  );
}
