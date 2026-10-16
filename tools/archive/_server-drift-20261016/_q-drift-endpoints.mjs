/**
 * _q-drift-endpoints.mjs — 「服务器上缺哪些接口」审计(只读)
 *
 * 从后端控制器源码里抽出全部 GET 路径(类级 @RequestMapping + 方法级 @GetMapping),
 * 两边(本地 8090 / 服务器)各打一次,按状态码判定:
 *   · 本地非 404 且服务器 **404** ⇒ 该接口在服务器上不存在(功能缺失)
 *   · 两边相同 ⇒ 一致(400/403/500 都算"接口在",只是参数/权限/数据不对)
 *
 * 用法: node tools/archive/_server-drift-20261016/_q-drift-endpoints.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const LOCAL = 'http://127.0.0.1:8090', REMOTE = 'http://36.140.66.163:8090'
const ROOT = 'backend/src/main/java/com/yinjia/mes'

const files = []
;(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p)
    else if (n.endsWith('.java')) files.push(p)
  }
})(ROOT)

const paths = new Set()
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  const cls = /@RequestMapping\("([^"]*)"\)/.exec(src)?.[1]
  if (cls === undefined) continue
  for (const m of src.matchAll(/@GetMapping\("([^"]*)"\)/g)) {
    let p = (cls + m[1]).replace(/\/{2,}/g, '/')
    if (!p.startsWith('/')) p = '/' + p
    if (!p.startsWith('/api')) p = '/api' + p
    paths.add(p.replace(/\{[^}]+\}/g, '1'))   // 路径变量统一填 1
  }
}
const list = [...paths].sort()
console.log(`控制器 GET 路径 ${list.length} 条;两边各打一次 …\n`)

const login = async (b) => (await (await fetch(b + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()).data.token
const [tl, tr] = [await login(LOCAL), await login(REMOTE)]
const status = async (base, token, p) => {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000)
    const r = await fetch(base + p, { headers: { Authorization: 'Bearer ' + token }, signal: ctl.signal })
    clearTimeout(t)
    return r.status
  } catch { return 'ERR' }
}
const run = async (items, fn, conc = 8) => { const out = []; let i = 0; await Promise.all(Array.from({ length: conc }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]) } })); return out }
const [ls, rs] = await Promise.all([run(list, (p) => status(LOCAL, tl, p), 6), run(list, (p) => status(REMOTE, tr, p), 6)])

const missing = [], same = []
list.forEach((p, i) => {
  if (ls[i] !== 404 && rs[i] === 404) missing.push({ p, local: ls[i] })
  else if (ls[i] === rs[i]) same.push(p)
})
console.log('════ 接口差集 ════')
console.log(`  两边状态码一致: ${same.length} / ${list.length}`)
console.log(`  ❌ 本地有、服务器 404(接口缺失): ${missing.length}`)
missing.forEach((m) => console.log(`     · ${m.p.padEnd(52)} 本地 ${m.local} / 服务器 404`))
const other = list.filter((p, i) => ls[i] !== rs[i] && !(ls[i] !== 404 && rs[i] === 404))
console.log(`  ⚠ 状态码不同但两边都在(参数/权限/数据差异): ${other.length}`)
other.slice(0, 25).forEach((p) => { const i = list.indexOf(p); console.log(`     · ${p.padEnd(52)} 本地 ${ls[i]} / 服务器 ${rs[i]}`) })
