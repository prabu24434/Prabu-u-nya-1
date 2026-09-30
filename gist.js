/* ==========================================================
   api/gist.js — Vercel Serverless Function
   Proxy aman ke GitHub Gist REST API.

   Kenapa lewat sini, bukan langsung dari browser?
   Karena GITHUB_TOKEN dibaca dari Environment Variable di server
   (process.env), TIDAK PERNAH dikirim ke browser sama sekali.
   Browser hanya bicara ke /api/gist milik situs sendiri.

   ENV VAR yang wajib diset di Vercel (Project Settings -> Environment
   Variables):
     - GITHUB_TOKEN  -> Personal Access Token, scope "gist" saja
     - GIST_ID       -> ID Gist yang dipakai sebagai database

   Endpoint:
     GET  /api/gist?file=transactions.json  -> { value: <parsed JSON> | null }
     PUT  /api/gist   body: { file, content } -> { success: true }
   ========================================================== */

export default async function handler(req, res) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GIST_ID = process.env.GIST_ID;

  if (!GITHUB_TOKEN || !GIST_ID) {
    return res.status(500).json({
      error:
        'Environment variable GITHUB_TOKEN dan/atau GIST_ID belum diset di Vercel. ' +
        'Buka Project Settings -> Environment Variables, lalu redeploy.',
    });
  }

  const githubHeaders = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
  };

  try {
    if (req.method === 'GET') {
      const file = req.query.file;
      if (!file) {
        return res.status(400).json({ error: 'Parameter "file" wajib diisi, contoh: ?file=transactions.json' });
      }

      const ghRes = await fetch(`https://api.github.com/gists/${GIST_ID}`, { headers: githubHeaders });

      if (!ghRes.ok) {
        const detail = ghRes.status === 401 ? 'Token tidak valid/kedaluwarsa' :
          ghRes.status === 404 ? 'Gist ID tidak ditemukan' : `GitHub API error ${ghRes.status}`;
        return res.status(ghRes.status).json({ error: detail });
      }

      const gistData = await ghRes.json();
      const fileEntry = gistData.files && gistData.files[file];

      if (!fileEntry || fileEntry.content == null) {
        return res.status(200).json({ value: null });
      }

      return res.status(200).json({ value: JSON.parse(fileEntry.content) });
    }

    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { file, content } = body;

      if (!file || content === undefined) {
        return res.status(400).json({ error: 'Body wajib berisi { file, content }' });
      }

      const ghRes = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'PATCH',
        headers: { ...githubHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: { [file]: { content: JSON.stringify(content, null, 2) } },
        }),
      });

      if (!ghRes.ok) {
        const detail = ghRes.status === 401 ? 'Token tidak valid/kedaluwarsa' : `GitHub API error ${ghRes.status}`;
        return res.status(ghRes.status).json({ error: detail });
      }

      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ error: `Method ${req.method} tidak didukung` });
  } catch (err) {
    console.error('api/gist error:', err);
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan pada server' });
  }
}
