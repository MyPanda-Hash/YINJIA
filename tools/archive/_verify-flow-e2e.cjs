// _verify-flow-e2e.cjs — 全链验证(2026-09-17 修复后):
// ①生单日期=创建当日不继承(源单故意回填 2026-09-01);②单价沿链流转到入库单与退料单。
// 链:PU_ORDER(09-01,单价12.5)→审核→生单SL_RECV→审核→生单QC_INSP→填合格/不良→审核
//    →断言 PURCHASE_IN/QC_RETURN 草稿 头日期=今天+行单价=12.5。末尾全链清理。
const BASE = 'http://127.0.0.1:8090/api'
let TOKEN
const H = () => ({ Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' })
const post = async (u, b) => fetch(BASE + u, { method: 'POST', headers: H(), body: JSON.stringify(b) }).then(r => r.json())
const today = () => new Date().toISOString().slice(0, 10)
let FAIL = 0
const ok = (cond, label) => { console.log((cond ? '  ✓ ' : '  ✗ ') + label); if (!cond) FAIL++ }
const rowsOf = (r) => (r?.detail && (r.detail.items || r.detail[Object.keys(r.detail)[0]])) || []

async function findDoc(panel, no) {
  const list = await post('/px/queryFormDataList', { panelCode: panel, pageNo: 1, pageSize: 10, keyword: no })
  return ((list.data && list.data.list) || []).find(r => String(r['编号']) === no || String(r['单据编号']) === no) || null
}
async function btn(panel, name, no) {
  const r = await post('/px/callButton', { panelCode: panel, buttonName: name, formData: { 编号: no } })
  if (r.code !== 200) console.log('  [btn]', panel, name, '→', String(r.message).slice(0, 160))
  return r
}

async function main() {
  const login = await post('/auth/login', { userName: 'admin', password: '123456' })
  TOKEN = login.data.token
  console.log('今天:', today())

  // ── 1) 采购订单:旧日期 09-01 + 单价 12.5 ──
  const pu = await post('/px/callButton', {
    panelCode: 'PU_ORDER', buttonName: '保存',
    formData: { 单据编号: '', 单据日期: '2026-09-01', 供应商: 'E2E流程验证', 供应商编码: 'E2E-SUP',
      detail: { items: [{ 物料编码: 'E2E-FLOW-1', 物料名称: '流程验证料', 数量: 100, 计量单位: '件', 单价: 12.5 }] } },
  })
  if (pu.code !== 200) return console.log('PU 保存失败:', JSON.stringify(pu).slice(0, 200))
  const puNo = pu.data['编号']
  console.log('1) 采购订单草稿:', puNo, '(单据日期故意=2026-09-01)')
  if ((await btn('PU_ORDER', '审核', puNo)).code !== 200) return

  // ── 2) 生单 → 送料暂收单 ──
  const sl = await btn('PU_ORDER', '生成送料暂收单', puNo)
  if (sl.code !== 200) return
  const slNo = sl.data['编号']
  const slDoc = await findDoc('SL_RECV', slNo)
  console.log('2) 送料暂收单:', slNo)
  ok(String(slDoc?.['日期'] || slDoc?.['单据日期'] || '') === today(), `SL_RECV 头日期=${slDoc?.['日期'] || slDoc?.['单据日期']} = 今天(不继承 09-01)`)
  ok(Number(rowsOf(slDoc)[0]?.['单价']) === 12.5, `SL_RECV 行单价=${rowsOf(slDoc)[0]?.['单价']}`)
  if ((await btn('SL_RECV', '审核', slNo)).code !== 200) return

  // ── 3) 生单 → 来料检验单 ──
  const ij = await btn('SL_RECV', '生成来料检验单', slNo)
  if (ij.code !== 200) return
  const ijNo = ij.data['编号']
  const ijDoc = await findDoc('QC_INSP', ijNo)
  console.log('3) 来料检验单:', ijNo)
  ok(String(ijDoc?.['日期'] || ijDoc?.['单据日期'] || '') === today(), `QC_INSP 头日期=${ijDoc?.['日期'] || ijDoc?.['单据日期']} = 今天`)
  ok(Number(rowsOf(ijDoc)[0]?.['单价']) === 12.5, `QC_INSP 行单价=${rowsOf(ijDoc)[0]?.['单价']}`)

  // ── 4) 填合格/不良 → 审核(自动生成入库+退料) ──
  const items = rowsOf(ijDoc).map(l => ({ ...l, 合格数量: 90, 不良数量: 10 }))
  const fill = await post('/px/callButton', {
    panelCode: 'QC_INSP', buttonName: '保存',
    formData: { ...ijDoc, 单据编号: ijNo, 日期: '2026-09-01', detail: { items } },
  })
  if (fill.code !== 200) return console.log('检验单回填失败:', String(fill.message).slice(0, 200))
  // 再改头日期为旧值验证镜像不覆盖——直接 UPDATE 不做,保持简单;重点验下游
  if ((await btn('QC_INSP', '审核', ijNo)).code !== 200) return

  // ── 5) 断言下游两单 ──
  const piDoc = await findDoc('PURCHASE_IN', String(fill.data?.['入库单号'] || '') || (await findDoc('PURCHASE_IN', ijNo))?.['编号'])
  // 入库单号回填在检验行上;经 来源单号 找更稳
  const piList = await post('/px/queryFormDataList', { panelCode: 'PURCHASE_IN', pageNo: 1, pageSize: 10, keyword: ijNo })
  const pi = ((piList.data && piList.data.list) || []).find(r => String(r['来源单号'] || '') === ijNo) || piDoc
  console.log('4) 采购入库单:', pi?.['编号'])
  ok(String(pi?.['单据日期'] || '') === today(), `PURCHASE_IN 头日期=${pi?.['单据日期']} = 今天`)
  ok(Number(rowsOf(pi)[0]?.['单价']) === 12.5, `PURCHASE_IN 行单价=${rowsOf(pi)[0]?.['单价']}`)

  const thList = await post('/px/queryFormDataList', { panelCode: 'QC_RETURN', pageNo: 1, pageSize: 10, keyword: 'E2E流程验证' })
  const th = ((thList.data && thList.data.list) || [])[0] || null
  console.log('5) 暂收退料单:', th?.['编号'])
  ok(!!th, '退料单已生成')
  if (th) {
    ok(String(th['日期'] || th['单据日期'] || '') === today(), `QC_RETURN 头日期=${th['日期'] || th['单据日期']} = 今天`)
    ok(Number(rowsOf(th)[0]?.['单价']) === 12.5, `QC_RETURN 行单价=${rowsOf(th)[0]?.['单价']}`)
  }

  // ── 6) 清理(下游→上游:弃审+删) ──
  console.log('── 清理 ──')
  for (const [panel, no] of [['QC_RETURN', th?.['编号']], ['PURCHASE_IN', pi?.['编号']]]) {
    if (!no) continue
    await post('/px/deleteForms', { panelCode: panel, rowCodes: [no] }).then(r => console.log('  删', panel, no, r.code))
  }
  await btn('QC_INSP', '弃审', ijNo)
  await post('/px/deleteForms', { panelCode: 'QC_INSP', rowCodes: [ijNo] }).then(r => console.log('  删检验单', r.code))
  await btn('SL_RECV', '弃审', slNo)
  await post('/px/deleteForms', { panelCode: 'SL_RECV', rowCodes: [slNo] }).then(r => console.log('  删暂收单', r.code))
  await btn('PU_ORDER', '弃审', puNo)
  await post('/px/deleteForms', { panelCode: 'PU_ORDER', rowCodes: [puNo] }).then(r => console.log('  删采购订单', r.code))

  console.log(FAIL === 0 ? '\n★ 全部断言通过' : `\n★★ ${FAIL} 项断言失败`)
  process.exit(FAIL === 0 ? 0 : 1)
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
