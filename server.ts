import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json());

  const DEFAULT_GAS_URL = 
    'https://script.google.com/macros/s/AKfycbxn2BoqwWRZkY8KC7QVfEZKJnS-RVuCUVJZferasj8Z9TZ9eFv-VjXFxztVs00BLUV__w/exec';

  // Google Apps Script Proxy for fetching UPT schools list (Kolom F: NAMA UPT)
  app.all('/api/auth/gas-schools', async (req, res) => {
    try {
      const targetUrl = (req.body && req.body.gasUrl) || (req.query && req.query.gasUrl) || DEFAULT_GAS_URL;
      const separator = String(targetUrl).includes('?') ? '&' : '?';
      const response = await fetch(`${targetUrl}${separator}action=getSchools`);
      const text = await response.text();
      const data = JSON.parse(text);
      if ((data.status === 'success' || data.success === true) && Array.isArray(data.schools)) {
        return res.json({ status: 'success', success: true, schools: data.schools });
      }
      return res.json({ status: 'error', success: false, schools: [] });
    } catch (err: any) {
      return res.status(200).json({
        status: 'error',
        success: false,
        schools: [],
        message: err.message || 'Gagal memuat daftar UPT dari Google Spreadsheet',
      });
    }
  });

  // Google Apps Script Proxy for Login (supports Kolom A-G with Kolom F: NAMA UPT)
  app.post('/api/auth/gas-login', async (req, res) => {
    try {
      const { username, email, password, upt, namaUpt, gasUrl } = req.body;
      const targetUser = username || email || '';
      const targetUpt = namaUpt || upt || '';
      const targetUrl = gasUrl || DEFAULT_GAS_URL;

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'login',
          username: targetUser,
          password,
          upt: targetUpt,
          namaUpt: targetUpt,
        }),
      });

      const text = await response.text();

      // Check if Apps Script returned HTML error or missing doPost
      if (text.includes('Script function not found: doPost') || text.includes('Script function not found: doGet')) {
        return res.status(200).json({
          success: false,
          isGasScriptError: true,
          message: 'Fungsi doPost belum dideploy di Google Apps Script editor. Silakan terapkan kode doPost(e) di script spreadsheet.',
        });
      }

      try {
        const data = JSON.parse(text);
        if (data.status === 'success' || data.success === true) {
          return res.json({ success: true, user: data.user || data.data });
        }
        return res.json({ success: false, message: data.message || data.error || 'Username, password, atau UPT tidak cocok.' });
      } catch {
        return res.json({
          success: false,
          isGasScriptError: true,
          message: 'Respon dari Google Apps Script bukan JSON yang valid.',
          raw: text.slice(0, 300),
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: 'Gagal terhubung ke Google Apps Script: ' + (err.message || 'Error jaringan'),
      });
    }
  });

  // Mount Vite middleware in development
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
