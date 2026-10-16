/**
 * _q-drift-server-vs-local.mjs — 「服务器 vs 本地」功能漂移审计(只读)
 *
 * 两条腿,都能对到「哪个功能没上线」:
 *   A. 面板元数据差集:拿本地库 yj_panel 的面板清单,逐个问两边 /px/getPanelConfig,
 *      比对「面板在不在」「字段数差多少」—— 面板缺失/字段落后=功能没上线或元数据陈旧。
 *   B. 前端文案差集:把两边 8090 下发的全部 JS/CSS 抓下来,抽中文串做集合差
 *      —— **本地有、服务器没有**的中文串就是"服务器上还看不到的新功能文案"。
 *
 * 用法: node tools/archive/_server-drift-20261016/_q-drift-server-vs-local.mjs [--local http://127.0.0.1:8090] [--remote http://36.140.66.163:8090] [--db HSDZ_MES]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d }
const LOCAL = arg('local', 'http://127.0.0.1:8090').replace(/\/$/, '')
const REMOTE = arg('remote', 'http://36.140.66.163:8090').replace(/\/$/, '')
const DB = arg('db', 'HSDZ_MES')

const login = async (base, factory) => {
  const r = await (await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', ...(factory ? { factory } : {}) }),
  })).json()
  if (r?.code !== 200) throw new Error(`${base} 登录失败: ${JSON.stringify(r).slice(0, 120)}`)
  return r.data.token
}

/* ───────── A. 面板元数据差集 ───────── */
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const panels = (await pool.request().query('SELECT panel_code, ISNULL(panel_name, \'\') AS panel_name, ISNULL(mode, \'\') AS mode FROM yj_panel ORDER BY panel_code')).recordset
await pool.close()
console.log(`本地库 ${DB}:面板 ${panels.length} 个\n`)

const [tLocal, tRemote] = [await login(LOCAL), await login(REMOTE)]
const cfgOf = async (base, token, code) => {
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 15000)
    const r = await fetch(`${base}/api/px/getPanelConfig?panelCode=${encodeURIComponent(code)}`, { headers: { Authorization: 'Bearer ' + token }, signal: ctl.signal })
    clearTimeout(t)
    const j = await r.json().catch(() => null)
    const md = j?.data?.metadata
    const tp = md?.panelPageDto?.tablePages?.[0] || {}
    const fields = tp.formFields || md?.panelData?.metadata?.fields || []
    const labels = fields.map((f) => String(f.dataName || '').trim()).filter(Boolean).sort()
    const tabs = (tp.gridTabs || []).map((g) => String(g.key || g.label || '')).sort()
    return { code: j?.code ?? r.status, name: md?.panelName || '', fields: fields.length, labels, tabs }
  } catch (e) { return { code: 'ERR', err: String(e.message || e).slice(0, 40) } }
}

/** 档案面板的「明细键」实测:取一行看 detail 下那个键叫什么(2026-10-16 配方候选恒空的根因就是它) */
const detailKeyOf = async (base, token, code) => {
  try {
    const r = await fetch(`${base}/api/px/queryFormDataList`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ panelCode: code, condition: {}, pageNo: 1, pageSize: 1 }),
    })
    const j = await r.json().catch(() => null)
    const row = j?.data?.list?.[0]
    const keys = row?.detail ? Object.keys(row.detail) : []
    return { code: j?.code, detailKeys: keys, total: j?.data?.totalSize ?? null }
  } catch (e) { return { code: 'ERR', detailKeys: [], err: String(e.message || e).slice(0, 30) } }
}
const run = async (items, fn, conc = 8) => {
  const out = []; let i = 0
  await Promise.all(Array.from({ length: conc }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]) }
  }))
  return out
}
const [lCfg, rCfg] = await Promise.all([
  run(panels, (p) => cfgOf(LOCAL, tLocal, p.panel_code)),
  run(panels, (p) => cfgOf(REMOTE, tRemote, p.panel_code)),
])

const missing = [], fewer = [], labelDrift = [], tabDrift = []
panels.forEach((p, i) => {
  const l = lCfg[i], r = rCfg[i]
  const lOk = l?.code === 200, rOk = r?.code === 200
  if (lOk && !rOk) missing.push({ code: p.panel_code, name: p.panel_name, remote: r?.code })
  else if (lOk && rOk) {
    if ((r.fields || 0) < (l.fields || 0) - 2) fewer.push({ code: p.panel_code, name: p.panel_name, local: l.fields, remote: r.fields })
    const ls = new Set(l.labels || []), rs = new Set(r.labels || [])
    const onlyL = [...ls].filter((x) => !rs.has(x)), onlyR = [...rs].filter((x) => !ls.has(x))
    if (onlyL.length || onlyR.length) labelDrift.push({ code: p.panel_code, name: p.panel_name, onlyLocal: onlyL, onlyRemote: onlyR })
    if (JSON.stringify(l.tabs) !== JSON.stringify(r.tabs)) tabDrift.push({ code: p.panel_code, name: p.panel_name, local: l.tabs, remote: r.tabs })
  }
})
console.log('════ A. 面板元数据 ════')
console.log(`  面板 ${panels.length} 个;两边都在且字段数相当: ${panels.length - missing.length - fewer.length} 个`)
console.log(`  ❌ 本地有、服务器读不到: ${missing.length} 个`)
missing.slice(0, 30).forEach((m) => console.log(`     · ${m.code.padEnd(24)} ${m.name}  (服务器 ${JSON.stringify(m.remote)})`))
console.log(`  ⚠ 服务器字段更少: ${fewer.length} 个`)
fewer.slice(0, 30).forEach((m) => console.log(`     · ${m.code.padEnd(24)} ${m.name}  本地 ${m.local} / 服务器 ${m.remote}`))
console.log(`  ⚠ 字段名不一致(本地有/服务器有): ${labelDrift.length} 个面板`)
labelDrift.slice(0, 20).forEach((m) => console.log(`     · ${m.code.padEnd(20)} 仅本地 ${JSON.stringify(m.onlyLocal.slice(0, 4))} 仅服务器 ${JSON.stringify(m.onlyRemote.slice(0, 4))}`))
console.log(`  ⚠ 页签键不一致: ${tabDrift.length} 个面板`)
tabDrift.slice(0, 15).forEach((m) => console.log(`     · ${m.code.padEnd(20)} 本地 ${JSON.stringify(m.local)} / 服务器 ${JSON.stringify(m.remote)}`))

/* A2. 档案「明细键」实测(配方候选恒空那一类 bug 的全量排查) */
const [lDet, rDet] = await Promise.all([
  run(panels, (p) => detailKeyOf(LOCAL, tLocal, p.panel_code), 6),
  run(panels, (p) => detailKeyOf(REMOTE, tRemote, p.panel_code), 6),
])
const keyDrift = []
panels.forEach((p, i) => {
  const l = lDet[i], r = rDet[i]
  const lk = (l?.detailKeys || []).join(','), rk = (r?.detailKeys || []).join(',')
  if (l?.code === 200 && r?.code === 200 && lk && rk && lk !== rk) keyDrift.push({ code: p.panel_code, name: p.panel_name, local: lk, remote: rk, total: `${l.total}/${r.total}` })
})
console.log(`\n  ★★ 明细键不一致(正是「配方计算候选恒空」那类 bug 的温床): ${keyDrift.length} 个面板`)
keyDrift.slice(0, 40).forEach((m) => console.log(`     · ${m.code.padEnd(20)} ${String(m.name).slice(0, 14).padEnd(14)} 本地 detail.${m.local} / 服务器 detail.${m.remote}  行数 ${m.total}`))

/* ───────── B. 前端文案差集 ───────── */
async function collectText(base) {
  const html = await (await fetch(base + '/')).text()
  const seen = new Set(), texts = []
  const queue = [...new Set([...html.matchAll(/assets\/[\w.\-]+\.(?:js|css)/g)].map((m) => m[0]))]
  for (let depth = 0; depth < 3 && queue.length; depth++) {
    const batch = queue.splice(0, queue.length)
    for (const p of batch) {
      if (seen.has(p)) continue
      seen.add(p)
      let body = ''
      try { body = await (await fetch(`${base}/${p}`)).text() } catch { continue }
      texts.push(body)
      if (depth < 2) for (const m of body.matchAll(/assets\/[\w.\-]+\.(?:js|css)/g)) if (!seen.has(m[0])) queue.push(m[0])
    }
  }
  return { files: seen.size, text: texts.join('\n') }
}
const cjk = (s) => new Set([...s.matchAll(/[\u4e00-\u9fa5][\u4e00-\u9fa5、，。：；（）%·\-0-9A-Za-z]{1,40}/g)].map((m) => m[0].trim()).filter((x) => x.length >= 2))
const [L, R] = await Promise.all([collectText(LOCAL), collectText(REMOTE)])
const ls = cjk(L.text), rs = cjk(R.text)
const onlyLocal = [...ls].filter((s) => !rs.has(s))
const onlyRemote = [...rs].filter((s) => !ls.has(s))
console.log('\n════ B. 前端文案(8090 下发产物)════')
console.log(`  本地 chunk ${L.files} 个 / 中文串 ${ls.size} 条`)
console.log(`  服务器 chunk ${R.files} 个 / 中文串 ${rs.size} 条`)
console.log(`  ★ 只有本地有(服务器上还看不到)= ${onlyLocal.length} 条`)
console.log(`  ☆ 只有服务器有(本地没有)      = ${onlyRemote.length} 条`)
if (onlyRemote.length) console.log(`     例: ${onlyRemote.slice(0, 12).map((x) => x.slice(0, 22)).join(' | ')}`)

/* C. 同面板的**数据行数**差(功能一致、数据不同 —— 服务器是公司真实账,本地是开发/演示账) */
console.log('\n════ C. 数据行数差(两边都读得到的前 18 个)════')
const dataDiff = panels.map((p, i) => ({ code: p.panel_code, name: p.panel_name, l: lDet[i]?.total, r: rDet[i]?.total }))
  .filter((x) => typeof x.l === 'number' && typeof x.r === 'number' && x.l !== x.r)
  .sort((a, b) => Math.abs((b.r || 0) - (b.l || 0)) - Math.abs((a.r || 0) - (a.l || 0)))
console.log(`  行数不同的面板 ${dataDiff.length} 个(方向:本地 → 服务器)`)
dataDiff.slice(0, 18).forEach((x) => console.log(`     · ${x.code.padEnd(20)} ${String(x.name).slice(0, 12).padEnd(12)} ${x.l} → ${x.r}`))
const bucket = {}
for (const s of onlyLocal) {
  const k = ['区间', '配方', '首件', '月结', '报工', '检验', '库存', '看板', '审批', '弃审', '分发', '规格书', '工单', '排产', '导出'].find((x) => s.includes(x)) || '其它'
  ;(bucket[k] = bucket[k] || []).push(s)
}
console.log('  —— 只有本地有的,按关键字聚类 ——')
for (const [k, arr] of Object.entries(bucket).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  【${k}】${arr.length} 条,例: ${arr.slice(0, 6).map((x) => x.slice(0, 24)).join(' | ')}`)
}
export {}
