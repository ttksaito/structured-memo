import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../store/ProjectContext';
import { calcAttentionScore, scoreToColor } from '../../utils/interest';
import { Row } from '../../types';
import { Modal } from '../common/Modal';

export function DataTable() {
  const { state, dispatch } = useApp();
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRowValues, setNewRowValues] = useState<Record<string, string>>({});
  const [searchInput, setSearchInput] = useState(state.searchQuery);
  type SortKey = 'none' | 'chatCount' | 'lastChatted';
  type SortDir = 'desc' | 'asc';
  const [sortKey, setSortKey] = useState<SortKey>('none');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [sortColId, setSortColId] = useState<string>('');
  const [sortPickerFor, setSortPickerFor] = useState<SortKey | null>(null);

  const handleSortButtonClick = (key: SortKey) => {
    if (sortKey === key && sortColId) {
      // 同じキーを再クリック → 方向トグル
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      // 列選択ピッカーを開く
      setSortPickerFor(key);
    }
  };

  const handlePickCol = (key: SortKey, colId: string) => {
    setSortKey(key);
    setSortColId(colId);
    setSortDir('desc');
    setSortPickerFor(null);
  };

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef<Record<string, HTMLTableCellElement | null>>({});

  // ドロップダウンを外側クリックで閉じる
  useEffect(() => {
    if (!sortPickerFor) return;
    const handler = () => setSortPickerFor(null);
    setTimeout(() => window.addEventListener('click', handler), 0);
    return () => window.removeEventListener('click', handler);
  }, [sortPickerFor]);

  // 列選択時にスクロール
  useEffect(() => {
    if (!state.focusedColumnId) return;
    const th = colRefs.current[state.focusedColumnId];
    if (th && tableScrollRef.current) {
      const container = tableScrollRef.current;
      const left = th.offsetLeft;
      const width = th.offsetWidth;
      const containerWidth = container.clientWidth;
      const scrollLeft = left - containerWidth / 2 + width / 2;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  }, [state.focusedColumnId]);

  if (!state.projectData) return null;

  const columns = [...state.projectData.columns]
    .filter(c => c.visible)
    .sort((a, b) => a.order - b.order);
  const rows = [...state.projectData.rows].sort((a, b) => a.order - b.order);

  const filteredRows = (() => {
    const base = state.searchQuery
      ? rows.filter(row => {
          if (row.name.toLowerCase().includes(state.searchQuery.toLowerCase())) return true;
          return state.projectData!.cells
            .filter(c => c.rowId === row.id)
            .some(c => c.value.toLowerCase().includes(state.searchQuery.toLowerCase()));
        })
      : rows;

    if (sortKey === 'none' || !sortColId) return base;

    const getCellStat = (row: Row) => {
      const cell = state.projectData!.cells.find(c => c.rowId === row.id && c.columnId === sortColId);
      if (!cell) return { count: 0, lastDate: 0 };
      const interest = state.projectData!.interests.find(i => i.cellId === cell.id);
      return {
        count: interest?.chatCount ?? 0,
        lastDate: interest?.lastChattedAt ? new Date(interest.lastChattedAt).getTime() : 0,
      };
    };

    return [...base].sort((a, b) => {
      const sa = getCellStat(a);
      const sb = getCellStat(b);
      const val = sortKey === 'chatCount'
        ? sa.count - sb.count
        : sa.lastDate - sb.lastDate;
      return sortDir === 'desc' ? -val : val;
    });
  })();

  const getCell = (rowId: string, colId: string) =>
    state.projectData!.cells.find(c => c.rowId === rowId && c.columnId === colId);

  const getInterest = (cellId: string) =>
    state.projectData!.interests.find(i => i.cellId === cellId);

  const handleCellClick = (cellId: string) => {
    dispatch({ type: 'SELECT_CELL', cellId });
  };

  const handleCellDoubleClick = (cellId: string, value: string) => {
    setEditingCellId(cellId);
    setEditValue(value);
  };

  const handleCellSave = () => {
    if (!editingCellId) return;
    const cell = state.projectData!.cells.find(c => c.id === editingCellId);
    if (cell) {
      dispatch({ type: 'UPDATE_CELL', cell: { ...cell, value: editValue } });
    }
    setEditingCellId(null);
  };

  const allColumns = [...state.projectData.columns].sort((a, b) => a.order - b.order);

  const handleOpenAddRow = () => {
    const init: Record<string, string> = {};
    allColumns.forEach(c => { init[c.id] = ''; });
    setNewRowValues(init);
    setShowAddRow(true);
  };

  const handleAddRow = () => {
    const nameCol = allColumns.find(c => c.id === 'col-name');
    const rowName = nameCol ? (newRowValues['col-name'] || '').trim() : Object.values(newRowValues)[0]?.trim() || '';
    if (!rowName) return;
    const maxOrder = rows.length > 0 ? Math.max(...rows.map(r => r.order)) + 1 : 0;
    const rowId = 'row-' + Date.now();
    const row: Row = { id: rowId, name: rowName, order: maxOrder };
    const cells = allColumns.map(col => ({
      id: `${rowId}-${col.id}`,
      rowId,
      columnId: col.id,
      value: newRowValues[col.id] || '',
      annotation: '',
    }));
    dispatch({ type: 'ADD_ROW', row, cells });
    setNewRowValues({});
    setShowAddRow(false);
  };

  const handleDeleteRow = (rowId: string, rowName: string) => {
    if (!confirm(`「${rowName}」を削除しますか？`)) return;
    dispatch({ type: 'DELETE_ROW', rowId });
  };

  return (
    <div style={{ padding: 12, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') dispatch({ type: 'SET_SEARCH_QUERY', query: searchInput }); }}
          placeholder="検索..."
          style={{ flex: 1, minWidth: 120, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
        />
        <button
          onClick={() => dispatch({ type: 'SET_SEARCH_QUERY', query: searchInput })}
          style={{ background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
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
                    left: 0,
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
              onClick={() => { setSortKey('none'); setSortColId(''); setSortPickerFor(null); }}
              style={{ padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', color: '#9ca3af', cursor: 'pointer' }}
            >
              解除
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
      <div ref={tableScrollRef} style={{ width: '100%', height: '100%', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.id}
                  ref={el => { colRefs.current[col.id] = el; }}
                  style={{
                    padding: '8px 10px',
                    background: state.focusedColumnId === col.id ? '#dbeafe' : '#f3f4f6',
                    borderBottom: '2px solid #e5e7eb',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: state.focusedColumnId === col.id ? '#1d4ed8' : '#374151',
                    position: 'sticky',
                    top: 0,
                    whiteSpace: 'nowrap',
                    minWidth: col.id === 'col-name' ? 160 : 200,
                  }}
                >
                  {col.name}
                  {sortColId === col.id && sortKey !== 'none' && (
                    <span style={{ marginLeft: 4, fontSize: 11, color: '#3b82f6', fontWeight: 700 }}>
                      {sortKey === 'chatCount' ? '回数' : '最終日'}{sortDir === 'desc' ? '↓' : '↑'}
                    </span>
                  )}
                </th>
              ))}
              <th style={{ padding: '8px 10px', background: '#f3f4f6', borderBottom: '2px solid #e5e7eb', position: 'sticky', top: 0, width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => (
              <tr key={row.id}>
                {columns.map(col => {
                  const cell = getCell(row.id, col.id);
                  const cellId = cell?.id || `${row.id}-${col.id}`;
                  const interest = getInterest(cellId);
                  const score = calcAttentionScore(interest);
                  const isSelected = state.selectedCellId === cellId;
                  const isEditing = editingCellId === cellId;

                  return (
                    <td
                      key={col.id}
                      onClick={() => handleCellClick(cellId)}
                      onDoubleClick={() => handleCellDoubleClick(cellId, cell?.value || '')}
                      style={{
                        padding: '8px 10px',
                        borderBottom: '1px solid #e5e7eb',
                        background: isSelected ? '#dbeafe' : '#fff',
                        cursor: 'pointer',
                        maxWidth: 300,
                        verticalAlign: 'top',
                        outline: isSelected ? '2px solid #3b82f6' : 'none',
                        outlineOffset: -2,
                        position: 'relative',
                      }}
                    >
                      {isEditing ? (
                        <textarea
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={e => { if (e.key === 'Escape') setEditingCellId(null); if (e.key === 'Enter' && e.ctrlKey) handleCellSave(); }}
                          autoFocus
                          style={{
                            width: '100%',
                            minHeight: 60,
                            border: '1px solid #3b82f6',
                            borderRadius: 4,
                            padding: 4,
                            fontSize: 13,
                            resize: 'vertical',
                            fontFamily: 'inherit',
                          }}
                        />
                      ) : (
                        <>
                          <div style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            lineHeight: 1.5,
                            fontSize: 13,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}>
                            {cell?.value || ''}
                          </div>
                          {(interest?.chatCount ?? 0) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
                              <span>チャット数={interest!.chatCount}</span>
                              {interest!.lastChattedAt && (() => {
                                const d = new Date(interest!.lastChattedAt);
                                return (
                                  <span>{`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}/${d.toLocaleDateString('en-US', { weekday: 'short' })}`}</span>
                                );
                              })()}
                            </div>
                          )}
                        </>
                      )}
                      {interest?.star && (
                        <span style={{ position: 'absolute', top: 2, right: 4, fontSize: 10 }}>&#9733;</span>
                      )}
                    </td>
                  );
                })}
                <td style={{ padding: '8px 4px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                  <button
                    onClick={() => handleDeleteRow(row.id, row.name)}
                    title="行を削除"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: 2 }}
                  >
                    &times;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            {state.searchQuery ? '検索結果がありません' : 'データがありません。＋ボタンで行を追加してください。'}
          </div>
        )}
      </div>
      {/* フローティング行追加ボタン */}
      <button
        onClick={handleOpenAddRow}
        title="行を追加"
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: '#10b981',
          color: '#fff',
          border: 'none',
          fontSize: 28,
          lineHeight: 1,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        ＋
      </button>
      </div>

      {/* 行追加モーダル */}
      <Modal open={showAddRow} onClose={() => setShowAddRow(false)} title="行を追加">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
          {allColumns.map((col, idx) => {
            const isName = col.id === 'col-name';
            return (
              <div key={col.id}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  {col.name}{isName && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
                </label>
                {isName ? (
                  <input
                    value={newRowValues[col.id] || ''}
                    onChange={e => setNewRowValues(v => ({ ...v, [col.id]: e.target.value }))}
                    placeholder={col.name + 'を入力'}
                    autoFocus={idx === 0}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                  />
                ) : (
                  <textarea
                    value={newRowValues[col.id] || ''}
                    onChange={e => setNewRowValues(v => ({ ...v, [col.id]: e.target.value }))}
                    placeholder={col.name + 'を入力'}
                    rows={3}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                )}
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button
              onClick={() => setShowAddRow(false)}
              style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
            >
              キャンセル
            </button>
            <button
              onClick={handleAddRow}
              disabled={!(newRowValues['col-name'] || Object.values(newRowValues)[0] || '').trim()}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 6,
                background: (newRowValues['col-name'] || Object.values(newRowValues)[0] || '').trim() ? '#10b981' : '#9ca3af',
                color: '#fff',
                cursor: (newRowValues['col-name'] || Object.values(newRowValues)[0] || '').trim() ? 'pointer' : 'default',
                fontWeight: 600,
              }}
            >
              追加
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
