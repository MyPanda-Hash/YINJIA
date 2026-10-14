/**
 * A4 数据准备 · 补正 RD_PROD_INFO 三格(全是**载荷键写错导致被 labelsToCols 丢弃**,不是后端问题):
 *   主要性能描述   ← col 特殊性能描述(界面标签是「主要性能描述」,我第一版按 col 名发了)
 *   产品负责人     ← col 责任人(界面标签是「产品负责人」)
 *   审核人（一级审批人）/ 审核人（二级审批人） ← col 审核人一级/审核人二级
 *   追加:编辑人 / 下单数量 / 炭棒尺寸 / 产品分类
 *
 * 为什么不能"只保存一次":RD_PROD_INFO 在 ADMIN_SAVE_DEFERS_TO_FLOW 里 —— 已归档单再点保存
 * 会回到「审批中」,必须重走一级(选二级审批人)→ 二级 才回到「已归档」。本脚本把三步连做。
 *
 * 用法: node tools/archive/_a4-prep/_prepare-a4-fix.cjs
 */
const fs = require('fs')
const path = require('path')

const BASE = process.env.A4_BASE || 'http://127.0.0.1:8090'
const PRODUCT_CODE = 'A4TEST01'
const DEST = 'cp'
const PI_NO = process.env.A4_PI_NO || 'PI-2026-10-0019'
const OUTDIR = path.join(__dirname)
const OUT = path.join(OUTDIR, '_prepare-a4-fix.out.txt')
const log = []
const p = (s) => { const t = String(s); log.push(t); console.log(t) }
const j = (o) => JSON.stringify(o)

let TOKEN = ''
async function api(method, url, body) {
  const r = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const txt = await r.text()
  let jj = null
  try { jj = JSON.parse(txt) } catch { /* 非 JSON */ }
  return { status: r.status, json: jj, text: txt }
}
async function callButton(panelCode, buttonName, formData, buttonParam = {}) {
  const r = await api('POST', '/api/px/callButton', { panelCode, buttonName, formData, buttonParam })
  if (!r.json) throw new Error(`${panelCode}.${buttonName} 非 JSON HTTP ${r.status}: ${r.text.slice(0, 300)}`)
  if (r.json.code !== 200) throw new Error(`${panelCode}.${buttonName} 被拒: code=${r.json.code} msg=${r.json.message || r.json.msg || ''} ${r.text.slice(0, 200)}`)
  return r.json.data
}

;(async () => {
  const lg = await api('POST', '/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ_TEST' })
  TOKEN = lg.json.data.token
  const TODAY = new Date().toISOString().slice(0, 10)

  const head = {
    编号: PI_NO,
    单据日期: TODAY,
    产品编号: PRODUCT_CODE,
    产品名称: 'A4测试炭棒',
    客户项目名称: 'A4-测试项目',
    客户料号: 'KH-A4-001',
    产品管控等级: '重点产品',
    产品功能类别: '除余氯',
    产品类别: '普通炭棒',
    产品类型: '成品',
    产品分类: '重点产品',
    产品整体尺寸: 'φ20×250mm',
    炭棒尺寸: '5*20*250',
    炭棒内径: '5.0',
    炭棒外径: '20.0',
    炭棒长度: '250',
    主要性能描述: '除余氯效率 ≥95%，出水无异味、无黑水',
    下单数量: '1000',
    产品形态: '套网',
    编辑人: '系统管理员',
    产品负责人: '陈秀丽',
    '审核人（一级审批人）': '冯总',
    '审核人（二级审批人）': '陈秀丽',
    备注: 'A4 成型工艺清单自动带入验证用测试数据',
  }

  p('【1】保存(带正确的中文标签键)')
  const s1 = await callButton('RD_PROD_INFO', '保存', { ...head, detail: { items: [] } })
  p('    → ' + j(s1))
  p('【2】一级审批通过(二级审批人=' + DEST + ')')
  const s2 = await callButton('RD_PROD_INFO', '审批通过', { 编号: PI_NO, 二级审批人: DEST, 审批意见: 'A4 数据准备：一级审批通过' })
  p('    → ' + j(s2))
  p('【3】二级审批通过')
  const s3 = await callButton('RD_PROD_INFO', '审批通过', { 编号: PI_NO, 审批意见: 'A4 数据准备：二级审批通过' })
  p('    → ' + j(s3))

  fs.writeFileSync(OUT, log.join('\n'), 'utf8')
  console.log('written ' + OUT)
})().catch((e) => {
  console.error('!! FAIL: ' + (e && e.message ? e.message : e))
  log.push('!! FAIL: ' + (e && e.stack ? e.stack : e))
  fs.writeFileSync(OUT, log.join('\n'), 'utf8')
  process.exit(1)
})
