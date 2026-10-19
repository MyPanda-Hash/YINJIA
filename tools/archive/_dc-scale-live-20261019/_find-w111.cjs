/**
 * _find-w111.cjs — 在办公网里找 W111 模块的 IP(2026-10-19)
 *
 * 模块标签 MAC = EC:C9:FF:17:F8:20(状态页显示 ECC9FF17F820)。
 * 先并发探 192.168.23.1-254 的 80/8010 端口,再读 ARP 表按 MAC 前缀定位;
 * 没读到 MAC 就退回「探测有响应的 IP」列表,逐个打开 80 端口确认是不是 W111 后台。
 *
 * 用法:node tools/archive/_dc-scale-live-20261019/_find-w111.cjs [网段前缀，默认 192.168.23]
 */
const net = require('node:net')
const { execSync } = require('node:child_process')

const PREFIX = process.argv[2] || '192.168.23'
const PORTS = [8010, 80]
const TIMEOUT = 700

function probe(host, port) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port })
    const done = (ok) => { try { s.destroy() } catch {} ; resolve(ok) }
    s.setTimeout(TIMEOUT)
    s.on('connect', () => done(true))
    s.on('timeout', () => done(false))
    s.on('error', () => done(false))
  })
}

;(async () => {
  const hosts = []
  for (let i = 1; i <= 254; i++) hosts.push(`${PREFIX}.${i}`)
  console.log(`扫描 ${PREFIX}.1-254 的 ${PORTS.join('/')} 端口 ...`)
  const found = []
  const chunk = 60
  for (let i = 0; i < hosts.length; i += chunk) {
    const slice = hosts.slice(i, i + chunk)
    const res = await Promise.all(slice.map(async (h) => {
      for (const p of PORTS) if (await probe(h, p)) return { host: h, port: p }
      return null
    }))
    for (const r of res) if (r) found.push(r)
  }
  console.log('开放端口的主机:', found.length ? JSON.stringify(found) : '(无)')

  let arp = ''
  try { arp = execSync('arp -a', { encoding: 'utf8' }) } catch {}
  const hit = arp.split(/\r?\n/).filter((l) => /ec-c9-ff|ec:c9:ff/i.test(l))
  if (hit.length) {
    console.log('ARP 里的模块(MAC EC:C9:FF:17:F8:20):')
    hit.forEach((l) => console.log('  ' + l.trim()))
  } else {
    console.log('ARP 表里没有该 MAC(模块可能还没连上路由器,或还没被本机 ARP 到)')
  }
  for (const f of found) {
    if (f.port !== 80) continue
    try {
      const r = await fetch(`http://${f.host}/`, { signal: AbortSignal.timeout(2000) })
      const t = await r.text()
      console.log(`${f.host}:80 → ${r.status} ${/W111/i.test(t) ? '[W111 后台 ✓]' : '(非 W111)'} ${t.slice(0, 60).replace(/\s+/g, ' ')}`)
    } catch (e) { console.log(`${f.host}:80 → ${e.message}`) }
  }
})()
