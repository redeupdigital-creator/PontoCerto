const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'fotos-colaboradores';

let supabase = null;
function getSupabase() {
  if (supabase) return supabase;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return null;
  // A service key (não a anon key) é necessária aqui porque o upload roda no
  // backend, sem contexto de usuário logado no Supabase Auth — ela tem
  // permissão total no projeto, então NUNCA deve ser exposta ao frontend.
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  return supabase;
}

/**
 * Salva o buffer de uma foto enviada e retorna a URL pública (Supabase Storage)
 * ou o caminho relativo (disco local, servido por /uploads) para gravar em
 * `colaborador.fotoPath`. As duas formas de valor são tratadas de forma
 * transparente no frontend (URL absoluta vs. relativa).
 */
async function salvarFoto(buffer, nomeOriginal, mimetype) {
  const ext = path.extname(nomeOriginal) || '.jpg';
  const nomeArquivo = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  const client = getSupabase();
  if (client) {
    const { error } = await client.storage.from(BUCKET).upload(nomeArquivo, buffer, {
      contentType: mimetype,
      upsert: false,
    });
    if (error) throw new Error(`Falha ao enviar foto para o Supabase Storage: ${error.message}`);
    const { data } = client.storage.from(BUCKET).getPublicUrl(nomeArquivo);
    return data.publicUrl; // URL absoluta -> gravada como está em fotoPath
  }

  // Fallback: disco local (uso em desenvolvimento, ou deploy em servidor com
  // disco persistente — não funciona em ambientes serverless como Vercel).
  if (process.env.VERCEL) {
    throw new Error(
      'Upload de foto requer Supabase Storage configurado (SUPABASE_URL e SUPABASE_SERVICE_KEY) ' +
      'ao rodar na Vercel — o sistema de arquivos do deployment é somente leitura em runtime.'
    );
  }
  const dir = path.join(__dirname, '..', '..', 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, nomeArquivo), buffer);
  return `/uploads/${nomeArquivo}`; // caminho relativo -> resolvido pelo frontend
}

/** true se o Supabase Storage está configurado (produção); false = disco local (dev). */
function usandoSupabase() {
  return !!getSupabase();
}

module.exports = { salvarFoto, usandoSupabase };
