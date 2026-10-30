const WebSocket = require('ws');
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
  const url = 'http://127.0.0.1:5173/#/studio';
  const list = await getTargets();
  const page = list.find(t => t.type === 'page') || list[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));
  let id = 1;
  await send(ws, id++, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send(ws, id++, 'Page.enable');
  await send(ws, id++, 'DOM.enable');
  await send(ws, id++, 'CSS.enable');
  await send(ws, id++, 'Page.navigate', { url });
  await new Promise(r => setTimeout(r, 4000));

  const doc = await send(ws, id++, 'DOM.getDocument', { depth: -1 });
  const root = doc.result.root;

  function findNodes(node, results) {
    if (node.nodeType === 1) {
      if (node.localName && ['select','input','label','div','option'].includes(node.localName.toLowerCase())) {
        results.push(node);
      }
    }
    for (const child of node.children || []) findNodes(child, results);
  }
  const nodes = [];
  findNodes(root, nodes);

  for (const node of nodes) {
    if (node.localName === 'select' || node.localName === 'input' || node.localName === 'label') {
      try {
        const style = await send(ws, id++, 'CSS.getComputedStyleForNode', { nodeId: node.nodeId });
        const cs = style.result.computedStyle;
        const get = (name) => cs.find(s => s.name === name)?.value;
        const text = node.children ? node.children.map(c => c.nodeValue || '').join('') : '';
        if (text.includes('Region') || text.includes('Min Sales') || text.includes('North') || text.includes('South') || text.includes('East') || text.includes('West') || node.localName === 'select' || node.localName === 'input') {
          console.log(`${node.localName}: width=${get('width')} height=${get('height')} min-height=${get('min-height')} font-size=${get('font-size')} padding=${get('padding')} margin=${get('margin')} display=${get('display')} box-sizing=${get('box-sizing')} overflow=${get('overflow')} text="${text.trim()}"`);
        }
      } catch (e) {
        console.log('Style error for', node.localName, ':', e.message);
      }
    }
  }
  ws.close();
})().catch(e => { console.error('ERR:', e); process.exit(1); });
