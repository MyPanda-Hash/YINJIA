/*
 * _verify-sched-keyword-row.mjs — 快速排产「关键字」支持「工单号#行号」精确到行(2026-10-15)
 *
 * 【用户报障】「当前勾选单一工单号+行号的一条单据,同样会显示全部的相同工单号的在快速排产内筛选」
 *   —— 快速排产的关键字原来只按 工单号 模糊匹配,输入一个工单号必然带出该单**所有行**;
 *      从生产工单页勾**某一行**点「排产」弹出的内嵌快速排产也只传 工单号 ⇒ 同样列全部行。
 *
 * 【口径】用户 2026-10-15:「工单号+工单行号确定当前唯一工单,各个工单的进程,流程追溯都这样实现,
 *   都需要这两个进行确定。」
 *
 * 【验什么】关键字写 `工单号#行号`(支持全角 ＃、# 两侧空格)时,待排产/已排产**只出这一行**;
 *   普通关键字(工单号/批次号)仍是模糊匹配(不回归)。
 *
 * 只读接口,不写业务数据。用法: node tools/archive/_verify-sched-keyword-row.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
// 生产工单 GD-2026-10-0002:8 行,行7 已排产(其余行未排产)—— 正好两种列表都能验
const WO = 'GD-2026-10-0002'
const XC = 7
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
const api = async (p, b) => fetch(`${BASE}/api${p}`, { method: 'POST', headers: H, body: JSON.stringify(b ?? {}) }).then((x) => x.json())
const xcs = (rows) => [...new Set((rows || []).map((r) => Number(r['工单行号'])))].sort((a, b) => a - b)
const nos = (rows) => [...new Set((rows || []).map((r) => String(r['加工单号'])))]

// ── ① 待排产:普通关键字(工单号)仍是模糊 —— 会带出该单多行(既有行为,不回归) ──
console.log(`\n── ① 待排产:普通关键字(不回归) ──`)
const broad = (await api('/px/scheduleBoard/pending', { keyword: WO })).data || []
console.log(`    keyword="${WO}" → ${broad.length} 行,行号=${JSON.stringify(xcs(broad))}`)
ok('① 普通关键字仍按工单号模糊匹配(不回归)', broad.length >= 1 && broad.every((r) => String(r['加工单号']) === WO),
  JSON.stringify(nos(broad)))

// ── ② 待排产:`工单号#行号` 只出这一行 ──
console.log(`\n── ② 待排产:工单号#行号 精确到行 ──`)
for (const kw of [`${WO}#3`, `${WO}＃3`, `${WO} # 3`]) {
  const rows = (await api('/px/scheduleBoard/pending', { keyword: kw })).data || []
  console.log(`    keyword="${kw}" → ${rows.length} 行,行号=${JSON.stringify(xcs(rows))}`)
  ok(`② "${kw}" 只出第 3 行(恰 1 行且行号=3)`,
    rows.length === 1 && Number(rows[0]['工单行号']) === 3, JSON.stringify(xcs(rows)))
}

// ── ③ 待排产:不存在的行号 → 空(不再退化成"列全部行") ──
console.log(`\n── ③ 待排产:不存在的行号 ──`)
const none = (await api('/px/scheduleBoard/pending', { keyword: `${WO}#99` })).data || []
console.log(`    keyword="${WO}#99" → ${none.length} 行`)
ok('③ 不存在的行号返回空(不退化成整单)', none.length === 0, JSON.stringify(xcs(none)))

// ── ④ 已排产:同样支持「工单号#行号」 ──
console.log(`\n── ④ 今日已排产(全部):同样支持 ──`)
const tAll = (await api('/px/scheduleBoard/today', { mode: 'all', keyword: `${WO}#${XC}` })).data || []
const tBroad = (await api('/px/scheduleBoard/today', { mode: 'all', keyword: WO })).data || []
console.log(`    keyword="${WO}#${XC}" → ${tAll.length} 行,行号=${JSON.stringify(xcs(tAll))}`)
console.log(`    keyword="${WO}"    → ${tBroad.length} 行,行号=${JSON.stringify(xcs(tBroad))}`)
ok(`④ 已排产 "工单号#行号" 只出第 ${XC} 行`,
  tAll.length === 1 && Number(tAll[0]['工单行号']) === XC, JSON.stringify(xcs(tAll)))
ok('④ 普通关键字仍出多行(对照,不回归)', tBroad.length >= 1, JSON.stringify(xcs(tBroad)))

// ── ⑤ 「限定行id」通道已按用户口径回退(2026-10-15):待排产只认关键字,不再收行id 列表 ──
console.log(`\n── ⑤ 限定行id 已回退(排产一次只勾一行,不需要行集合通道) ──`)
const poolAll = (await api('/px/scheduleBoard/pending', { keyword: WO })).data || []
const two = poolAll.slice(0, 2)
if (two.length === 2) {
  const ids = two.map((r) => r['行id'])
  // 传了也不认:结果应与"只传 keyword"完全一致(证明该入参已不再是筛选项)
  const lim = (await api('/px/scheduleBoard/pending', { keyword: WO, 限定行id: ids })).data || []
  console.log(`    传 限定行id=${JSON.stringify(ids)} + keyword="${WO}" → ${lim.length} 行(不传时 ${poolAll.length} 行)`)
  ok('⑤ 限定行id 已被忽略(不再参与筛选)', lim.length === poolAll.length,
    `传=${lim.length} 不传=${poolAll.length}`)
}

console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
