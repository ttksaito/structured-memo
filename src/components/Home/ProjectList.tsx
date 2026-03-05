import React, { useState } from 'react';
import { useApp } from '../../store/ProjectContext';
import { dbLoadProjectData, dbSaveProjectData } from '../../store/supabaseStorage';
import { createSampleData } from '../../utils/sampleData';
import { Modal } from '../common/Modal';

export function ProjectList() {
  const { state, dispatch, loading } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [useSample, setUseSample] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = 'proj-' + Date.now();
    const project = { id, name: newName.trim(), createdAt: new Date().toISOString() };
    const data = useSample ? createSampleData() : { columns: [], rows: [], cells: [], threads: [], interests: [] };
    dispatch({ type: 'ADD_PROJECT', project });
    if (data.columns.length > 0) {
      await dbSaveProjectData(id, data);
    }
    dispatch({ type: 'SELECT_PROJECT', projectId: id, data });
    setNewName('');
    setShowNew(false);
  };

  const handleOpen = async (projectId: string) => {
    setOpening(projectId);
    try {
      const data = await dbLoadProjectData(projectId) || { columns: [], rows: [], cells: [], threads: [], interests: [] };
      dispatch({ type: 'SELECT_PROJECT', projectId, data });
    } finally {
      setOpening(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9ca3af', fontSize: 15 }}>
        読み込み中...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Structured Memo</h1>
      </div>

      <button
        onClick={() => setShowNew(true)}
        style={{
          width: '100%',
          padding: '14px 20px',
          background: '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 24,
        }}
      >
        + 新規プロジェクト作成
      </button>

      {state.projects.length === 0 && (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>
          プロジェクトがありません。新規作成してください。
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {state.projects.map(p => (
          <div
            key={p.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 18px',
              background: opening === p.id ? '#eff6ff' : '#f9fafb',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              cursor: opening === p.id ? 'wait' : 'pointer',
              opacity: opening && opening !== p.id ? 0.6 : 1,
            }}
            onClick={() => !opening && handleOpen(p.id)}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                {opening === p.id ? '読み込み中...' : `作成日: ${new Date(p.createdAt).toLocaleDateString('ja-JP')}`}
              </div>
            </div>
            <button
              onClick={e => {
                e.stopPropagation();
                if (confirm(`「${p.name}」を削除しますか？`)) {
                  dispatch({ type: 'DELETE_PROJECT', projectId: p.id });
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: 13,
                padding: '4px 8px',
              }}
            >
              削除
            </button>
          </div>
        ))}
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="新規プロジェクト">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="プロジェクト名"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' }}>
            <input type="checkbox" checked={useSample} onChange={e => setUseSample(e.target.checked)} />
            サンプルデータを投入する
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowNew(false)}
              style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
            >
              キャンセル
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 6,
                background: newName.trim() ? '#3b82f6' : '#9ca3af',
                color: '#fff',
                cursor: newName.trim() ? 'pointer' : 'default',
                fontWeight: 600,
              }}
            >
              作成
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
