import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from './store/ProjectContext';
import { ProjectList } from './components/Home/ProjectList';
import { ColumnNav } from './components/ColumnNav/ColumnNav';
import { DataTable } from './components/DataTable/DataTable';
import { TableToolbar, SortKey, SortDir } from './components/DataTable/TableToolbar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// ソース上で直前のブロックとの間に空白行があるブロックにだけ余白用クラスを付ける
// (HTML構造上は空白行の有無が消えるため、パース時の行番号で判定する)
function remarkBlankLineSpacing() {
  type BlockNode = {
    position?: { start: { line: number }; end: { line: number } };
    data?: { hProperties?: { className?: string } };
  };
  return (tree: { children: BlockNode[] }) => {
    for (let i = 1; i < tree.children.length; i++) {
      const prev = tree.children[i - 1];
      const cur = tree.children[i];
      if (prev.position && cur.position && cur.position.start.line - prev.position.end.line >= 2) {
        const data = (cur.data ??= {});
        const hProps = (data.hProperties ??= {});
        hProps.className = 'md-spaced';
      }
    }
  };
}

// パネルの開閉・サイズをlocalStorageに保存し、次回起動時に復元する
function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

export default function App() {
  const { state, dispatch } = useApp();

  const [leftOpen, setLeftOpen] = usePersistentState('structured-memo-ui-left-open', true);
  const [rightOpen, setRightOpen] = usePersistentState('structured-memo-ui-right-open', true);
  const [leftWidth, setLeftWidth] = usePersistentState('structured-memo-ui-left-width', 220);
  const [rightWidth, setRightWidth] = usePersistentState('structured-memo-ui-right-width', 340);
  const [sortKey, setSortKey] = useState<SortKey>('none');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [sortColId, setSortColId] = useState('');
  const [memoText, setMemoText] = useState('');
  const [memoPreview, setMemoPreview] = usePersistentState('structured-memo-ui-memo-preview', false);
  const memoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentProject = state.projects.find(p => p.id === state.currentProjectId);

  // 選択中セルの行・列を特定
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
        <TableToolbar
          sortKey={sortKey}
          sortDir={sortDir}
          sortColId={sortColId}
          onSortChange={(key, colId, dir) => { setSortKey(key); setSortColId(colId); setSortDir(dir); }}
        />
      </div>

      {/* 3-column layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Column Nav */}
        {leftOpen ? (
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
              <ColumnNav onToggle={() => setLeftOpen(false)} />
            </div>
            {/* Left resize handle */}
            <div
              style={{ ...resizeHandleStyle, borderRight: '1px solid #e5e7eb' }}
              onMouseDown={onLeftDragStart}
              title="ドラッグでサイズ変更"
            />
          </>
        ) : (
          <div
            style={{
              width: 28,
              borderRight: '1px solid #e5e7eb',
              background: '#fafafa',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 10,
            }}
          >
            <button
              onClick={() => setLeftOpen(true)}
              title="列一覧を表示"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9ca3af', display: 'flex' }}
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1.5" y="1.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                <line x1="6" y1="1.5" x2="6" y2="16.5" stroke="currentColor" strokeWidth="1.4"/>
              </svg>
            </button>
          </div>
        )}

        {/* Center: Table */}
        <div style={{ flex: 1, overflow: 'hidden', background: '#fff', minWidth: 0 }}>
          <DataTable sortKey={sortKey} sortDir={sortDir} sortColId={sortColId} />
        </div>

        {/* Right: Memo */}
        {rightOpen ? (
          <>
            <div
              style={{ ...resizeHandleStyle, borderLeft: '1px solid #e5e7eb' }}
              onMouseDown={onRightDragStart}
              title="ドラッグでサイズ変更"
            />
            <div
              style={{
                width: rightWidth,
                minWidth: 240,
                borderLeft: '1px solid #e5e7eb',
                background: '#fafafa',
                overflow: 'hidden',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{
                padding: '4px 8px 4px 12px',
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
                  <span style={{ color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedRow.name}</span>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, flexShrink: 0 }}>
                  {(['edit', 'preview'] as const).map(mode => {
                    const active = memoPreview === (mode === 'preview');
                    return (
                      <button
                        key={mode}
                        onClick={() => setMemoPreview(mode === 'preview')}
                        style={{
                          background: active ? '#e5e7eb' : 'none',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          color: active ? '#374151' : '#9ca3af',
                          padding: '2px 8px',
                          fontSize: 11,
                          fontWeight: active ? 600 : 400,
                          lineHeight: 1.4,
                        }}
                      >
                        {mode === 'edit' ? '編集' : 'プレビュー'}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setRightOpen(false)}
                  title="メモを閉じる"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    padding: '2px 4px',
                    fontSize: 12,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  ▶
                </button>
              </div>
              {memoPreview ? (
                <div
                  className="markdown-body"
                  style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: '8px 12px',
                    fontSize: 13,
                    background: '#fafafa',
                    color: '#1f2937',
                    lineHeight: 1.6,
                    minHeight: 0,
                  }}
                >
                  {memoText.trim() ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks, remarkMath, remarkBlankLineSpacing]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        // 改行1回(<br>)の行送りを折り返しより4px広げる
                        br: () => <span style={{ display: 'block', height: 4 }} />,
                      }}
                    >
                      {memoText}
                    </ReactMarkdown>
                  ) : (
                    <span style={{ color: '#9ca3af' }}>
                      {selectedRow ? 'メモがありません' : '行を選択するとメモを表示できます'}
                    </span>
                  )}
                </div>
              ) : (
                <textarea
                  value={memoText}
                  onChange={e => handleMemoChange(e.target.value)}
                  spellCheck={false}
                  placeholder={selectedRow ? 'メモを入力...' : '行を選択するとメモを入力できます'}
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
                    lineHeight: 1.9,
                    boxSizing: 'border-box',
                    minHeight: 0,
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <div
            style={{
              width: 28,
              borderLeft: '1px solid #e5e7eb',
              background: '#fafafa',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 10,
            }}
          >
            <button
              onClick={() => setRightOpen(true)}
              title="メモを表示"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9ca3af', display: 'flex' }}
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1.5" y="1.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                <line x1="12" y1="1.5" x2="12" y2="16.5" stroke="currentColor" strokeWidth="1.4"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
