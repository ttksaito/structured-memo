import { Column, Row, Cell, ChatMessage } from '../types';

interface ChatContext {
  row: Row;
  column: Column;
  cell: Cell;
  rowCells: Cell[];
  columns: Column[];
  history: ChatMessage[];
}

function buildSystemPrompt(ctx: ChatContext): string {
  const rowInfo = ctx.columns
    .filter(c => c.visible)
    .map(col => {
      const cell = ctx.rowCells.find(c => c.columnId === col.id);
      return `- ${col.name}: ${cell?.value || '(未入力)'}`;
    })
    .join('\n');

  return `あなたは構造化メモアプリのアシスタントです。ユーザーが「${ctx.row.name}」の「${ctx.column.name}」セルについて調査・深掘りするのを手助けしてください。

## 対象組織の情報
${rowInfo}

## 現在の列の定義
列名: ${ctx.column.name}
${ctx.column.description ? `列の説明: ${ctx.column.description}` : ''}

## 現在のセル情報
値: ${ctx.cell.value || '(未入力)'}
${ctx.cell.annotation ? `注釈: ${ctx.cell.annotation}` : ''}

## 指示
- 回答は簡潔にしてください
- 必要に応じて、セルの値や注釈に保存すべき要約を提案してください
- ユーザーの質問に対して、構造化された情報を提供してください`;
}

export async function sendChatMessage(
  apiKey: string,
  ctx: ChatContext,
  userMessage: string,
  onChunk: (text: string) => void
): Promise<string> {
  const messages = [
    ...ctx.history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      system: buildSystemPrompt(ctx),
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API Error (${response.status}): ${err}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullText += parsed.delta.text;
            onChunk(fullText);
          }
        } catch {
          // skip non-JSON lines
        }
      }
    }
  }

  return fullText;
}
