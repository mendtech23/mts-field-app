// fake Resend: stores e-mails in memory, GET /mails lists them
const http = require('http'); const mails = [];
http.createServer((q, r) => { let b = ''; q.on('data', d => b += d); q.on('end', () => {
  if (q.method === 'GET') { r.writeHead(200, { 'Content-Type': 'application/json' }); return r.end(JSON.stringify(mails)); }
  if (q.method === 'DELETE') { mails.length = 0; r.writeHead(200); return r.end('{}'); }
  const j = JSON.parse(b || '{}'); j.auth = q.headers.authorization; mails.push(j); r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ id: 'm' + mails.length })); }); }).listen(8310);
