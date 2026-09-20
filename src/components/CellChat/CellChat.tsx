import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../store/ProjectContext';
import { sendChatMessage, ResponseLength } from '../../services/anthropic';
import { ChatMessageItem } from './ChatMessage';
import { CellInterest } from '../../types';

function ChatToggleButton({ onToggle }: { onToggle?: () => void }) {
  if (!onToggle) return null;
  return (
    <button
      onClick={onToggle}
      title="チャットを隠す"
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9ca3af', display: 'flex', alignItems: 'center', flexShrink: 0 }}
    >
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1.5" y="1.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <line x1="12" y1="1.5" x2="12" y2="16.5" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="12" y="1.5" width="4.5" height="15" rx="1.5" fill="currentColor" opacity="0.25"/>
      </svg>
    </button>
  );
}

export function CellChat({ onToggle }: { onToggle?: () => void }) {
  const { state, dispatch } = useApp();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState('');
  const [responseLength, setResponseLength] = useState<ResponseLength>('normal');
  const [rowNameEdit, setRowNameEdit] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.selectedCellId, streamingText]);

  const selectedCellForName = state.projectData?.cells.find(c => c.id === state.selectedCellId);
  const selectedRowForName = state.projectData?.rows.find(r => r.id === selectedCellForName?.rowId);

  useEffect(() => {
    setRowNameEdit(selectedRowForName?.name ?? '');
  }, [selectedRowForName?.id]);

  if (!state.projectData || !state.selectedCellId) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <ChatToggleButton onToggle={onToggle} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: 24 }}>
          セルを選択してチャットを開始
        </div>
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

  // この行の論文PDFのURL(行に保存されたURLを優先、無ければ旧データ用に「PDF」列→URL形式のセルを探す)
  const isUrl = (v: string) => /^https?:\/\/\S+$/.test((v || '').trim());
  const pdfColumn = state.projectData.columns.find(c => c.name === 'PDF');
  const pdfCell =
    (pdfColumn && rowCells.find(c => c.columnId === pdfColumn.id && isUrl(c.value))) ||
    rowCells.find(c => isUrl(c.value));
  const pdfUrl = (row.pdfUrl || '').trim() || (pdfCell ? pdfCell.value.trim() : '');

  const commitRowName = () => {
    const trimmed = rowNameEdit.trim();
    if (trimmed && trimmed !== row.name) {
      dispatch({ type: 'UPDATE_ROW_NAME', rowId: row.id, name: trimmed });
    } else {
      setRowNameEdit(row.name);
    }
  };

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
        { row, column, cell, rowCells, columns: state.projectData!.columns, history: messages, responseLength },
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
        star: false,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12 }}>
      {/* Cell info header */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #e5e7eb', paddingBottom: 10, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <ChatToggleButton onToggle={onToggle} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              value={rowNameEdit}
              onChange={e => setRowNameEdit(e.target.value)}
              onBlur={commitRowName}
              onKeyDown={e => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') { setRowNameEdit(row.name); e.currentTarget.blur(); }
              }}
              title="クリックして行名を編集"
              style={{
                fontSize: 11,
                color: '#9ca3af',
                border: 'none',
                borderBottom: '1px dashed #d1d5db',
                background: 'transparent',
                padding: 0,
                width: '100%',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>{column.name}</div>
          </div>
        </div>
        {/* Meta info + Source button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
          {pdfUrl && (
            <button
              onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
              style={{
                padding: '2px 8px',
                fontSize: 11,
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                cursor: 'pointer',
                color: '#374151',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              📄 PDF
            </button>
          )}
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
        {/* Response length selector */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {([['short', '短め'], ['normal', '普通'], ['detailed', '詳細']] as [ResponseLength, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setResponseLength(val)}
              style={{
                padding: '2px 10px',
                fontSize: 11,
                borderRadius: 4,
                border: '1px solid',
                borderColor: responseLength === val ? '#3b82f6' : '#d1d5db',
                background: responseLength === val ? '#eff6ff' : '#f9fafb',
                color: responseLength === val ? '#2563eb' : '#6b7280',
                cursor: 'pointer',
                fontWeight: responseLength === val ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
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
