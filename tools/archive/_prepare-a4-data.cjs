/**
 * A4(成型工艺清单 ← 规格书 检验要求带入)测试数据准备 —— 只在测试账套 HSDZ_MES_TEST(factory=YJ_TEST)。
 *
 * 做什么:
 *   ① 产品信息表 RD_PROD_INFO:新建 + 填全 + 走两级审批归档
 *      ⚠ 实测口径:RD_PROD_INFO 在 ButtonService.ADMIN_SAVE_DEFERS_TO_FLOW 里 —— 管理员「保存」
 *        走的是**送审**(pending='Y')而**不是**"保存即归档",所以必须再点两级审批才能到「已归档」。
 *   ② 分发责任人:四个下游文件都给 cp(规格书/成型工艺清单必须 cp)
 *   ③ 规格书 RD_SPEC_DOC:新建 + 封面填全 + 明细「检验要求」三行(跌落强度/抗压强度/压降)+ 保存归档
 *   ④ 每步写操作后**读回验证**;最后实测 GET /px/specByProduct
 * 不改任何代码、不 commit。
 *
 * 用法: node tools/archive/_prepare-a4-data.cjs
 * 输出: 控制台 + tools/archive/_a4-prep/_prepare-a4.out.txt (UTF-8)
 */
const fs = require('fs')
const path = require('path')

const BASE = process.env.A4_BASE || 'http://127.0.0.1:8090'
const FACTORY = 'YJ_TEST'
const USER = 'admin'
const PASS = '123456'
const PRODUCT_CODE = 'A4TEST01'
const DEST = 'cp'

const OUTDIR = path.join(__dirname, '_a4-prep')
const OUT = path.join(OUTDIR, '_prepare-a4.out.txt')
const log = []
const p = (s) => { const t = String(s); log.push(t); console.log(t) }
const j = (o) => JSON.stringify(o)

let TOKEN = ''

async function api(method, url, body) {
  const r = await fetch(BASE + url, {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const txt = await r.text()
  let jj = null
  try { jj = JSON.parse(txt) } catch { /* 非 JSON */ }
  return { status: r.status, json: jj, text: txt }
}

async function login(userName, password, factory) {
  const r = await api('POST', '/api/auth/login', { userName, password, factory })
  if (!r.json || r.json.code !== 200 || !r.json.data || !r.json.data.token) {
    throw new Error('登录失败 HTTP ' + r.status + ' ' + r.text.slice(0, 300))
  }
  return r.json.data.token
}

/** 通用按钮动作:200 + code=200 才算成功,否则抛出后端原话 */
async function callButton(panelCode, buttonName, formData, buttonParam = {}) {
  const r = await api('POST', '/api/px/callButton', { panelCode, buttonName, formData, buttonParam })
  if (!r.json) throw new Error(`${panelCode}.${buttonName} 非 JSON 响应 HTTP ${r.status}: ${r.text.slice(0, 300)}`)
  if (r.json.code !== 200) throw new Error(`${panelCode}.${buttonName} 被拒: code=${r.json.code} msg=${r.json.message || r.json.msg || r.text.slice(0, 300)}`)
  return r.json.data
}

/** 读回:单据完整数据(走通用查询,拿到的就是库里现况) */
async function readDoc(panelCode, code) {
  const r = await api('GET', `/api/px/getFormDescriptor?panelCode=${panelCode}&code=${encodeURIComponent(code)}`)
  if (!r.json || r.json.code !== 200) return { _err: 'HTTP ' + r.status + ' ' + r.text.slice(0, 200) }
  const d = r.json.data
  return {
    单据编号: d['单据编号'] || d['编号'],
    产品编号: d['产品编号'],
    单据状态: d['单据状态'],
    detail: d.detail,
  }
}

const TODAY = new Date().toISOString().slice(0, 10)
const steps = []

function step(title, detail) { steps.push({ title, detail }); p(''); p('── ' + title + ' ──'); p(detail) }

;(async () => {
  fs.mkdirSync(OUTDIR, { recursive: true })
  TOKEN = await login(USER, PASS, FACTORY)
  p('=== A4 测试数据准备 · ' + BASE + ' · factory=' + FACTORY + ' (HSDZ_MES_TEST) · 操作人=' + USER + ' ===')
  p('目标产品编号 = ' + PRODUCT_CODE + '  分发责任人 = ' + DEST)

  // ── 前置守卫:产品编号不许撞车(specByProduct 按产品编号解析,撞了会 matched>1 干扰) ──
  const list0 = await api('POST', '/api/px/queryFormDataList', { panelCode: 'RD_PROD_INFO', pageNo: 1, pageSize: 200, condition: { 产品编号: PRODUCT_CODE } })
  const hits = (list0.json?.data?.list || []).filter((x) => String(x['产品编号'] || '').trim() === PRODUCT_CODE)
  if (hits.length) {
    p('')
    p('!! 已存在同产品编号的产品信息表,' + PRODUCT_CODE + ' 不干净,中止:' + j(hits.map((x) => [x['单据编号'], x['单据状态']])))
    fs.writeFileSync(OUT, log.join('\n'), 'utf8')
    process.exit(2)
  }
  p('前置守卫:产品编号 ' + PRODUCT_CODE + ' 无占用 ✅')

  // ══════════ 1. 产品信息表 RD_PROD_INFO ══════════
  const draft1 = await callButton('RD_PROD_INFO', '保存', {})
  const piNo = draft1['编号']
  p('')
  p('【1】产品信息表新建草稿 → ' + piNo + ' (状态 ' + draft1['单据状态'] + ')')

  const piHead = {
    编号: piNo,
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
    特殊性能描述: '除余氯效率 ≥95%，出水无异味、无黑水',
    下单数量: '1000',
    产品形态: '套网',
    责任人: '陈秀丽',
    审核人一级: '冯总',
    审核人二级: '陈秀丽',
    备注: 'A4 成型工艺清单自动带入验证用测试数据',
  }
  const save1 = await callButton('RD_PROD_INFO', '保存', { ...piHead, detail: { items: [] } })
  p('    保存 → ' + j(save1))
  const r1a = await readDoc('RD_PROD_INFO', piNo)
  p('    读回: 单据编号=' + r1a.单据编号 + ' 产品编号=' + r1a.产品编号 + ' 单据状态=' + r1a.单据状态)
  step('1a 产品信息表 保存后读回', j(r1a))

  // 一级审批通过(必须选二级审批人)
  const ap1 = await callButton('RD_PROD_INFO', '审批通过', { 编号: piNo, 二级审批人: DEST, 审批意见: 'A4 数据准备：一级审批通过' })
  p('')
  p('【1b】一级审批通过 → ' + j(ap1))
  const r1b = await readDoc('RD_PROD_INFO', piNo)
  p('     读回: 单据状态=' + r1b.单据状态)
  step('1b 一级审批通过后读回', j(r1b))

  // 二级审批通过(admin;被选定的二级审核人 cp 也能点)
  const ap2 = await callButton('RD_PROD_INFO', '审批通过', { 编号: piNo, 审批意见: 'A4 数据准备：二级审批通过' })
  p('')
  p('【1c】二级审批通过 → ' + j(ap2))
  const r1c = await readDoc('RD_PROD_INFO', piNo)
  p('     读回: 单据状态=' + r1c.单据状态)
  step('1c 二级审批通过后读回', j(r1c))

  // ══════════ 2. 分发责任人 ══════════
  const picks = { RD_SPEC_DOC: DEST, RD_MOLD_PROC: DEST, RD_ASM_PROC: DEST, RD_INSP_PLAN: DEST }
  const disp = await callButton('RD_PROD_INFO', '分发责任人', { 编号: piNo, 分发责任人: picks })
  p('')
  p('【2】分发责任人 ' + j(picks) + ' → ' + j({ already: disp.already, productCode: disp.productCode, assigns: disp.assigns, supervisor: disp.supervisor }))

  const st = await api('GET', '/api/px/rdDev/assignState?docNo=' + encodeURIComponent(piNo))
  p('    读回 /px/rdDev/assignState: ' + j(st.json && st.json.data))
  step('2 分发责任人读回(接口)', j(st.json && st.json.data))
  fs.writeFileSync(path.join(OUTDIR, '_prepare-a4.dispatch.json'), JSON.stringify(st.json && st.json.data, null, 1), 'utf8')

  // ══════════ 3. 规格书 RD_SPEC_DOC ══════════
  const draft2 = await callButton('RD_SPEC_DOC', '保存', {})
  const sdNo = draft2['编号']
  p('')
  p('【3】规格书新建草稿 → ' + sdNo + ' (状态 ' + draft2['单据状态'] + ')')

  const ITEMS = [
    { 表区: '检验要求', 序号: '1', 检验项目: '跌落强度', 检验要求: '1.2m 高度自由跌落无破损', 检验方法: '1.2m 跌落试验', 检验依据: 'YJ-Q-31' },
    { 表区: '检验要求', 序号: '2', 检验项目: '抗压强度', 检验要求: '≥ 300N 不破裂', 检验方法: '压力试验机', 检验依据: 'YJ-Q-31' },
    { 表区: '检验要求', 序号: '3', 检验项目: '压降', 检验要求: '≤ 5 kPa @ 30L/min', 检验方法: '压降测试台', 检验依据: 'YJ-Q-31' },
  ]
  const sdHead = {
    编号: sdNo,
    单据日期: TODAY,
    规格书种类: '矿化烧结炭棒',
    名称: 'A4TEST01 矿化烧结炭棒规格书',
    产品编号: PRODUCT_CODE,
    产品类别: '普通炭棒',
    客户项目名称: 'A4-测试项目',
    应用场景: '家用净水器滤芯（RO 前置）',
    客户名称: 'A4 测试客户',
    客户料号: 'KH-A4-001',
    版本: 'V1.0',
    日期: TODAY,
    制订日期: TODAY,
    审核日期: TODAY,
    批准日期: TODAY,
    适用范围: '适用于 ' + PRODUCT_CODE + ' 炭棒的生产与出货检验',
    整体规格参数: '外径 20±0.5mm、内径 5±0.3mm、长度 250±2mm',
    产品主要性能: '除余氯效率 ≥95%，压降 ≤5kPa@30L/min，抗压 ≥300N',
    炭棒处理要求: '无黑点、无破损、无颗粒物脱落',
    包装方式: '内衬 PE 袋 + 纸箱，50 支/箱',
    出货检验报告: '出货时随箱附产品出货检验报告',
    运输要求: '防潮、防挤压，常温运输',
    存储环境: '常温干燥，避免阳光直射，相对湿度 ≤60%',
    备注: 'A4 成型工艺清单自动带入验证用测试数据',
  }
  const save2 = await callButton('RD_SPEC_DOC', '保存', { ...sdHead, detail: { items: ITEMS } })
  p('    保存 → ' + j(save2))
  const r3 = await readDoc('RD_SPEC_DOC', sdNo)
  p('    读回: 单据编号=' + r3.单据编号 + ' 产品编号=' + r3.产品编号 + ' 单据状态=' + r3.单据状态)
  p('    读回明细: ' + j(r3.detail && r3.detail.items))
  step('3 规格书保存后读回(含明细)', j(r3))

  // ══════════ 4. specByProduct 实测 ══════════
  const sp = await api('GET', '/api/px/specByProduct?code=' + encodeURIComponent(PRODUCT_CODE))
  p('')
  p('【4】GET /api/px/specByProduct?code=' + PRODUCT_CODE)
  p('    → ' + j(sp.json && sp.json.data))
  step('4 specByProduct 实测', j(sp.json && sp.json.data))

  p('')
  p('=== 结果摘要 ===')
  p('产品信息表: ' + piNo + ' | 产品编号 ' + PRODUCT_CODE + ' | 状态 ' + r1c.单据状态)
  p('分发: ' + j(st.json?.data?.assigns))
  p('规格书: ' + sdNo + ' | 产品编号 ' + r3.产品编号 + ' | 状态 ' + r3.单据状态)
  p('specByProduct: found=' + (sp.json?.data?.found) + ' matched=' + (sp.json?.data?.matched) + ' 单据编号=' + (sp.json?.data?.单据编号))

  fs.writeFileSync(OUT, log.join('\n'), 'utf8')
  console.log('\nwritten ' + OUT)
})().catch((e) => {
  console.error('\n!! FAIL: ' + (e && e.message ? e.message : e))
  log.push('\n!! FAIL: ' + (e && e.stack ? e.stack : e))
  try { fs.mkdirSync(OUTDIR, { recursive: true }); fs.writeFileSync(OUT, log.join('\n'), 'utf8') } catch { /* ignore */ }
  process.exit(1)
})
