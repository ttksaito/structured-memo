import { supabase } from './supabase';

const BUCKET = 'papers';

// PDFをSupabase Storageにアップロードし、公開URLを返す
export async function uploadPaperPdf(file: File, projectId: string): Promise<string> {
  const safeName = file.name.replace(/[^\w.-]/g, '_');
  const path = `${projectId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: 'application/pdf',
  });
  if (error) {
    throw new Error(`PDFアップロード失敗: ${error.message}(Supabaseに「${BUCKET}」バケットが必要です)`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
