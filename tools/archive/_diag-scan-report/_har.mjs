#!/usr/bin/env node
/**
 * HAR 分析器(零依赖):把浏览器导出的 .har 按「时间线 + 耗时 + 阻塞/排队」摊开,
 * 专治「页面白屏/转圈但后端日志什么都没有」这类问题。
 *
 * 用法: node tools/archive/_diag-scan-report/_har.mjs <x.har> [--all]
 *   默认打印:汇总 + 最慢 12 条 + 时间线(前 60 条);--all 打印全部。
 */
import fs from 'node:fs'

const file = process.argv[2]
const all = process.argv.includes('--all')
if (!file) { console.error('用法: node _har.mjs <x.har> [--all]'); process.exit(1) }
const h = JSON.parse(fs.readFileSync(file, 'utf8'))
const es = (h.log && h.log.entries) || []
if (!es.length) { console.log('HAR 里没有 entries'); process.exit(0) }

const t0 = new Date(es[0].startedDateTime).getTime()
const rows = es.map((e) => {
  const t = e.timings || {}
  const url = e.request.url.replace(/^https?:\/\/[^/]+/, '')
  return {
    off: (new Date(e.startedDateTime).getTime() - t0) / 1000,
    ms: Math.round(e.time),
    m: e.request.method,
    url,
    host: (e.request.url.match(/^https?:\/\/([^/]+)/) || [])[1] || '',
    st: e.response.status,
    kb: Math.round(((e.response.content && e.response.content.size) || 0) / 1024),
    blocked: Math.round(t.blocked || 0),
    dns: Math.round(t.dns || 0),
    conn: Math.round(t.connect || 0),
    ssl: Math.round(t.ssl || 0),
    send: Math.round(t.send || 0),
    wait: Math.round(t.wait || 0),
    recv: Math.round(t.receive || 0),
    ip: e.serverIPAddress || '',
    proto: (e.response.httpVersion || '') + ' ' + (e.response.headers || []).find((x) => /^connection$/i.test(x.name))?.value,
  }
})

const span = (rows[rows.length - 1].off + rows[rows.length - 1].ms / 1000).toFixed(1)
console.log(`文件=${file}`)
console.log(`条目=${rows.length}  跨度=${span}s  主机=${[...new Set(rows.map((r) => r.host))].join(',')}`)
const byStatus = {}
for (const r of rows) byStatus[r.st] = (byStatus[r.st] || 0) + 1
console.log('状态分布:', JSON.stringify(byStatus))

const slow = [...rows].sort((a, b) => b.ms - a.ms).slice(0, 12)
console.log('\n== 最慢 12 条(ms / 起点 / 状态 / 分解) ==')
for (const r of slow) {
  console.log(`${String(r.ms).padStart(6)}ms  +${r.off.toFixed(2)}s  ${r.st}  ${r.m} ${r.url.slice(0, 64)}` +
    `  [blocked=${r.blocked} conn=${r.conn} ssl=${r.ssl} send=${r.send} wait=${r.wait} recv=${r.recv}]`)
}

// 长空档:相邻请求起点间隔 > 3s 的地方打出来(说明当时页面在等/人在操作)
const gaps = []
for (let i = 1; i < rows.length; i++) {
  const g = rows[i].off - (rows[i - 1].off + rows[i - 1].ms / 1000)
  if (g > 3) gaps.push({ gap: g.toFixed(1), before: rows[i - 1].url.slice(0, 50), after: rows[i].url.slice(0, 50) })
}
console.log(`\n== 长空档(>3s)${gaps.length} 处 ==`)
for (const g of gaps.slice(0, 10)) console.log(`  ${g.gap}s 空隙:${g.before} → ${g.after}`)

const n = all ? rows.length : 60
console.log(`\n== 时间线(前 ${n} 条) ==`)
for (const r of rows.slice(0, n)) {
  console.log(`${r.off.toFixed(2).padStart(7)}s ${String(r.ms).padStart(6)}ms ${String(r.st).padStart(4)} ${String(r.kb).padStart(5)}KB ${r.m} ${r.url.slice(0, 78)}`)
}
