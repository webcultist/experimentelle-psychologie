const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3456;
const DIR = __dirname;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  if (req.url === '/health') {
    res.writeHead(200, { ...CORS, 'Content-Type': 'text/plain' });
    return res.end('ok');
  }

  if (req.url === '/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { prompt } = JSON.parse(body);
        res.writeHead(200, {
          ...CORS,
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked'
        });
        const claude = spawn('claude', ['-p', '--model', 'claude-haiku-4-5-20251001', '--output-format', 'text'], {
          env: { ...process.env }
        });
        claude.stdin.write(prompt);
        claude.stdin.end();
        claude.stdout.on('data', chunk => res.write(chunk));
        claude.stderr.on('data', chunk => console.error(chunk.toString()));
        claude.on('close', () => res.end());
      } catch (e) {
        res.writeHead(400, CORS);
        res.end('Invalid JSON');
      }
    });
    return;
  }

  // Static file serving for HTML/CSS/JS
  let filePath = req.url === '/' ? '/index-v3.html' : req.url;
  filePath = path.join(DIR, filePath.split('?')[0]);
  if (!filePath.startsWith(DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  const ext = path.extname(filePath);
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': (types[ext] || 'text/plain') + '; charset=utf-8' });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => console.log(`Chat-Server auf http://0.0.0.0:${PORT}`));
