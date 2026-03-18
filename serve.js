const http = require('http');
const fs = require('fs');
const path = require('path');
const MIME = { html:'text/html', js:'application/javascript', css:'text/css', json:'application/json', png:'image/png', ico:'image/x-icon', svg:'image/svg+xml', txt:'text/plain' };
http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/desktop-manager.html';
  const fp = path.join(__dirname, url);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = fp.split('.').pop();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
}).listen(8000, () => console.log('Forzone dev server running on http://localhost:8000'));
