import React, { useState, useRef } from 'react';
import { useApp } from '../../store/ProjectContext';
import { Column } from '../../types';
import { Modal } from '../common/Modal';
import { loadCostLog, CostLogEntry } from '../../services/costLog';

export function ColumnNav({ onToggle }: { onToggle?: () => void }) {
  const { state, dispatch } = useApp();
  const [editingCol, setEditingCol] = useState<Column | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [showCosts, setShowCosts] = useState(false);
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [costEntries, setCostEntries] = useState<CostLogEntry[] | null>(null);
  const [costError, setCostError] = useState('');

  const handleOpenCosts = () => {
    setOpenDays(new Set());
    setCostEntries(null);
    setCostError('');
    setShowCosts(true);
    loadCostLog()
      .then(setCostEntries)
      .catch(e => { setCostEntries([]); setCostError(e instanceof Error ? e.message : String(e)); });
  };
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  if (!state.projectData) return null;

  const columns = [...state.projectData.columns].sort((a, b) => a.order - b.order);

  const handleAddColumn = () => {
    if (!newColName.trim()) return;
    const maxOrder = columns.length > 0 ? Math.max(...columns.map(c => c.order)) + 1 : 0;
    const col: Column = {
      id: 'col-' + Date.now(),
      name: newColName.trim(),
      description: newColDesc.trim(),
      order: maxOrder,
      visible: true,
    };
    dispatch({ type: 'ADD_COLUMN', column: col });
    // Create cells for existing rows
    for (const row of state.projectData!.rows) {
      dispatch({
        type: 'UPDATE_CELL',
        cell: { id: `${row.id}-${col.id}`, rowId: row.id, columnId: col.id, value: '', annotation: '' },
      });
    }
    setNewColName('');
    setNewColDesc('');
    setShowAdd(false);
  };

  const handleSaveEdit = () => {
    if (!editingCol) return;
    dispatch({ type: 'UPDATE_COLUMN', column: editingCol });
    setEditingCol(null);
  };

  const handleDelete = (colId: string) => {
    if (!confirm('この列を削除しますか？')) return;
    dispatch({ type: 'DELETE_COLUMN', columnId: colId });
  };

  const handleToggleVisible = (col: Column) => {
    dispatch({ type: 'UPDATE_COLUMN', column: { ...col, visible: !col.visible } });
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const reordered = [...columns];
    const [removed] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, removed);
    const updated = reordered.map((c, i) => ({ ...c, order: i }));
    dispatch({ type: 'REORDER_COLUMNS', columns: updated });
    dragItem.current = null;
    dragOverItem.current = null;
  };

  return (
    <div style={{ padding: 12, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#374151' }}>列一覧</h3>
        {onToggle && (
          <button
            onClick={onToggle}
            title="列一覧を隠す"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9ca3af', display: 'flex', alignItems: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1.5" y="1.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.4"/>
              <line x1="6" y1="1.5" x2="6" y2="16.5" stroke="currentColor" strokeWidth="1.4"/>
              <rect x="1.5" y="1.5" width="4.5" height="15" rx="1.5" fill="currentColor" opacity="0.25"/>
            </svg>
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {columns.map((col, idx) => (
          <div
            key={col.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragEnter={() => handleDragEnter(idx)}
            onDragEnd={handleDragEnd}
            onDragOver={e => e.preventDefault()}
            onClick={() => dispatch({ type: 'FOCUS_COLUMN', columnId: col.id })}
            style={{
              padding: '10px 10px',
              marginBottom: 4,
              background: state.focusedColumnId === col.id ? '#eff6ff' : '#f9fafb',
              borderRadius: 6,
              border: state.focusedColumnId === col.id ? '1px solid #3b82f6' : '1px solid #e5e7eb',
              cursor: 'grab',
              opacity: col.visible ? 1 : 0.5,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{col.name}</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button
                  onClick={() => setEditingCol({ ...col })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 2, color: '#3b82f6' }}
                >
                  編集
                </button>
                <button
                  onClick={() => handleDelete(col.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 2, color: '#ef4444' }}
                >
                  削除
                </button>
              </div>
            </div>
            {col.description && (
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, lineHeight: 1.4 }}>{col.description}</div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowAdd(true)}
        style={{
          flexShrink: 0,
          marginTop: 8,
          width: '100%',
          background: '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          padding: '6px 10px',
          fontSize: 12,
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        + 追加
      </button>

      <button
        onClick={handleOpenCosts}
        title="論文取り込みにかかったAPIコストを日別に表示"
        style={{
          flexShrink: 0,
          marginTop: 6,
          width: '100%',
          background: '#fff',
          color: '#374151',
          border: '1px solid #d1d5db',
          borderRadius: 4,
          padding: '6px 10px',
          fontSize: 12,
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        💰 コスト
      </button>

      {/* APIコストモーダル(日別 → PDF別) */}
      <Modal open={showCosts} onClose={() => setShowCosts(false)} title="APIコスト（論文取り込み）" maxWidth={640}>
        {(() => {
          if (!showCosts) return null;
          if (costEntries === null) {
            return <div style={{ fontSize: 13, color: '#9ca3af', padding: '12px 0' }}>読み込み中...</div>;
          }
          if (costError) {
            return <div style={{ fontSize: 13, color: '#ef4444', padding: '12px 0', lineHeight: 1.6 }}>{costError}</div>;
          }
          const entries = costEntries;
          const dayOf = (iso: string) => {
            const d = new Date(iso);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          };
          const byDay = new Map<string, CostLogEntry[]>();
          for (const e of entries) {
            const day = dayOf(e.date);
            if (!byDay.has(day)) byDay.set(day, []);
            byDay.get(day)!.push(e);
          }
          const days = [...byDay.keys()].sort().reverse();
          const totalUsd = entries.reduce((s, e) => s + e.costUsd, 0);
          const toggleDay = (day: string) => {
            setOpenDays(prev => {
              const next = new Set(prev);
              if (next.has(day)) next.delete(day);
              else next.add(day);
              return next;
            });
          };
          const fmt = (v: number) => `$${v.toFixed(2)}`;

          if (entries.length === 0) {
            return <div style={{ fontSize: 13, color: '#9ca3af', padding: '12px 0' }}>まだ記録がありません。論文PDFを取り込むと、かかったコストがここに記録されます。</div>;
          }
          return (
            <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                合計: {fmt(totalUsd)}（{entries.length}件）
              </div>
              {days.map(day => {
                const list = byDay.get(day)!;
                const daySum = list.reduce((s, e) => s + e.costUsd, 0);
                const open = openDays.has(day);
                return (
                  <div key={day} style={{ marginBottom: 6 }}>
                    <div
                      onClick={() => toggleDay(day)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 10px',
                        background: '#f3f4f6',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#374151',
                      }}
                    >
                      <span>{open ? '▾' : '▸'} {day}（{list.length}件）</span>
                      <span>{fmt(daySum)}</span>
                    </div>
                    {open && list.map(e => {
                      const d = new Date(e.date);
                      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                      const tokens = `入力${e.inputTokens.toLocaleString()} / 出力${e.outputTokens.toLocaleString()} / キャッシュ書込${e.cacheWriteTokens.toLocaleString()} / 読取${e.cacheReadTokens.toLocaleString()}トークン`;
                      return (
                        <div
                          key={e.id}
                          title={tokens}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: '6px 10px 6px 24px',
                            fontSize: 12,
                            color: '#4b5563',
                            borderBottom: '1px solid #f3f4f6',
                          }}
                        >
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {time} {e.title}
                          </span>
                          <span style={{ flexShrink: 0, fontWeight: 600 }}>{fmt(e.costUsd)}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
                ※ 実測トークン数にClaude Sonnet 5の単価を掛けた金額です。全環境（ローカル/本番）の取り込みが共通で記録されます。
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="列を追加">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            value={newColName}
            onChange={e => setNewColName(e.target.value)}
            placeholder="列名"
            autoFocus
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
          />
          <textarea
            value={newColDesc}
            onChange={e => setNewColDesc(e.target.value)}
            placeholder="列の説明（AIプロンプトに使用されます）"
            rows={3}
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAdd(false)} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
              キャンセル
            </button>
            <button onClick={handleAddColumn} disabled={!newColName.trim()} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: newColName.trim() ? '#3b82f6' : '#9ca3af', color: '#fff', cursor: newColName.trim() ? 'pointer' : 'default', fontWeight: 600 }}>
              追加
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editingCol} onClose={() => setEditingCol(null)} title="列を編集">
        {editingCol && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              value={editingCol.name}
              onChange={e => setEditingCol({ ...editingCol, name: e.target.value })}
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
            />
            <textarea
              value={editingCol.description}
              onChange={e => setEditingCol({ ...editingCol, description: e.target.value })}
              placeholder="列の説明"
              rows={3}
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingCol(null)} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
                キャンセル
              </button>
              <button onClick={handleSaveEdit} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                保存
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
