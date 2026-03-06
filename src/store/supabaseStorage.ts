import { supabase } from '../services/supabase';
import { Project, ProjectData, Column, Row, Cell, ChatMessage, CellInterest, ChatThread } from '../types';

// ── Projects ──────────────────────────────────────────────
export async function dbLoadProjects(): Promise<Project[]> {
  const { data } = await supabase.from('projects').select('*').order('created_at');
  return (data || []).map(p => ({ id: p.id, name: p.name, createdAt: p.created_at, memo: p.memo ?? '' }));
}

export async function dbSaveProject(project: Project): Promise<void> {
  await supabase.from('projects').upsert({
    id: project.id,
    name: project.name,
    created_at: project.createdAt,
    memo: project.memo ?? '',
  });
}

export async function dbUpdateProjectMemo(projectId: string, memo: string): Promise<void> {
  await supabase.from('projects').update({ memo }).eq('id', projectId);
}

export async function dbDeleteProject(projectId: string): Promise<void> {
  const { data: rows } = await supabase.from('rows').select('id').eq('project_id', projectId);
  const rowIds = (rows || []).map(r => r.id);

  if (rowIds.length > 0) {
    const { data: cellData } = await supabase.from('cells').select('id').in('row_id', rowIds);
    const cellIds = (cellData || []).map(c => c.id);
    if (cellIds.length > 0) {
      await Promise.all([
        supabase.from('chat_messages').delete().in('cell_id', cellIds),
        supabase.from('cell_interests').delete().in('cell_id', cellIds),
      ]);
      await supabase.from('cells').delete().in('row_id', rowIds);
    }
  }

  await Promise.all([
    supabase.from('columns').delete().eq('project_id', projectId),
    supabase.from('rows').delete().eq('project_id', projectId),
  ]);
  await supabase.from('projects').delete().eq('id', projectId);
}

// ── Project data (bulk) ───────────────────────────────────
export async function dbLoadProjectData(projectId: string): Promise<ProjectData | null> {
  const [colRes, rowRes] = await Promise.all([
    supabase.from('columns').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('rows').select('*').eq('project_id', projectId).order('sort_order'),
  ]);

  const columns: Column[] = (colRes.data || []).map(c => ({
    id: c.id, name: c.name, description: c.description, order: c.sort_order, visible: c.visible,
  }));
  const rows: Row[] = (rowRes.data || []).map(r => ({
    id: r.id, name: r.name, order: r.sort_order, memo: r.memo ?? '',
  }));

  const rowIds = rows.map(r => r.id);
  let cells: Cell[] = [];
  let threads: ChatThread[] = [];
  let interests: CellInterest[] = [];

  if (rowIds.length > 0) {
    const { data: cellData } = await supabase.from('cells').select('*').in('row_id', rowIds);
    cells = (cellData || []).map(c => ({
      id: c.id, rowId: c.row_id, columnId: c.column_id, value: c.value, annotation: c.annotation,
    }));

    const cellIds = cells.map(c => c.id);
    if (cellIds.length > 0) {
      const [msgRes, interestRes] = await Promise.all([
        supabase.from('chat_messages').select('*').in('cell_id', cellIds).order('created_at'),
        supabase.from('cell_interests').select('*').in('cell_id', cellIds),
      ]);

      const byCell: Record<string, ChatMessage[]> = {};
      for (const m of (msgRes.data || [])) {
        if (!byCell[m.cell_id]) byCell[m.cell_id] = [];
        byCell[m.cell_id].push({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content, createdAt: m.created_at });
      }
      threads = Object.entries(byCell).map(([cellId, messages]) => ({ cellId, messages }));

      interests = (interestRes.data || []).map(i => ({
        cellId: i.cell_id, chatCount: i.chat_count, lastChattedAt: i.last_chatted_at, star: i.star,
      }));
    }
  }

  return { columns, rows, cells, threads, interests };
}

export async function dbSaveProjectData(projectId: string, data: ProjectData): Promise<void> {
  if (data.columns.length > 0) {
    await supabase.from('columns').upsert(
      data.columns.map(c => ({ id: c.id, project_id: projectId, name: c.name, description: c.description, sort_order: c.order, visible: c.visible }))
    );
  }
  if (data.rows.length > 0) {
    await supabase.from('rows').upsert(
      data.rows.map(r => ({ id: r.id, project_id: projectId, name: r.name, sort_order: r.order, memo: r.memo ?? '' }))
    );
  }
  if (data.cells.length > 0) {
    await supabase.from('cells').upsert(
      data.cells.map(c => ({ id: c.id, row_id: c.rowId, column_id: c.columnId, value: c.value, annotation: c.annotation }))
    );
  }
  const allMessages = data.threads.flatMap(t =>
    t.messages.map(m => ({ id: m.id, cell_id: t.cellId, role: m.role, content: m.content, created_at: m.createdAt }))
  );
  if (allMessages.length > 0) {
    await supabase.from('chat_messages').upsert(allMessages);
  }
  if (data.interests.length > 0) {
    await supabase.from('cell_interests').upsert(
      data.interests.map(i => ({ cell_id: i.cellId, chat_count: i.chatCount, last_chatted_at: i.lastChattedAt, star: i.star }))
    );
  }
}

// ── Individual operations ─────────────────────────────────
export async function dbUpsertColumn(column: Column, projectId: string): Promise<void> {
  await supabase.from('columns').upsert({
    id: column.id, project_id: projectId, name: column.name,
    description: column.description, sort_order: column.order, visible: column.visible,
  });
}

export async function dbDeleteColumn(columnId: string): Promise<void> {
  await supabase.from('cells').delete().eq('column_id', columnId);
  await supabase.from('columns').delete().eq('id', columnId);
}

export async function dbReorderColumns(columns: Column[]): Promise<void> {
  await Promise.all(columns.map(c =>
    supabase.from('columns').update({ sort_order: c.order }).eq('id', c.id)
  ));
}

export async function dbUpdateRowMemo(rowId: string, memo: string): Promise<void> {
  await supabase.from('rows').update({ memo }).eq('id', rowId);
}

export async function dbUpsertRow(row: Row, projectId: string, cells: Cell[]): Promise<void> {
  await supabase.from('rows').upsert({ id: row.id, project_id: projectId, name: row.name, sort_order: row.order, memo: row.memo ?? '' });
  if (cells.length > 0) {
    await supabase.from('cells').upsert(
      cells.map(c => ({ id: c.id, row_id: c.rowId, column_id: c.columnId, value: c.value, annotation: c.annotation }))
    );
  }
}

export async function dbDeleteRow(rowId: string): Promise<void> {
  const { data: cellData } = await supabase.from('cells').select('id').eq('row_id', rowId);
  const cellIds = (cellData || []).map(c => c.id);
  if (cellIds.length > 0) {
    await Promise.all([
      supabase.from('chat_messages').delete().in('cell_id', cellIds),
      supabase.from('cell_interests').delete().in('cell_id', cellIds),
    ]);
    await supabase.from('cells').delete().eq('row_id', rowId);
  }
  await supabase.from('rows').delete().eq('id', rowId);
}

export async function dbUpsertCell(cell: Cell): Promise<void> {
  await supabase.from('cells').upsert({
    id: cell.id, row_id: cell.rowId, column_id: cell.columnId, value: cell.value, annotation: cell.annotation,
  });
}

export async function dbInsertMessage(cellId: string, message: ChatMessage): Promise<void> {
  await supabase.from('chat_messages').insert({
    id: message.id, cell_id: cellId, role: message.role, content: message.content, created_at: message.createdAt,
  });
}

export async function dbUpsertInterest(interest: CellInterest): Promise<void> {
  await supabase.from('cell_interests').upsert({
    cell_id: interest.cellId, chat_count: interest.chatCount,
    last_chatted_at: interest.lastChattedAt, star: interest.star,
  });
}
