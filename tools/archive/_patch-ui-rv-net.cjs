/** _patch-ui-rv-net.cjs — 给 UI 验证脚本加 puLabel 网络日志(2026-10-29) */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '_ui-reprint-void.cjs')
let t = fs.readFileSync(p, 'utf8')

const OLD_LISTEN = "  sock.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })"
const NEW_LISTEN = [
  "  const net = []",
  "  sock.on('message', (d) => {",
  "    const m = JSON.parse(d)",
  "    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }",
  "    if (m.method === 'Network.responseReceived') {",
  "      const u = String(m.params.response.url)",
  "      if (u.indexOf('/api/px/puLabel') >= 0) net.push('[' + m.params.response.status + '] ' + u.replace(BASE, '/').slice(0, 60))",
  "    }",
  "  })",
].join('\n')

if (t.includes('const net = []')) { console.log('已有日志,跳过'); process.exit(0) }
if (!t.includes(OLD_LISTEN)) { console.error('没找到监听片段'); process.exit(2) }
t = t.replace(OLD_LISTEN, NEW_LISTEN)
t = t.replace("  await send('Page.enable')", "  await send('Page.enable')\n  await send('Network.enable')")
t = t.replace("    const shot = await send('Page.captureScreenshot', { format: 'png' })",
  "    console.log('--- puLabel 请求 ---')\n    console.log(net.join('\\n') || '(无)')\n    const shot = await send('Page.captureScreenshot', { format: 'png' })")
fs.writeFileSync(p, t, 'utf8')
console.log('已加网络日志')
