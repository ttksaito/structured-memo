// 論文PDF取り込みにかかったAPIコストの記録(Supabaseのcost_logsテーブルに保存)
// 必要なテーブル:
//   create table if not exists cost_logs (
//     id text primary key,
//     project_id text,
//     title text not null default '',
//     date timestamptz not null,
//     input_tokens bigint not null default 0,
//     output_tokens bigint not null default 0,
//     cache_write_tokens bigint not null default 0,
//     cache_read_tokens bigint not null default 0,
//     cost_usd double precision not null default 0
//   );

import { supabase } from './supabase';
import { PaperUsage } from './paperExtract';

export interface CostLogEntry extends PaperUsage {
  id: string;
  date: string; // ISO文字列
  projectId: string;
  title: string;
  costUsd: number;
}

// Claude Sonnet 5の単価(USD / 100万トークン)
const PRICE_PER_MTOK = {
  input: 3,
  output: 15,
  cacheWrite: 3.75, // 入力単価の1.25倍
  cacheRead: 0.3, // 入力単価の0.1倍
};

export function calcCostUsd(u: PaperUsage): number {
  return (
    (u.inputTokens * PRICE_PER_MTOK.input +
      u.outputTokens * PRICE_PER_MTOK.output +
      u.cacheWriteTokens * PRICE_PER_MTOK.cacheWrite +
      u.cacheReadTokens * PRICE_PER_MTOK.cacheRead) /
    1_000_000
  );
}

export async function loadCostLog(): Promise<CostLogEntry[]> {
  const { data, error } = await supabase.from('cost_logs').select('*').order('date', { ascending: false });
  if (error) {
    throw new Error(`コスト記録の読み込みに失敗: ${error.message}(Supabaseに「cost_logs」テーブルが必要です)`);
  }
  return (data || []).map(r => ({
    id: r.id,
    date: r.date,
    projectId: r.project_id ?? '',
    title: r.title ?? '',
    inputTokens: r.input_tokens ?? 0,
    outputTokens: r.output_tokens ?? 0,
    cacheWriteTokens: r.cache_write_tokens ?? 0,
    cacheReadTokens: r.cache_read_tokens ?? 0,
    costUsd: r.cost_usd ?? 0,
  }));
}

export async function appendCostLog(entry: Omit<CostLogEntry, 'id' | 'costUsd'>): Promise<void> {
  const { error } = await supabase.from('cost_logs').insert({
    id: 'cost-' + Date.now(),
    project_id: entry.projectId,
    title: entry.title,
    date: entry.date,
    input_tokens: entry.inputTokens,
    output_tokens: entry.outputTokens,
    cache_write_tokens: entry.cacheWriteTokens,
    cache_read_tokens: entry.cacheReadTokens,
    cost_usd: calcCostUsd(entry),
  });
  if (error) throw new Error(`コスト記録の保存に失敗: ${error.message}`);
}
