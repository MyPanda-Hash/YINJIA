// 对照「研发 · 实验室使用记录表」四个面板:服务器(36.140.66.163:8090,正式库 YJ)vs 本机(127.0.0.1:8090)
// 只读:登录 + getNewFormPermMatrix,不写任何数据。
import fs from 'node:fs'

const PANELS = {
  RD_SPIKE_WATER: '加标水配置记录表',
  RD_DOM_TEST: '测试申请单',
  RD_EQUIP_USE: '设备使用登记表',
  RD_INSTR_USE: '仪器使用记录表',
}

async function login(base) {
  const r = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const j = await r.json()
  const token = j?.data?.token
  if (!token) throw new Error(`login failed @${base}: ${JSON.stringify(j).slice(0, 200)}`)
  return token
}

async function meta(base, token, panelCode) {
  const r = await fetch(`${base}/api/px/getNewFormPermMatrix?panelCode=${encodeURIComponent(panelCode)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const j = await r.json()
  if (j?.code !== 200) throw new Error(`meta ${panelCode} @${base}: ${j?.message}`)
  return j.data
}

const fieldsOf = (m) => {
  const header = (m?.meta || m?.metaFields || []).map((f) => f.label || f.field || f.key)
  const tabs = m?.detail?.tabs || []
  const detail = tabs.flatMap((t) => (t.fields || []).map((f) => f.label || f.field || f.key))
  return { header, detail, tabTitles: tabs.map((t) => t.title) }
}

function cmp(name, a, b) {
  const A = a || [], B = b || []
  const onlySrv = A.filter((x) => !B.includes(x))
  const onlyLoc = B.filter((x) => !A.includes(x))
  const orderSame = A.join('|') === B.join('|')
  return { name, srvCount: A.length, locCount: B.length, onlySrv, onlyLoc, orderSame }
}

const SRV = 'http://36.140.66.163:8090'
const LOC = 'http://127.0.0.1:8090'
const tSrv = await login(SRV)
const tLoc = await login(LOC)
const out = {}
for (const [code, title] of Object.entries(PANELS)) {
  const s = await meta(SRV, tSrv, code)
  const l = await meta(LOC, tLoc, code)
  const sf = fieldsOf(s)
  const lf = fieldsOf(l)
  out[code] = {
    title,
    srv: sf,
    loc: lf,
    header: cmp(title + ' / 表头', sf.header, lf.header),
    detail: cmp(title + ' / 明细', sf.detail, lf.detail),
    tabs: { srv: sf.tabTitles, loc: lf.tabTitles },
  }
  fs.writeFileSync(`.tmp/panelcmp/${code}.srv.json`, JSON.stringify(s, null, 2), 'utf8')
  fs.writeFileSync(`.tmp/panelcmp/${code}.loc.json`, JSON.stringify(l, null, 2), 'utf8')
}
fs.writeFileSync('.tmp/panelcmp/report.json', JSON.stringify(out, null, 2), 'utf8')

for (const [code, r] of Object.entries(out)) {
  console.log(`\n=== ${code} ${r.title} ===`)
  for (const k of ['header', 'detail']) {
    const c = r[k]
    const flag = c.orderSame && !c.onlySrv.length && !c.onlyLoc.length ? 'SAME' : 'DIFF'
    console.log(`  ${c.name}: ${flag}  服务器 ${c.srvCount} 字段 / 本机 ${c.locCount} 字段  (顺序${c.orderSame ? '一致' : '不同'})`)
    if (c.onlySrv.length) console.log(`    仅服务器: ${c.onlySrv.join(' , ')}`)
    if (c.onlyLoc.length) console.log(`    仅本机  : ${c.onlyLoc.join(' , ')}`)
  }
  console.log(`  页签: 服务器 ${JSON.stringify(r.tabs.srv)} / 本机 ${JSON.stringify(r.tabs.loc)}`)
}
