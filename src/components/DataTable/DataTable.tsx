import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../store/ProjectContext';
import { calcAttentionScore, scoreToColor } from '../../utils/interest';
import { Row, Column, Cell } from '../../types';
import { Modal } from '../common/Modal';
import { extractPaperInfo, PAPER_META_COLUMN, PAPER_SECTION_COLUMNS } from '../../services/paperExtract';
import { uploadPaperPdf } from '../../services/paperStorage';
import { SortKey, SortDir } from './TableToolbar';

const isUrl = (v: string) => /^https?:\/\/\S+$/.test(v);

interface DataTableProps {
  sortKey: SortKey;
  sortDir: SortDir;
  sortColId: string;
}

export function DataTable({ sortKey, sortDir, sortColId }: DataTableProps) {
  const { state, dispatch } = useApp();
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [rowDetailRow, setRowDetailRow] = useState<Row | null>(null);
  const [colDetailCol, setColDetailCol] = useState<Column | null>(null);
  const [paperPhase, setPaperPhase] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // 列幅(ドラッグで調整、プロジェクトごとにlocalStorageへ保存)
  const colWidthsKey = `structured-memo-ui-col-widths-${state.currentProjectId}`;
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(colWidthsKey) || '{}');
    } catch {
      return {};
    }
  });
  useEffect(() => {
    localStorage.setItem(colWidthsKey, JSON.stringify(colWidths));
  }, [colWidthsKey, colWidths]);
  const colWidth = (col: Column) => colWidths[col.id] ?? (col.id === 'col-name' ? 160 : 200);
  const resizingCol = useRef<{ id: string; startX: number; startW: number } | null>(null);

  const handleColResizeStart = (e: React.MouseEvent, colId: string, startW: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = { id: colId, startX: e.clientX, startW };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      const r = resizingCol.current;
      if (!r) return;
      const w = Math.max(80, Math.min(800, r.startW + ev.clientX - r.startX));
      setColWidths(prev => ({ ...prev, [r.id]: w }));
    };
    const onUp = () => {
      resizingCol.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const dragRowId = useRef<string | null>(null);
  const dragOverRowId = useRef<string | null>(null);
  // 行ドラッグ中の表示用状態(ドラッグ元の半透明化と挿入位置のライン表示)
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [dragOverRow, setDragOverRow] = useState<string | null>(null);

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
  // 行番号は全体での並び順に基づく固定番号(検索・ソートで変わらない)
  const rowNumberById = new Map(rows.map((r, i) => [r.id, i + 1]));

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

  const handleRowDragStart = (rowId: string) => {
    dragRowId.current = rowId;
    setDraggingRowId(rowId);
  };

  const handleRowDragEnter = (rowId: string) => {
    dragOverRowId.current = rowId;
    setDragOverRow(rowId);
  };

  const handleRowDragEnd = () => {
    const fromId = dragRowId.current;
    const toId = dragOverRowId.current;
    dragRowId.current = null;
    dragOverRowId.current = null;
    setDraggingRowId(null);
    setDragOverRow(null);
    if (!fromId || !toId || fromId === toId) return;

    const full = [...state.projectData!.rows].sort((a, b) => a.order - b.order);
    const fromIdx = full.findIndex(r => r.id === fromId);
    const toIdx = full.findIndex(r => r.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...full];
    const [removed] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, removed);
    const updated = reordered.map((r, i) => ({ ...r, order: i }));
    dispatch({ type: 'REORDER_ROWS', rows: updated });
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

  const handleDeleteRow = (rowId: string, rowName: string) => {
    if (!confirm(`「${rowName}」を削除しますか？`)) return;
    dispatch({ type: 'DELETE_ROW', rowId });
  };

  // 行の論文PDFのURL(行に保存されたURLを優先、旧データ用にURL形式のセルへフォールバック)
  const rowPdfUrl = (row: Row): string => {
    const fromRow = (row.pdfUrl || '').trim();
    if (fromRow) return fromRow;
    const c = state.projectData!.cells.find(c => c.rowId === row.id && isUrl(c.value));
    return c ? c.value.trim() : '';
  };

  // ── 論文PDF取り込み ──────────────────────────────
  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.slice(result.indexOf(',') + 1)); // data:...;base64, を除去
      };
      reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
      reader.readAsDataURL(file);
    });

  const handlePaperPdf = async (file: File) => {
    if (file.size > 32 * 1024 * 1024) {
      alert('PDFが32MBを超えています。Claude APIの上限(32MB・100ページ)以下のファイルを選択してください。');
      return;
    }
    if (!state.apiKey) {
      alert('Anthropic APIキーが設定されていません(.env.local の VITE_ANTHROPIC_API_KEY)。');
      return;
    }
    const projectId = state.currentProjectId!;

    try {
      // 1. PDFをSupabase Storageへ保存
      setPaperPhase(`「${file.name}」をアップロード中...`);
      let pdfUrl = '';
      let uploadError = '';
      try {
        pdfUrl = await uploadPaperPdf(file, projectId);
      } catch (e) {
        uploadError = e instanceof Error ? e.message : String(e);
      }

      // 2. 不足している列を自動作成(この列構成に応じて抽出プロンプトの数が決まる)
      // PDFのURLは行(row.pdfUrl)に保存するため、PDF列は自動作成しない(既存のPDF列があれば埋める)
      const paperColumnNames = [PAPER_META_COLUMN, ...PAPER_SECTION_COLUMNS];
      const allCols = [...state.projectData!.columns];
      let nextOrder = allCols.length > 0 ? Math.max(...allCols.map(c => c.order)) + 1 : 0;
      paperColumnNames.forEach((name, i) => {
        if (!allCols.some(c => c.name === name)) {
          const column: Column = { id: `col-${Date.now()}-${i}`, name, description: '', order: nextOrder++, visible: true };
          allCols.push(column);
          dispatch({ type: 'ADD_COLUMN', column });
        }
      });

      // 3. 列ごとに1プロンプトずつ順番にClaudeへ投げて抽出
      const nonSectionNames = new Set([PAPER_META_COLUMN, '著者', '日付', 'PDF']);
      const sectionTargets = allCols
        .filter(c => c.id !== 'col-name' && !nonSectionNames.has(c.name))
        .sort((a, b) => a.order - b.order)
        .map(c => ({ name: c.name, description: c.description }));
      const base64 = await readFileAsBase64(file);
      const info = await extractPaperInfo(state.apiKey, base64, sectionTargets, setPaperPhase);

      // 4. 行を作成し、列名の一致で各セルに保存
      setPaperPhase('結果を保存中...');
      const valueForColumn = (col: Column): string => {
        if (col.id === 'col-name') return info.title;
        if (col.name === PAPER_META_COLUMN) return info.metaText;
        if (col.name === '著者') return info.authors;
        if (col.name === '日付') return info.date;
        if (col.name === 'PDF') return pdfUrl;
        return info.sections[col.name] ?? '';
      };
      const maxOrder = state.projectData!.rows.length > 0 ? Math.max(...state.projectData!.rows.map(r => r.order)) + 1 : 0;
      const rowId = 'row-' + Date.now();
      const row: Row = { id: rowId, name: info.title, order: maxOrder, memo: '', pdfUrl };
      const cells: Cell[] = allCols.map(col => ({
        id: `${rowId}-${col.id}`,
        rowId,
        columnId: col.id,
        value: valueForColumn(col),
        annotation: '',
      }));
      dispatch({ type: 'ADD_ROW', row, cells });

      setPaperPhase(null);
      if (uploadError) {
        alert(`抽出結果は保存しましたが、PDF本体の保存に失敗しました。\n${uploadError}`);
      }
    } catch (e) {
      setPaperPhase(null);
      alert(`論文の取り込みに失敗しました。\n${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div style={{ padding: 12, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 論文PDF選択用の非表示input(右下の＋ボタンから開く) */}
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) handlePaperPdf(file);
        }}
      />

      {/* 論文取り込み中オーバーレイ */}
      {paperPhase && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px 36px', maxWidth: 420, textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 6 }}>論文を取り込んでいます</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>{paperPhase}</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
      <div ref={tableScrollRef} style={{ width: '100%', height: '100%', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
          <thead>
            <tr>
              <th
                title="ドラッグで行を並び替え / クリックで行の全項目を表示"
                style={{
                  padding: '8px 6px',
                  background: '#f3f4f6',
                  borderBottom: '2px solid #e5e7eb',
                  borderRight: '1px solid #e5e7eb',
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#374151',
                  position: 'sticky',
                  top: 0,
                  left: 0,
                  zIndex: 3,
                  width: 44,
                }}
              >
                No.
              </th>
              {columns.map(col => (
                <th
                  key={col.id}
                  ref={el => { colRefs.current[col.id] = el; }}
                  onClick={() => setColDetailCol(col)}
                  title="クリックで列の全行を一覧表示"
                  style={{
                    padding: '8px 10px',
                    background: state.focusedColumnId === col.id ? '#dbeafe' : '#f3f4f6',
                    borderBottom: '2px solid #e5e7eb',
                    borderRight: '1px solid #e5e7eb',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: state.focusedColumnId === col.id ? '#1d4ed8' : '#374151',
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                    whiteSpace: 'nowrap',
                    width: colWidth(col),
                    minWidth: colWidth(col),
                    maxWidth: colWidth(col),
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    cursor: 'pointer',
                  }}
                >
                  {col.name}
                  {sortColId === col.id && sortKey !== 'none' && (
                    <span style={{ marginLeft: 4, fontSize: 11, color: '#3b82f6', fontWeight: 700 }}>
                      {sortKey === 'chatCount' ? '回数' : '最終日'}{sortDir === 'desc' ? '↓' : '↑'}
                    </span>
                  )}
                  {/* 列幅リサイズハンドル */}
                  <span
                    onMouseDown={e => handleColResizeStart(e, col.id, colWidth(col))}
                    onClick={e => e.stopPropagation()}
                    title="ドラッグで列幅を変更"
                    style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 6, cursor: 'col-resize' }}
                  />
                </th>
              ))}
              <th style={{ padding: '8px 10px', background: '#f3f4f6', borderBottom: '2px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 2, width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => {
              // ドラッグ中: 挿入位置を示すライン(上から来たら下辺、下から来たら上辺)
              const draggingRow = draggingRowId ? state.projectData!.rows.find(r => r.id === draggingRowId) : null;
              const isDragSource = draggingRowId === row.id;
              const dropPos = dragOverRow === row.id && draggingRow && !isDragSource
                ? (draggingRow.order < row.order ? 'below' : 'above')
                : null;
              const dropShadow = dropPos === 'above'
                ? 'inset 0 3px 0 #3b82f6'
                : dropPos === 'below'
                  ? 'inset 0 -3px 0 #3b82f6'
                  : undefined;

              return (
              <tr
                key={row.id}
                onDragEnter={() => draggingRowId && handleRowDragEnter(row.id)}
                onDragOver={e => e.preventDefault()}
                style={{ opacity: isDragSource ? 0.45 : 1 }}
              >
                <td
                  draggable
                  onDragStart={() => handleRowDragStart(row.id)}
                  onDragEnd={handleRowDragEnd}
                  onClick={() => setRowDetailRow(row)}
                  title="ドラッグで行を並び替え / クリックで行の全項目を表示"
                  style={{
                    padding: '8px 6px',
                    borderBottom: '1px solid #e5e7eb',
                    background: dropPos ? '#dbeafe' : '#f9fafb',
                    textAlign: 'center',
                    fontSize: 12,
                    color: '#6b7280',
                    cursor: 'grab',
                    userSelect: 'none',
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    boxShadow: dropShadow,
                  }}
                >
                  {rowNumberById.get(row.id)}
                </td>
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
                        maxWidth: colWidth(col),
                        boxShadow: dropShadow,
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
                            {cell?.value && isUrl(cell.value) ? (
                              <button
                                onClick={e => { e.stopPropagation(); setPdfPreviewUrl(cell.value); }}
                                style={{ background: 'none', border: 'none', padding: 0, color: '#2563eb', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}
                              >
                                📄 PDFを開く
                              </button>
                            ) : (
                              cell?.value || ''
                            )}
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
                <td style={{ padding: '8px 4px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', boxShadow: dropShadow }}>
                  <button
                    onClick={() => handleDeleteRow(row.id, row.name)}
                    title="行を削除"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: 2 }}
                  >
                    &times;
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {filteredRows.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            {state.searchQuery ? '検索結果がありません' : 'データがありません。＋ボタンで行を追加してください。'}
          </div>
        )}
      </div>
      {/* フローティング論文PDF追加ボタン */}
      <button
        onClick={() => pdfInputRef.current?.click()}
        disabled={!!paperPhase}
        title="論文PDFをアップロードすると、AIが著者・日付・タイトル・概要などを抽出して行を自動作成します"
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: paperPhase ? '#9ca3af' : '#10b981',
          color: '#fff',
          border: 'none',
          fontSize: 28,
          lineHeight: 1,
          cursor: paperPhase ? 'default' : 'pointer',
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

      {/* 行内容一覧モーダル（読み取り専用） */}
      <Modal
        open={!!rowDetailRow}
        onClose={() => setRowDetailRow(null)}
        title={rowDetailRow && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0 }}>{rowDetailRow.name}</span>
            {rowPdfUrl(rowDetailRow) && (
              <button
                onClick={() => window.open(rowPdfUrl(rowDetailRow), '_blank', 'noopener,noreferrer')}
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
                  flexShrink: 0,
                }}
              >
                📄 PDF
              </button>
            )}
          </div>
        )}
        maxWidth={1000}
      >
        {rowDetailRow && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px 20px', maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
            {allColumns.map(col => {
              const cell = getCell(rowDetailRow.id, col.id);
              return (
                <div key={col.id}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>{col.name}</div>
                  <div
                    style={{
                      fontSize: 14,
                      color: '#1f2937',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      padding: '8px 10px',
                      background: '#f9fafb',
                      borderRadius: 6,
                      border: '1px solid #e5e7eb',
                      lineHeight: 1.6,
                    }}
                  >
                    {cell?.value && isUrl(cell.value) ? (
                      <button
                        onClick={() => setPdfPreviewUrl(cell.value)}
                        style={{ background: 'none', border: 'none', padding: 0, color: '#2563eb', fontWeight: 600, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}
                      >
                        📄 PDFを開く
                      </button>
                    ) : (
                      cell?.value || ''
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* 列内容一覧モーダル（読み取り専用） */}
      <Modal
        open={!!colDetailCol}
        onClose={() => setColDetailCol(null)}
        title={colDetailCol?.name}
        maxWidth={1000}
      >
        {colDetailCol && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 20px', maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
            {filteredRows.map((row, rowIdx) => {
              const cell = getCell(row.id, colDetailCol.id);
              const gridColumn = (rowIdx % 2) + 1;
              const pairIdx = Math.floor(rowIdx / 2);
              return (
                <React.Fragment key={row.id}>
                  <div
                    style={{
                      gridColumn,
                      gridRow: pairIdx * 2 + 1,
                      minWidth: 0,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#6b7280',
                      wordBreak: 'break-word',
                    }}
                  >
                    No.{rowNumberById.get(row.id)} {row.name}
                  </div>
                  <div
                    style={{
                      gridColumn,
                      gridRow: pairIdx * 2 + 2,
                      minWidth: 0,
                      fontSize: 13,
                      color: '#1f2937',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      padding: '8px 10px',
                      background: '#f9fafb',
                      borderRadius: 6,
                      border: '1px solid #e5e7eb',
                      lineHeight: 1.5,
                      marginBottom: 6,
                    }}
                  >
                    {cell?.value && isUrl(cell.value) ? (
                      <button
                        onClick={() => setPdfPreviewUrl(cell.value)}
                        style={{ background: 'none', border: 'none', padding: 0, color: '#2563eb', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}
                      >
                        📄 PDFを開く
                      </button>
                    ) : (
                      cell?.value || ''
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </Modal>

      {/* PDFプレビューモーダル */}
      <Modal open={!!pdfPreviewUrl} onClose={() => setPdfPreviewUrl(null)} title="PDFプレビュー" fill>
        {pdfPreviewUrl && (
          <iframe
            src={`${pdfPreviewUrl}#toolbar=0&navpanes=0`}
            title="PDFプレビュー"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#f9fafb' }}
          />
        )}
      </Modal>
    </div>
  );
}
