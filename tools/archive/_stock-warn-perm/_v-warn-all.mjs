/**
 * _v-warn-all.mjs — 验「按钮栏·统一预警」全量接口 POST /api/stock/warn/setAllData(测试账套)
 *
 * 覆盖(用户 2026-10-15 当日改口径「统一预警是对所有数据的,要放在按钮栏那里,点击给弹窗」):
 *   ① 管理员:GET monthClose/detail 记下目标键「预警」map(改前);
 *   ② 管理员:POST /api/stock/warn/setAllData {warnQty:7}(不带 ckdm = **所有数据**)→ 记更新行数;
 *   ③ 再取 detail:确认目标键**每个批次都变 7**(全量口径落到了该键的每一批);
 *   ④ 管理员:POST {warnQty:0} 恢复 → 记更新行数;再取 detail 确认回落;
 *   ⑤ 普通账号 cp(有面板可见权、无 warn 词)调同一接口 → 期望 HTTP 403;
 *   ⑥ 管理员:GET /api/px/getPanelConfig?panelCode=STOCK_DETAIL → 贴 buttonGroups 原文。
 *
 * ⚠ ②④ 是**全量**写(整张 kucun),故:
 *   - 跑前先存 `_snap-warn-test.sql` 的快照(`_snap-warn-test_before.txt`,只含非 0 行);
 *   - 跑完用 `_restore-warn-test.sql` 把那几行按原值恢复(见本轮任务报告)。
 *
 * 用法:node tools/archive/_stock-warn-perm/_v-warn-all.mjs
 * 证据同时写 `_v-warn-all.log.json`(UTF-8;控制台中文可能被本机代码页搞乱,以该文件为准)。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const API = process.env.YINJIA_API || 'http://127.0.0.1:8090'
const WZ = process.argv[2] || 'YJ-SX-043'
const CK = process.argv[3] || 'CK00006'
const PERIOD = process.argv[4] || '2026-10'
const dir = path.dirname(fileURLToPath(import.meta.url))

const ev = []                       // 证据(写文件用,UTF-8 安全)
const say = (s) => { ev.push(s); console.log(s) }

const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return { raw: t.slice(0, 400) } } }
async function login(user) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: user, password: '123456', factory: 'YJ_TEST' }),
  })
  const b = await j(r)
  return { http: r.status, token: b?.data?.token, isAdmin: b?.data?.user?.isAdmin, warnPanels: b?.data?.user?.warnPanels, body: b }
}

const admin = await login('admin')
say(`[登录] admin(YJ_TEST) http=${admin.http} isAdmin=${admin.isAdmin} warnPanels=${JSON.stringify(admin.warnPanels)}`)
if (!admin.token) { say('登录失败,终止:' + JSON.stringify(admin.body)); fs.writeFileSync(path.join(dir, '_v-warn-all.log.json'), JSON.stringify(ev, null, 2), 'utf8'); process.exit(1) }
const H = { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' }

const detailUrl = `${API}/api/stock/monthClose/detail?period=${encodeURIComponent(PERIOD)}&wzdm=${encodeURIComponent(WZ)}&ckdm=${encodeURIComponent(CK)}`
const warnMap = async () => (await j(await fetch(detailUrl, { headers: H })))?.data?.['预警']
const dump = async (label) => {
  const m = await warnMap()
  const pairs = Object.entries(m || {}).map(([k, v]) => `${k || '(空批次)'}=${v}`)
  const allEq = (x) => pairs.length > 0 && Object.values(m || {}).every((v) => Number(v) === x)
  say(`[${label}] 预警 map 原文 = ${JSON.stringify(m)}`)
  say(`[${label}] 逐批 = ${pairs.join('  ')}  ⇒ 批次数=${pairs.length}`)
  return { m, pairs, allEq }
}

say(`目标键:物料 ${WZ} / 仓库 ${CK} / 期间 ${PERIOD}`)
const before = await dump('改前')

const post = async (p, body, headers = H) => {
  const r = await fetch(`${API}${p}`, { method: 'POST', headers, body: JSON.stringify(body) })
  return { http: r.status, body: await j(r) }
}

say('')
say('=== ② 全量写:POST /api/stock/warn/setAllData {warnQty:7}(不带 ckdm) ===')
const r7 = await post('/api/stock/warn/setAllData', { warnQty: 7, panel: 'STOCK_DETAIL' })
say(`HTTP ${r7.http} 响应原文 = ${JSON.stringify(r7.body)}`)
const n7 = r7.body?.data?.['更新行数']
const after7 = await dump('全量=7 之后')
say(`⇒ 目标键每一批都=7 ? ${after7.allEq(7)}   更新行数 ${n7}`)

say('')
say('=== ④ 恢复:POST /api/stock/warn/setAllData {warnQty:0} ===')
const r0 = await post('/api/stock/warn/setAllData', { warnQty: 0, panel: 'STOCK_DETAIL' })
say(`HTTP ${r0.http} 响应原文 = ${JSON.stringify(r0.body)}`)
const n0 = r0.body?.data?.['更新行数']
const after0 = await dump('恢复=0 之后')
say(`⇒ 目标键每一批都=0 ? ${after0.allEq(0)}   更新行数 ${n0}`)

say('')
say('=== ③b 带 ckdm 的作用域口径(只刷该仓库):setAllData {warnQty:5, ckdm:"' + CK + '"} 然后立刻恢复 ===')
const r5 = await post('/api/stock/warn/setAllData', { warnQty: 5, ckdm: CK, panel: 'STOCK_DETAIL' })
say(`HTTP ${r5.http} 响应原文 = ${JSON.stringify(r5.body)}`)
const after5 = await dump(`仓库=${CK} 全量=5 之后`)
const r5b = await post('/api/stock/warn/setAllData', { warnQty: 0, ckdm: CK, panel: 'STOCK_DETAIL' })
say(`恢复(该仓库) HTTP ${r5b.http} 响应原文 = ${JSON.stringify(r5b.body)}`)
const after5b = await dump('该仓库恢复=0 之后')

say('')
say('=== ⑤ 普通账号 cp(无 warn 词)调全量接口 → 期望 403 ===')
const cp = await login('cp')
say(`[登录] cp(YJ_TEST) http=${cp.http} isAdmin=${cp.isAdmin} warnPanels=${JSON.stringify(cp.warnPanels)}`)
if (cp.token) {
  const cpTry = await post('/api/stock/warn/setAllData', { warnQty: 9, panel: 'STOCK_DETAIL' },
    { Authorization: `Bearer ${cp.token}`, 'Content-Type': 'application/json' })
  say(`cp POST /api/stock/warn/setAllData → HTTP ${cpTry.http} 响应原文 = ${JSON.stringify(cpTry.body)}`)
  const cpKey = await (async () => {
    const r = await fetch(detailUrl, { headers: { Authorization: `Bearer ${cp.token}` } })
    return { http: r.status, body: await j(r) }
  })()
  say(`cp 复查目标键(确认没被写进去)HTTP ${cpKey.http} 预警 map = ${JSON.stringify(cpKey.body?.data?.['预警'])}`)
} else {
  say('cp 登录失败(跳过 403 用例):' + JSON.stringify(cp.body))
}

say('')
say('=== ⑥ 工具条按钮组:GET /api/px/getPanelConfig?panelCode=STOCK_DETAIL ===')
const cfg = await j(await fetch(`${API}/api/px/getPanelConfig?panelCode=STOCK_DETAIL`, { headers: H }))
const groups = cfg?.data?.buttonGroups ?? cfg?.data?.metadata?.buttonGroups ?? cfg?.buttonGroups
say(`buttonGroups 原文 = ${JSON.stringify(groups)}`)
say(`⇒ 是否出现「统一预警」组 ? ${JSON.stringify(groups)?.includes('统一预警')}`)

fs.writeFileSync(path.join(dir, '_v-warn-all.log.json'), JSON.stringify({
  api: API, at: new Date().toISOString(), 目标: { wz: WZ, ck: CK, period: PERIOD },
  改前: before.m, 全量7: { http: r7.http, resp: r7.body, after: after7.m, 全部为7: after7.allEq(7) },
  恢复0: { http: r0.http, resp: r0.body, after: after0.m, 全部为0: after0.allEq(0) },
  单仓库5: { http: r5.http, resp: r5.body, after: after5.m, 全部为5: after5.allEq(5) },
  单仓库恢复: { http: r5b.http, resp: r5b.body, after: after5b.m },
  cp403: { login: { http: cp.http, isAdmin: cp.isAdmin, warnPanels: cp.warnPanels } },
  buttonGroups: groups,
}, null, 2), 'utf8')
say('')
say(`证据已写 ${path.join(dir, '_v-warn-all.log.json')}`)
