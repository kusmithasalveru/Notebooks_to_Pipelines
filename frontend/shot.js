const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => resolve(JSON.parse(b)));
    }).on('error', reject);
  });
}
function send(ws, id, m, p) {
  return new Promise(r => {
    const h = msg => { const d = JSON.parse(msg); if (d.id !== id) return; ws.off('message', h); r(d); };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method: m, params: p || {} }));
  });
}

(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:5173/#/studio';
  const list = await getTargets();
  const page = list.find(t => t.type === 'page' && t.title === 'Capstone Notebook Pipeline') || list[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));
  let id = 1;
  await send(ws, id++, 'Emulation.setDeviceMetricsOverride', { width: parseInt(process.argv[3] || 1280), height: 900, deviceScaleFactor: 1, mobile: false });
  await send(ws, id++, 'Page.enable');
  await send(ws, id++, 'Page.navigate', { url });
  await new Promise(r => setTimeout(r, 4000));
  const snap = await send(ws, id++, 'Page.captureScreenshot', { format: 'png' });
  const data = snap.result && snap.result.data ? snap.result.data : snap.data;
  fs.writeFileSync('C:/Users/bhanu/.claude/jobs/01a3ecbf/tmp/shot.png', Buffer.from(data, 'base64'));
  console.log('saved ' + url + ' @ ' + (process.argv[3] || 1280));
  ws.close();
})().catch(e => { console.error(e); process.exit(1); });
