import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/ProjectContext';

export type SortKey = 'none' | 'chatCount' | 'lastChatted';
export type SortDir = 'desc' | 'asc';

interface TableToolbarProps {
  sortKey: SortKey;
  sortDir: SortDir;
  sortColId: string;
  onSortChange: (key: SortKey, colId: string, dir: SortDir) => void;
}

// 上部バーに表示する検索+ソートのツールバー
export function TableToolbar({ sortKey, sortDir, sortColId, onSortChange }: TableToolbarProps) {
  const { state, dispatch } = useApp();
  const [searchInput, setSearchInput] = useState(state.searchQuery);
  const [sortPickerFor, setSortPickerFor] = useState<SortKey | null>(null);

  // ドロップダウンを外側クリックで閉じる
  useEffect(() => {
    if (!sortPickerFor) return;
    const handler = () => setSortPickerFor(null);
    setTimeout(() => window.addEventListener('click', handler), 0);
    return () => window.removeEventListener('click', handler);
  }, [sortPickerFor]);

  if (!state.projectData) return null;

  const allColumns = [...state.projectData.columns].sort((a, b) => a.order - b.order);

  const handleSortButtonClick = (key: SortKey) => {
    if (sortKey === key && sortColId) {
      // 同じキーを再クリック → 方向トグル
      onSortChange(key, sortColId, sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      // 列選択ピッカーを開く
      setSortPickerFor(key);
    }
  };

  const handlePickCol = (key: SortKey, colId: string) => {
    onSortChange(key, colId, 'desc');
    setSortPickerFor(null);
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ width: 240, position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') dispatch({ type: 'SET_SEARCH_QUERY', query: searchInput }); }}
          placeholder="検索..."
          style={{ width: '100%', padding: '7px 30px 7px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
        />
        {searchInput && (
          <button
            onClick={() => { setSearchInput(''); dispatch({ type: 'SET_SEARCH_QUERY', query: '' }); }}
            style={{ position: 'absolute', right: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1, padding: 2 }}
          >×</button>
        )}
      </div>
      <button
        onClick={() => dispatch({ type: 'SET_SEARCH_QUERY', query: searchInput })}
        style={{ background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
      >
        検索
      </button>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', position: 'relative' }}>
        <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>ソート:</span>
        {(['chatCount', 'lastChatted'] as const).map(key => {
          const label = key === 'chatCount' ? '回数' : '最終日';
          const active = sortKey === key && !!sortColId;
          return (
            <div key={key} style={{ position: 'relative' }}>
              <button
                onClick={() => handleSortButtonClick(key)}
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  border: `1px solid ${active ? '#3b82f6' : '#d1d5db'}`,
                  borderRadius: 6,
                  background: active ? '#eff6ff' : '#fff',
                  color: active ? '#1d4ed8' : '#374151',
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 400,
                  whiteSpace: 'nowrap',
                }}
              >
                {label} {active ? (sortDir === 'desc' ? '↓' : '↑') : '▾'}
              </button>
              {/* 列選択ドロップダウン */}
              {sortPickerFor === key && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  zIndex: 100,
                  minWidth: 160,
                  overflow: 'hidden',
                }}>
                  <div style={{ padding: '6px 12px', fontSize: 11, color: '#9ca3af', borderBottom: '1px solid #f3f4f6' }}>列を選択</div>
                  {allColumns.map(col => (
                    <div
                      key={col.id}
                      onClick={() => handlePickCol(key, col.id)}
                      style={{
                        padding: '8px 12px',
                        fontSize: 13,
                        cursor: 'pointer',
                        color: '#374151',
                        background: sortColId === col.id && sortKey === key ? '#eff6ff' : '#fff',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={e => (e.currentTarget.style.background = sortColId === col.id && sortKey === key ? '#eff6ff' : '#fff')}
                    >
                      {col.name}
                    </div>
                  ))}
                  <div
                    onClick={() => setSortPickerFor(null)}
                    style={{ padding: '6px 12px', fontSize: 12, color: '#9ca3af', borderTop: '1px solid #f3f4f6', cursor: 'pointer', textAlign: 'center' }}
                  >
                    閉じる
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {sortKey !== 'none' && sortColId && (
          <button
            onClick={() => { onSortChange('none', '', 'desc'); setSortPickerFor(null); }}
            style={{ padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', color: '#9ca3af', cursor: 'pointer' }}
          >
            解除
          </button>
        )}
      </div>
    </div>
  );
}
