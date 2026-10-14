import { supabase } from './supabase';

const BUCKET = 'papers';

// 「作者名(年度).pdf」形式のファイル名を作る(Storageのキーに使えない文字は除去)
export function buildPaperFileName(authorSurname: string, year: string): string {
  const author = (authorSurname || '').trim().replace(/[^\w-]/g, '') || 'Unknown';
  const y = (year || '').trim().replace(/\D/g, '') || 'n.d.';
  return `${author}(${y}).pdf`;
}

// PDFをSupabase Storageにアップロードし、公開URLを返す
// 同名ファイルが既にある場合は「作者名(年度)-2.pdf」のように連番を付けて保存する
export async function uploadPaperPdf(file: File, projectId: string, fileName: string): Promise<string> {
  const base = fileName.replace(/\.pdf$/i, '');
  let path = '';
  let lastError = '';

  for (let i = 1; i <= 50; i++) {
    path = `${projectId}/${i === 1 ? base : `${base}-${i}`}.pdf`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: 'application/pdf',
      upsert: false,
    });
    if (!error) {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return data.publicUrl;
    }
    lastError = error.message;
    const isDuplicate = /already exists/i.test(error.message) || (error as { statusCode?: string }).statusCode === '409';
    if (!isDuplicate) break;
  }

  throw new Error(`PDFアップロード失敗: ${lastError}(Supabaseに「${BUCKET}」バケットが必要です)`);
}
