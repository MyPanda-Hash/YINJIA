/**
 * _q-served-build.mjs — 「这个实例下发的到底是哪一版前端」的取证脚本(改前端后必跑)。
 *
 * 背景(2026-10-04 报障):8090 是 `java -jar target\yinjia-mes-backend-0.1.0.jar`,
 * 前端是**打包进 jar** 的 BOOT-INF/classes/static —— 源码改了、vite(5173) 立即生效,
 * 但 8090 那份还是上次 packaging 时的旧包,于是"面板数据是空的"依旧存在。
 * 本脚本列出该实例首页引用的 chunk,并在 chunk 里查本次改动的关键字,一眼看出新旧。
 *
 * 用法:node tools/archive/_probe-qc-insp-carry/_q-served-build.mjs [http://host:port] [--api]
 */
import fs from 'node:fs'

const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const WITH_API = process.argv.includes('--api')
const KEYS = ['带入检验要求', 'qc_insp_req', 'detail.items', '暂无数据']

const html = await (await fetch(`${BASE}/`)).text()
const entry = [...html.matchAll(/assets\/[^"']+\.js/g)].map((m) => m[0])
console.log(`== ${BASE} 首页引用 ==\n  ${entry.join('\n  ')}`)

// 本地构建(仓库内)的 chunk 名,用于对照是否同版
for (const p of ['backend/src/main/resources/static/index.html', 'frontend/dist/index.html']) {
  if (!fs.existsSync(p)) continue
  const h = fs.readFileSync(p, 'utf8')
  console.log(`  仓库 ${p} → ${[...h.matchAll(/assets\/[^"']+\.js/g)].map((m) => m[0]).slice(0, 1)}`)
}

// 首页 chunk 引出的所有 chunk(含 PanelxList 等按需块),逐个查关键字
const seen = new Set()
async function scan(paths, depth = 0) {
  for (const p of paths) {
    if (seen.has(p)) continue
    seen.add(p)
    const js = await (await fetch(`${BASE}/${p.replace(/^\//, '')}`)).text()
    const hits = KEYS.filter((k) => js.includes(k))
    if (hits.length) console.log(`  ${p.padEnd(44)} ${String(js.length).padStart(8)}B  ${hits.join(', ')}`)
    if (depth < 1) {
      const more = [...new Set([...js.matchAll(/assets\/[\w.\-]+\.js/g)].map((m) => m[0]))]
      await scan(more, depth + 1)
    }
  }
}
await scan(entry)

if (WITH_API) {
  const login = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login?.data?.token
  const res = await (await fetch(`${BASE}/api/px/queryFormDataList`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ panelCode: 'QC_INSP_REQ', pageNo: 1, pageSize: 1, condition: {} }),
  })).json()
  const detail = res?.data?.list?.[0]?.detail || {}
  const k = Object.keys(detail)[0]
  console.log(`\n== 接口 ==\ndetail 键 = ${JSON.stringify(Object.keys(detail))}, 行数 = ${Array.isArray(detail[k]) ? detail[k].length : '?'}`)
}
