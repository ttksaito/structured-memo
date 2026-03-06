import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from './store/ProjectContext';
import { ProjectList } from './components/Home/ProjectList';
import { ColumnNav } from './components/ColumnNav/ColumnNav';
import { DataTable } from './components/DataTable/DataTable';
import { CellChat } from './components/CellChat/CellChat';

export default function App() {
  const { state, dispatch } = useApp();

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(220);
  const [rightWidth, setRightWidth] = useState(340);
  const [memoText, setMemoText] = useState('');
  const memoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentProject = state.projects.find(p => p.id === state.currentProjectId);

  // 選択中セルの行を特定
  const selectedCell = state.projectData?.cells.find(c => c.id === state.selectedCellId);
  const selectedRow = state.projectData?.rows.find(r => r.id === selectedCell?.rowId) ?? null;

  const draggingLeft = useRef(false);
  const draggingRight = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const onLeftDragStart = useCallback((e: React.MouseEvent) => {
    draggingLeft.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = leftWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!draggingLeft.current) return;
      const delta = ev.clientX - dragStartX.current;
      setLeftWidth(Math.max(140, Math.min(400, dragStartWidth.current + delta)));
    };
    const onUp = () => {
      draggingLeft.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [leftWidth]);

  const onRightDragStart = useCallback((e: React.MouseEvent) => {
    draggingRight.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = rightWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!draggingRight.current) return;
      const delta = dragStartX.current - ev.clientX;
      setRightWidth(Math.max(240, Math.min(600, dragStartWidth.current + delta)));
    };
    const onUp = () => {
      draggingRight.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [rightWidth]);

  // 選択行が変わったらそのメモをロード
  useEffect(() => {
    setMemoText(selectedRow?.memo ?? '');
  }, [selectedRow?.id]);

  const handleMemoChange = (value: string) => {
    setMemoText(value);
    if (memoSaveTimer.current) clearTimeout(memoSaveTimer.current);
    memoSaveTimer.current = setTimeout(() => {
      if (selectedRow) {
        dispatch({ type: 'UPDATE_ROW_MEMO', rowId: selectedRow.id, memo: value });
      }
    }, 500);
  };

  if (state.view === 'home') {
    return <ProjectList />;
  }

  const project = currentProject;

  const resizeHandleStyle: React.CSSProperties = {
    width: 5,
    cursor: 'col-resize',
    background: 'transparent',
    flexShrink: 0,
    position: 'relative',
    zIndex: 10,
  };

  const toggleBtnStyle: React.CSSProperties = {
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    padding: '2px 6px',
    color: '#374151',
    fontWeight: 600,
    lineHeight: 1,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top bar */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          borderBottom: '1px solid #e5e7eb',
          background: '#fff',
        }}
      >
        <button
          onClick={() => dispatch({ type: 'CLOSE_PROJECT' })}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            color: '#6b7280',
            padding: '4px 8px',
          }}
        >
          &larr; 戻る
        </button>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1f2937', flex: 1 }}>
          {project?.name || 'プロジェクト'}
        </h2>
        <button style={toggleBtnStyle} onClick={() => setLeftOpen(v => !v)}>
          {leftOpen ? '◀ 列一覧' : '▶ 列一覧'}
        </button>
        <button style={toggleBtnStyle} onClick={() => setRightOpen(v => !v)}>
          {rightOpen ? 'チャット ▶' : 'チャット ◀'}
        </button>
      </div>

      {/* 3-column layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Column Nav */}
        {leftOpen && (
          <>
            <div
              style={{
                width: leftWidth,
                minWidth: 140,
                borderRight: '1px solid #e5e7eb',
                background: '#fafafa',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <ColumnNav />
            </div>
            {/* Left resize handle */}
            <div
              style={{ ...resizeHandleStyle, borderRight: '1px solid #e5e7eb' }}
              onMouseDown={onLeftDragStart}
              title="ドラッグでサイズ変更"
            />
          </>
        )}

        {/* Center: Table + Memo */}
        <div style={{ flex: 1, overflow: 'hidden', background: '#fff', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 4, overflow: 'hidden', minHeight: 0 }}>
            <DataTable />
          </div>
          {/* Memo panel */}
          <div style={{
            flex: 1,
            minHeight: 0,
            borderTop: '2px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            background: '#fafafa',
          }}>
            <div style={{
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: '#6b7280',
              background: '#f3f4f6',
              borderBottom: '1px solid #e5e7eb',
              flexShrink: 0,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}>
              <span>メモ</span>
              {selectedRow && (
                <span style={{ color: '#374151', fontWeight: 500 }}>{selectedRow.name}</span>
              )}
            </div>
            <textarea
              value={memoText}
              onChange={e => handleMemoChange(e.target.value)}
              placeholder={selectedRow ? `${selectedRow.name} のメモ...` : '行を選択するとメモを入力できます'}
              disabled={!selectedRow}
              style={{
                flex: 1,
                width: '100%',
                border: 'none',
                outline: 'none',
                resize: 'none',
                padding: '8px 12px',
                fontSize: 13,
                fontFamily: 'inherit',
                background: '#fafafa',
                color: '#1f2937',
                lineHeight: 1.6,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Right resize handle */}
        {rightOpen && (
          <>
            <div
              style={{ ...resizeHandleStyle, borderLeft: '1px solid #e5e7eb' }}
              onMouseDown={onRightDragStart}
              title="ドラッグでサイズ変更"
            />
            {/* Right: Cell Chat */}
            <div
              style={{
                width: rightWidth,
                minWidth: 240,
                borderLeft: '1px solid #e5e7eb',
                background: '#fafafa',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <CellChat />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
