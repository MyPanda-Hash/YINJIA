/**
 * _scale-tcp-probe.cjs — 直连 W111 模块 TCP 口抓电子秤数据(2026-10-19)
 *
 * 现场标签:WIFI 名称 W111 / IP 192.168.4.1 / 端口号 8010
 * ⇒ 模块是「AP + TCP 服务端」:电脑连上 W111 的 WiFi 后,用 TCP 客户端连 192.168.4.1:8010,
 *   模块把电子秤串口吐出来的字节原样转发给所有连上来的客户端。
 *
 * 本脚本做三件事:
 *   ① 连上去,收到的每个字节都打出来(ASCII + HEX),第一次接线靠它看清帧格式;
 *   ② 顺手按常见计价秤格式解析重量(ST/US/wn/裸数字),命中了就打印解析值;
 *   ③ 加 --push 时,把解析到的重量转发到 MES 数采(/api/dc/ingest,带 X-DC-Key)。
 *
 * 用法:
 *   node tools/archive/_dc-scale-live-20261019/_scale-tcp-probe.cjs                     # 192.168.4.1:8010 只看
 *   node tools/archive/_dc-scale-live-20261019/_scale-tcp-probe.cjs --push               # 解析到就写库
 *   node tools/archive/_dc-scale-live-20261019/_scale-tcp-probe.cjs --host 192.168.23.50 --port 8010
 */
const net = require('node:net')

const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name)
  if (i < 0) return def
  const v = process.argv[i + 1]
  return v && !v.startsWith('--') ? v : true
}
const HOST = arg('host', '192.168.4.1')
const PORT = Number(arg('port', 8010))
const PUSH = !!arg('push', false)
const BASE = arg('base', 'http://127.0.0.1:8090')
const DEVICE = arg('device', 'DZ-001')
const POINT = arg('point', 'W01')
const KEY = arg('key', 'scale-demo-2026')

/** 天翊/JIANKUN DZ-06 实测帧(2026-10-19 现场):
 *    +000.39000.00kg   = 净重 +000.39、皮重 000.00、单位 kg、CRLF
 *  即「符号+净重6位」紧跟「皮重6位」再跟 kg,中间**没有分隔符** —— 故先按这个格式精确匹配,
 *  匹配不到再退回通用的「第一个带小数点的数」(兼容 ST,GS / wn+00.52kg 等其它机型)。
 */
function parseWeight(text) {
  const s = String(text).trim()
  const exact = s.match(/^([+-]?\d{1,4}\.\d{1,2})([+-]?\d{1,4}\.\d{1,2})?\s*(?:kg|KG|g|G)?$/)
  if (exact) {
    const v = Number(exact[1])
    if (Number.isFinite(v)) return v
  }
  const norm = s.replace(/\+/g, ' ')
  let m = norm.match(/(\d{1,4}\.\d{1,3})/)
  if (!m) m = norm.match(/(?<=[,\s])(\d{1,4})(?=\s*(?:kg|KG|g|G)?\s*$)/)
  if (!m) return null
  const v = Number(m[1])
  return Number.isFinite(v) ? v : null
}

async function pushWeight(kg) {
  const res = await fetch(BASE + '/api/dc/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-DC-Key': KEY },
    body: JSON.stringify({ deviceCode: DEVICE, values: [{ pointCode: POINT, value: kg }] }),
  })
  return { status: res.status, body: (await res.text()).slice(0, 160) }
}

const hex = (buf) => buf.toString('hex').replace(/(..)/g, '$1 ').trim()

let lines = 0
let buf = ''
const sock = net.createConnection({ host: HOST, port: PORT }, () => {
  console.log(`[tcp] 已连接 ${HOST}:${PORT}(模块会把秤的串口字节转发过来)`)
  console.log('[tcp] 现在往秤上放东西,观察输出;Ctrl+C 结束')
  if (PUSH) console.log(`[tcp] --push 开启:解析到重量就写 MES (${DEVICE}/${POINT})`)
})
sock.setEncoding('binary')
sock.on('data', async (chunk) => {
  const b = Buffer.from(chunk, 'binary')
  const text = b.toString('utf8')
  console.log(`\n[recv] ${b.length} bytes  ascii=${JSON.stringify(text.slice(0, 120))}`)
  console.log(`        hex=${hex(b).slice(0, 200)}`)
  buf += text
  if (buf.length > 4096) buf = buf.slice(-2048)
  const parts = buf.split(/\r\n|\n|\r/)
  if (parts.length > 1) {
    buf = parts.pop()
    for (const line of parts) {
      if (!line.trim()) continue
      lines++
      const kg = parseWeight(line)
      console.log(`  frame #${lines} [${line.trim()}] → ${kg === null ? '未解析' : kg + ' kg'}`)
      if (kg !== null && PUSH) {
        try {
          const r = await pushWeight(kg)
          console.log(`  → MES ${r.status} ${r.body}`)
        } catch (e) {
          console.log('  → 上报失败:', e.message)
        }
      }
    }
  }
})
sock.on('error', (e) => {
  console.log(`[tcp] 连接失败:${e.message}`)
  console.log('  排查:电脑是否连着 W111 的 WiFi(密码 12345678)?模块状态页 1A 是否 TCPS?端口是否 8010?')
})
sock.on('close', () => console.log('[tcp] 连接已关闭'))
