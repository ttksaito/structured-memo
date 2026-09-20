// 論文PDFをClaude APIに渡し、列ごとに個別プロンプトを順番に投げて抽出する
// プロンプト1: 著者/日付/タイトル、プロンプト2以降: 各列を300字以内で整理
// (列が増えると抽出プロンプトも1つ増える)

export interface PaperSectionTarget {
  name: string; // 列名(概要/背景/...)
  description?: string; // 列の説明(あればプロンプトのヒントに使う)
}

export interface PaperInfo {
  title: string; // 行名用タイトル(日本語訳があれば「日本語訳（原題）」)
  metaText: string; // 「著者/日付/タイトル」列用の整形テキスト
  authors: string;
  date: string;
  sections: Record<string, string>; // 列名(概要/背景/...) → 内容
}

// 「著者/日付/タイトル」をまとめて入れる列名
export const PAPER_META_COLUMN = '著者/日付/タイトル';

// 抽出対象のデフォルト列名(無ければ自動作成される)
export const PAPER_SECTION_COLUMNS = ['概要', '背景', '目的', '方法', '結果', '新規性', '限界', '課題'] as const;

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5';

const META_TOOL = {
  name: 'save_paper_meta',
  description: '論文の著者・日付・タイトルを保存する',
  input_schema: {
    type: 'object',
    properties: {
      authors: { type: 'string', description: '著者名(原文のままカンマ区切り。全員分)' },
      date: { type: 'string', description: '出版日または発表日(例: 2024年2月29日、2023年5月)' },
      title: { type: 'string', description: '論文タイトル(原文のまま)' },
      title_ja: { type: 'string', description: 'タイトルの日本語訳(原文が日本語の場合は省略)' },
    },
    required: ['authors', 'date', 'title'],
  },
} as const;

// PDFブロック。cache_controlを付けて2回目以降の呼び出しでPDF読解をキャッシュ再利用する
function pdfBlock(pdfBase64: string) {
  return {
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
    cache_control: { type: 'ephemeral' },
  };
}

async function callClaude(apiKey: string, body: object): Promise<{ content?: Array<{ type: string; text?: string; input?: unknown }> }> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API Error (${response.status}): ${err}`);
  }
  return response.json();
}

function truncate(text: string, max = 300): string {
  const t = (text || '').trim();
  return t.length > max ? t.slice(0, max) : t;
}

// プロンプト1: 著者/日付/タイトル
async function extractMeta(apiKey: string, pdfBase64: string): Promise<Omit<PaperInfo, 'sections'>> {
  const data = await callClaude(apiKey, {
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: 'disabled' },
    tools: [META_TOOL],
    tool_choice: { type: 'tool', name: 'save_paper_meta' },
    messages: [
      {
        role: 'user',
        content: [
          pdfBlock(pdfBase64),
          { type: 'text', text: 'この論文PDFの著者・日付・タイトルを読み取り、save_paper_meta ツールで保存してください。' },
        ],
      },
    ],
  });

  const toolUse = (data.content || []).find(b => b.type === 'tool_use');
  if (!toolUse) throw new Error('著者/日付/タイトルの抽出に失敗しました');
  const input = toolUse.input as Record<string, string>;

  const authors = truncate(input.authors);
  const date = truncate(input.date, 100);
  const titleRaw = (input.title || '').trim() || '(タイトル不明)';
  const titleJa = (input.title_ja || '').trim();
  const title = titleJa && titleJa !== titleRaw ? `${titleJa}（${titleRaw}）` : titleRaw;
  const metaText = `・著者: ${authors}\n・日付: ${date}\n・タイトル: ${title}`;

  return { title, authors, date, metaText };
}

// プロンプト2以降: 1列につき1プロンプト
async function extractSection(apiKey: string, pdfBase64: string, target: PaperSectionTarget): Promise<string> {
  const hint = target.description?.trim() ? `(この項目の意味: ${target.description.trim()})\n` : '';
  const data = await callClaude(apiKey, {
    model: MODEL,
    max_tokens: 2048,
    thinking: { type: 'disabled' },
    messages: [
      {
        role: 'user',
        content: [
          pdfBlock(pdfBase64),
          {
            type: 'text',
            text: `この論文の「${target.name}」を日本語300字以内で整理してください。\n${hint}論文の内容に忠実に、前置きや見出しなしで本文だけを出力してください。`,
          },
        ],
      },
    ],
  });

  const text = (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text || '')
    .join('\n');
  return truncate(text);
}

// 列ごとに順番にプロンプトを投げて抽出する
export async function extractPaperInfo(
  apiKey: string,
  pdfBase64: string,
  sectionTargets: PaperSectionTarget[],
  onProgress?: (message: string) => void
): Promise<PaperInfo> {
  const total = sectionTargets.length + 1;

  onProgress?.(`Claudeが論文を読解中... (1/${total}) 著者/日付/タイトル`);
  const meta = await extractMeta(apiKey, pdfBase64);

  const sections: Record<string, string> = {};
  for (let i = 0; i < sectionTargets.length; i++) {
    const target = sectionTargets[i];
    onProgress?.(`Claudeが論文を読解中... (${i + 2}/${total}) ${target.name}`);
    sections[target.name] = await extractSection(apiKey, pdfBase64, target);
  }

  return { ...meta, sections };
}
