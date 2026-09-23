/**
 * _probe-remote-data-inventory.mjs —— 服务器业务数据盘点(只读)
 *
 * 目的:全量部署(开发机库覆盖服务器库)之前,数清服务器上到底有哪些业务单据会被覆盖。
 * 做法:逐面板查 total,并抓取最新一张单据编号/日期/创建时间。
 * 用法:node tools/archive/_probe-remote-data-inventory.mjs [--base http://x.x.x.x:8090]
 */
'use strict'

const args = process.argv.slice(2)
const baseArg = args.indexOf('--base')
const BASE = baseArg >= 0 ? args[baseArg + 1] : 'http://36.140.66.163:8090'

const PANELS = [
  ['SO_ORDER', '销售订单'], ['PU_ORDER', '采购订单'], ['PURCHASE_IN', '采购入库单'],
  ['PRODUCT_IN', '产成品入库单'], ['MATERIAL_OUT', '材料出库单'], ['SALE_OUT', '销售出库单'],
  ['WO_ORDER', '生产工单'], ['QC_RECV', '报检单'], ['QC_INSP', '检验单'],
  ['RD_PROD_INFO', '产品信息表'], ['RD_APPROVAL', '立项申请'], ['RD_PLAN', '项目实施计划'],
  ['RD_CHANGE', '产品变更申请单'], ['KUCUN', '库存状况'],
]

async function login() {
  const r = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  if (!r?.data?.token) throw new Error('登录失败: ' + JSON.stringify(r?.message || r))
  return r.data.token
}

async function q(token, panelCode, pageSize = 3) {
  try {
    const r = await (await fetch(`${BASE}/api/px/queryFormDataList`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ panelCode, keyword: '', pageNo: 1, pageSize, condition: {} }),
    })).json()
    if (r?.code !== 200) return { total: 'n/a(' + (r?.message || r?.code) + ')', rows: [] }
    const d = r.data
    return { total: d?.total ?? (d?.rows || d?.list || []).length, rows: d?.rows || d?.list || [] }
  } catch (e) {
    return { total: 'ERR ' + e.message, rows: [] }
  }
}

const run = async () => {
  console.log(`目标: ${BASE}\n`)
  const token = await login()
  console.log('面板编码'.padEnd(16) + '名称'.padEnd(18) + '总行数'.padEnd(10) + '最新单据')
  console.log('-'.repeat(96))
  for (const [code, name] of PANELS) {
    const { total, rows } = await q(token, code)
    const latest = rows[0]
    const no = latest?.['单据编号'] ?? latest?.['产品编号'] ?? ''
    const created = latest?.['创建时间'] ?? latest?.['单据日期'] ?? ''
    console.log(String(code).padEnd(16) + String(name).padEnd(16) + String(total).padEnd(10) + `${no} ${created}`)
  }
  console.log(`\n本机当前时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}`)
}

run().catch((e) => { console.error('探针失败: ' + e.message); process.exit(1) })
