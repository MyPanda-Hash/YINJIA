/**
 * _w111-receiver.cjs — W111 无线透传模块(电子秤串口→WiFi)接 MES 数采的接收端(2026-10-19)
 *
 * 为什么需要它:W111 只会把串口原始字节按 HTTP GET/POST 发到指定地址,
 * 它拼不出 MES `/api/dc/ingest` 要求的 JSON + X-DC-Key 请求头。所以本机开一个小接收口:
 *   模块 --HTTP--> 本脚本(8099) --解析重量--> POST /api/dc/ingest(带 X-DC-Key) --> MES 数采流水
 *
 * 三种能力:
 *   ① 原样记录每一笔请求(方法/路径/查询串/头/正文),用来第一次对接时看清模块到底发什么;
 *   ② 用与 _scale-bridge.ps1 同一套正则从报文里抽重量(kg),抽到就上报;
 *   ③ UDP 8168「自动发现」应答(模块的高级选项里有「搜索关键字 userdata / 搜索端口 8168」,
 *      若它先广播找服务器,这里回一个包含 userdata 的报文把本机 IP 告诉它)。
 *
 * 用法(仓库根):
 *   node tools/archive/_dc-scale-live-20261019/_w111-receiver.cjs                 # 默认 8099
 *   node tools/archive/_dc-scale-live-20261019/_w111-receiver.cjs --port 8099 --dry
 *   --dry 只打印不写库(第一次接线一定要先 dry 一遍,确认帧格式与端口没被防火墙挡)
 */
const http = require('node:http')
const dgram = require('node:dgram')
const os = require('node:os')

const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name)
  if (i < 0) return def
  const v = process.argv[i + 1]
  return v && !v.startsWith('--') ? v : true
}
const PORT = Number(arg('port', 8099))
const UDP_PORT = Number(arg('udp', 8168))
const DRY = !!arg('dry', false)
const BASE = arg('base', 'http://127.0.0.1:8090')
const DEVICE = arg('device', 'DZ-001')
const POINT = arg('point', 'W01')
const KEY = arg('key', 'scale-demo-2026')

/** 与 _scale-bridge.ps1 保持一致:抓第一个带小数的重量,忽略 ST/US/OL 状态字与 kg 单位 */
function parseWeight(text) {
  if (!text) return null
  const s = String(text).replace(/\+/g, ' ')
  let m = s.match(/(\d{1,4}\.\d{1,3})/)
  if (!m) m = s.match(/(?<=[,\s])(\d{1,4})(?=\s*(?:kg|KG|g|G)?\s*$)/)
  if (!m) return null
  const v = Number(m[1])
  return Number.isFinite(v) ? v : null
}

async function pushWeight(kg) {
  const body = JSON.stringify({ deviceCode: DEVICE, values: [{ pointCode: POINT, value: kg }] })
  const res = await fetch(BASE + '/api/dc/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-DC-Key': KEY },
    body,
  })
  const txt = await res.text()
  return { status: res.status, body: txt.slice(0, 200) }
}

function localIps() {
  const out = []
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(`${name}=${a.address}`)
  }
  return out.join(', ')
}

let seq = 0
const server = http.createServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', async () => {
    const raw = Buffer.concat(chunks).toString('utf8')
    const u = new URL(req.url, 'http://x')
    const query = Object.fromEntries(u.searchParams.entries())
    seq++
    const stamp = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    console.log(`\n[${stamp}] #${seq} ${req.method} ${u.pathname}`)
    if (Object.keys(query).length) console.log('  query :', JSON.stringify(query))
    console.log('  headers:', JSON.stringify(req.headers))
    if (raw) console.log('  body   :', JSON.stringify(raw.slice(0, 300)))

    const candidates = [raw, ...Object.values(query), u.pathname].filter(Boolean)
    let kg = null
    for (const c of candidates) { kg = parseWeight(c); if (kg !== null) break }
    if (kg === null) {
      console.log('  → 没抽到重量(仅记录;适合先把模块的报文格式摸清)')
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ok(no weight)')
      return
    }
    if (DRY) {
      console.log(`  → [dry] 解析重量 ${kg} kg,未写库`)
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('dry ' + kg)
      return
    }
    try {
      const r = await pushWeight(kg)
      console.log(`  → 已上报 ${kg} kg  MES=${r.status} ${r.body}`)
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('accepted ' + kg)
    } catch (e) {
      console.log('  → 上报失败:', e.message)
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ingest-failed')
    }
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`W111 接收端已启动:http://0.0.0.0:${PORT}  (本机 IP: ${localIps()})`)
  console.log(`  模块配置:HTTP 模式 → 服务器地址 = 本机 IP,端口 = ${PORT},URL = /scale,波特率 9600`)
  console.log(`  目标:${BASE}  deviceCode=${DEVICE} pointCode=${POINT} key=${KEY.slice(0, 3)}***`)
  if (DRY) console.log('  ⚠ --dry:只打印,不写库')
})

// UDP 8168:模块按「搜索关键字 userdata / 搜索端口 8168」找服务器时,回应本机地址
try {
  const udp = dgram.createSocket('udp4')
  udp.on('message', (msg, rinfo) => {
    const text = msg.toString('utf8')
    console.log(`\n[udp] 来自 ${rinfo.address}:${rinfo.port} ${JSON.stringify(text.slice(0, 200))}`)
    const reply = JSON.stringify({ keyword: 'userdata', ip: localIps().split(',')[0].split('=')[1] || '127.0.0.1', port: PORT })
    udp.send(reply, rinfo.port, rinfo.address)
  })
  udp.on('error', (e) => console.log('[udp] 监听失败(不致命):', e.message))
  udp.bind(UDP_PORT)
  console.log(`  UDP ${UDP_PORT} 已监听(自动发现应答)`)
} catch (e) {
  console.log('[udp] 跳过:', e.message)
}
