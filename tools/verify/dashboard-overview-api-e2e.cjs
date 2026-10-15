/**
 * 探针(API 层):我的桌面「概览」口径不变量(2026-10-15)
 * ① KPI 三数同源自洽:moActive + moDone == moTotal,且 = plang 真值
 * ② 事件流真的有数据(后端原为硬编码空列表)
 * ③ 生产趋势窗口提示需要"工单数据截至"的日期
 */
const API = process.env.YINJIA_API || 'http://127.0.0.1:8090/api'
const FACTORY = process.env.YINJIA_FACTORY || 'YJ_TEST'
let fails = 0
const chk = (id, name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} [${id}] ${name}${detail === undefined ? '' : '  → ' + detail}`)
  if (!ok) fails++
}

async function main() {
  const lr = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
  })
  const tok = (await lr.json())?.data?.token
  if (!tok) throw new Error('登录失败')
  const d = (await (await fetch(API + '/dashboard/stats', { headers: { Authorization: 'Bearer ' + tok } })).json()).data
  const k = d.kpis || {}
  const latest = d.latest || []
  const prod = d.production || {}

  console.log(`[现状] kpis=${JSON.stringify(k)}`)
  console.log(`       latest=${latest.length} 条  production.lastDate=${prod.lastDate ?? '(缺)'}  statusDist=${JSON.stringify(prod.statusDist)}`)

  const active = Number(k.moActive || 0), done = Number(k.moDone || 0), total = Number(k.moTotal || 0)

  // ① 三数同源自洽(修前:48 / 0 / 缺 → 卡片自相矛盾)
  chk('O1', 'kpis.moTotal = 工单总数(plang 25),不再是恒 0', total === 25, `moTotal=${total}`)
  chk('O2', 'kpis.moActive = 在产工单(25),不再是全系统草稿数 48', active === 25, `moActive=${active}`)
  chk('O3', 'kpis.moDone 存在 = 已完工(0)', k.moDone !== undefined && done === 0, `moDone=${k.moDone}`)
  chk('O4', '三数自洽:在产 + 已完工 == 总数(卡片内部不再打架)',
    active + done === total, `${active} + ${done} = ${active + done} vs ${total}`)
  chk('O5', '闭环率分母不再恒 0(total > 0)', total > 0, `分母=${total}`)

  // ② 事件流:后端原为 out.put("latest", List.of()) 硬编码空
  chk('O6', 'latest 非空(事件流不再是死卡片)', latest.length > 0, `${latest.length} 条`)
  const bad = latest.filter((e) => !e['编号'] || !e.panel || !e['状态'] || !e['时间'])
  chk('O7', '每条事件含 编号/panel/状态/时间 四要素', latest.length > 0 && bad.length === 0,
    bad.length ? JSON.stringify(bad.slice(0, 2)) : JSON.stringify(latest[0]))
  chk('O8', '事件按时间倒序(最新的在最前)',
    latest.length < 2 || String(latest[0]['时间']) >= String(latest[latest.length - 1]['时间']),
    `${latest[0]?.['时间']} … ${latest[latest.length - 1]?.['时间']}`)

  // ③ 趋势窗口提示
  chk('O9', 'production.lastDate 存在(供"近 7 天无新增"时说明数据截至)',
    !!prod.lastDate, prod.lastDate)

  console.log('')
  if (fails === 0) console.log('[PASS] 概览口径不变量全部满足')
  else { console.log(`[FAIL] ${fails} 项不符`); process.exit(1) }
}
main().catch((e) => { console.error('FATAL ' + e.message); process.exit(1) })
