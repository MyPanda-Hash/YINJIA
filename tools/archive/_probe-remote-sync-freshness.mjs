/**
 * _probe-remote-sync-freshness.mjs —— 服务器 jdy-sync(金蝶 ERP 同步)存活与数据新鲜度探针
 *
 * 用途:全量部署(用开发机库覆盖服务器库)之前/之后,判断服务器上是否有"会被覆盖掉的
 * 真实 ERP 业务数据",以及 ERP 同步是否仍在自动运行(决定覆盖后能否自动补齐)。
 *
 * 只读:仅登录 + 查询销售订单列表,不写任何东西。
 * 用法:node tools/archive/_probe-remote-sync-freshness.mjs [--base http://x.x.x.x:8090]
 */
'use strict'

const args = process.argv.slice(2)
const baseArg = args.indexOf('--base')
const BASE = baseArg >= 0 ? args[baseArg + 1] : 'http://36.140.66.163:8090'

async function login() {
  const r = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  if (!r?.data?.token) throw new Error('登录失败: ' + JSON.stringify(r?.message || r))
  return r.data.token
}

async function query(token, panelCode, pageSize = 20) {
  const r = await (await fetch(`${BASE}/api/px/queryFormDataList`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ panelCode, keyword: '', pageNo: 1, pageSize, condition: {} }),
  })).json()
  const d = r?.data
  return d?.rows || d?.list || []
}

const run = async () => {
  console.log(`目标: ${BASE}`)
  const token = await login()
  console.log('  登录 OK\n')

  for (const panel of ['SO_ORDER', 'PU_ORDER']) {
    const rows = await query(token, panel)
    console.log(`▼ ${panel}  (前 ${rows.length} 行)`)
    if (!rows.length) { console.log('    (无数据)\n'); continue }
    for (const row of rows) {
      const no = row['单据编号'] ?? ''
      const created = row['创建时间'] ?? ''
      const docDate = row['单据日期'] ?? ''
      const customer = row['客户'] ?? row['供应商'] ?? ''
      const erp = row['外部数据ID'] ? 'ERP' : '手录'
      console.log(`   ${String(no).padEnd(22)} 单据日期=${String(docDate).padEnd(12)} 创建=${String(created).padEnd(20)} ${erp}  ${customer}`)
    }
    console.log('')
  }

  console.log(`本机当前时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}`)
  console.log('判读:若最新"创建时间"就在最近几分钟内 ⇒ 服务器 jdy-sync 仍在每 5 分钟自动跑,')
  console.log('      被全量覆盖后 ERP 数据会自动回灌;若停在某个较旧时刻 ⇒ 同步任务已停,覆盖即真丢。')
}

run().catch((e) => { console.error('探针失败: ' + e.message); process.exit(1) })
