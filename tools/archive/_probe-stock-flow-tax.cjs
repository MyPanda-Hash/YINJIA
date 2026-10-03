'use strict'
/**
 * _probe-stock-flow-tax.cjs — 任务 7 验收探针:流水表 inh/outh 补 含税金额/税额 两列,
 * 且 v_stock_movement 透传(不再恒 NULL),库存台账面板 STOCK_LEDGER 这两列要有值。
 *
 * ⚠ 只在**测试账套**(HSDZ_MES_TEST / 登录工厂 YJ_TEST)造数,正式库一行不动;跑完清理干净。
 *
 * 断言(8 组):
 *   ① 迁移就位:inh/outh 两表各有 含税金额/税额 列(改前必红)
 *   ② 采购入库单(src=1)审核后:inh 两列有值,且 == 「单据口径」
 *      (含税金额 = bl_purchase_in.含税金额;税额 = 含税金额 − ISNULL(金额, 单价×实收数量),即原视图的反推口径)
 *   ③ v_stock_movement 这两列**不再恒 NULL**(直接查视图,不是查流水表)
 *   ④ 销售出库单(src=5)审核后:outh 两列有值,且 == 单据口径(含税销售金额 / 税额 两列原样)
 *   ⑤ 库存台账面板口径:POST /px/queryFormDataList(STOCK_LEDGER) 返回的行里这两列有值
 *   ⑥ 勾稽不受影响:流水净额 == v_stock_balance 现存量合计 == kucun 余量合计
 *   ⑦ 清理:单据/流水/单据状态/审批/成本行残留 0,kucun 逐行回到原值
 *   ⑧ 全库勾稽回到基线(15939.0000),成本表回到基线行数与金额
 *
 * 用法: node tools/archive/_probe-stock-flow-tax.cjs [http://127.0.0.1:8090]
 */
const { execFileSync } = require('node:child_process')

const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api'
const DB = 'HSDZ_MES_TEST'                       // 只碰测试账套
let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  → ' + e : ''}`)) }
// -I:QUOTED_IDENTIFIER ON —— inh/outh 上有**过滤索引**,DML 在 QUOTED_IDENTIFIER OFF 下会报 1934
const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', DB, '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-f', '65001', '-I', '-Q', `SET NOCOUNT ON; ${q}`], { encoding: 'utf8' }).trim()
/** 容错查询:改前列不存在时不让探针炸掉(要看到"红",而不是"报错中断") —— 红阶段也要跑完并清理 */
const q0 = (q) => { try { return sql(q) } catch (e) { return '⛔SQLERR ' + String(e.message).split(/\r?\n/).filter(Boolean)[0] } }
const num = (q) => { const v = q0(q); return v.startsWith('⛔') ? NaN : Number(v || 0) }
const today = new Date().toISOString().slice(0, 10)

async function main() {
  const lr = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('测试账套登录失败: ' + JSON.stringify(lr).slice(0, 200))
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token }
  const call = async (panelCode, buttonName, formData) => (await (await fetch(`${API}/px/callButton`, {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData: formData || {}, buttonParam: {} }),
  })).json())
  const post = async (path, body) => (await (await fetch(API + path, { method: 'POST', headers: H, body: JSON.stringify(body) })).json())

  // ── 靶子 ──
  const wh = sql("SELECT TOP 1 仓库名称 FROM bs_wh WHERE ISNULL(状态,N'启用')=N'启用' ORDER BY 仓库编码;")
  const whCode = sql(`SELECT TOP 1 仓库编码 FROM bs_wh WHERE 仓库名称 = N'${wh}' AND ISNULL(状态,N'启用')=N'启用' ORDER BY 仓库编码;`)
  const inv = sql("SELECT TOP 1 存货编码 FROM bs_inv WHERE ISNULL(状态,N'启用')=N'启用' ORDER BY 存货编码;")
  const stamp = Date.now().toString(36).toUpperCase()
  const sup = '探针供应商' + stamp   // 供应商在采购入库单上只是文本列(不校验档案),用唯一值便于识别本探针造的单
  const lot = 'TAXPROBE-' + stamp          // 批号(手制单无批次键 ⇒ assignBatchNoOnInbound 跳过,批号不会被改成入库日期)
  const QTY = 100, PRICE = 10             // 采购:金额 1000
  const TAX_AMT = 1130                    // 采购含税金额(税率 13%)⇒ 反推税额 130
  const OUT_QTY = 40, SALE_AMT = 500      // 销售:销售金额 500
  const SALE_TAX_AMT = 565, SALE_TAX = 65 // 销售含税销售金额 / 税额
  console.log(`靶子: 仓库=${wh}(${whCode}) 存货=${inv} 批号=${lot} 数量=${QTY} 含税金额=${TAX_AMT}`)

  // ── 基线与口径函数 ──
  const kucunSnapshot = () => sql("SELECT ISNULL(wzdm,'')+'|'+ISNULL(ckdm,'')+'|'+ISNULL(lot_no,'(null)')+'|'+CAST(CAST(yl AS decimal(18,4)) AS varchar(30)) FROM kucun ORDER BY wzdm, ckdm, lot_no;")
  const costSnapshot = () => sql("SELECT CAST(COUNT(*) AS varchar(10)) + ' 行 / 收入金额合计 ' + CAST(CAST(ISNULL(SUM(收入金额),0) AS decimal(18,4)) AS varchar(30)) FROM inv_cost_ledger;")
  const ylSum = () => num("SELECT ISNULL(SUM(yl),0) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y';")
  const balSum = () => num("SELECT ISNULL(SUM(现存量),0) FROM v_stock_balance;")
  const movNet = () => num("SELECT ISNULL(SUM(收入数量),0) - ISNULL(SUM(发出数量),0) FROM v_stock_movement;")

  const kucun0 = kucunSnapshot(), cost0 = costSnapshot()
  const yl0 = ylSum(), bal0 = balSum(), mov0 = movNet()
  console.log(`基线: kucun ${yl0} / balance ${bal0} / 流水净额 ${mov0} / 成本表 ${cost0}`)
  if (kucunSnapshot().includes(lot)) throw new Error('批号 ' + lot + ' 已存在,换一个再跑(避免污染既有结存)')

  // 清理:软删留痕的行要物理清掉,免得测试账套越跑越脏(只按本探针的单据编号/批号删)
  const DOC_TBLS = { PURCHASE_IN: ['bd_purchase_in', 'bl_purchase_in'], SALE_OUT: ['bd_sale_out', 'bl_sale_out'],
    FINISH_IN: ['bd_finish_in', 'bl_finish_in'] }   // FINISH_IN 只作 ⑨ 的"无值段"对照靶单
  const cleanup = (no, panel) => {
    const [h, d] = DOC_TBLS[panel]
    return sql(`DELETE FROM inh WHERE 单据编号 = N'${no}';
       DELETE FROM outh WHERE 单据编号 = N'${no}';
       DELETE FROM ${d} WHERE 单据编号 = N'${no}';
       DELETE FROM ${h} WHERE 单据编号 = N'${no}';
       DELETE FROM yj_doc_status WHERE panel_code = '${panel}' AND doc_no = N'${no}';
       DELETE FROM yj_form_approval WHERE panel_code = '${panel}' AND form_no = N'${no}';`)
  }
  const leftovers = (no, panel) => {
    const [h, d] = DOC_TBLS[panel]
    return num(`SELECT (SELECT COUNT(*) FROM inh WHERE 单据编号 = N'${no}')`
      + ` + (SELECT COUNT(*) FROM outh WHERE 单据编号 = N'${no}')`
      + ` + (SELECT COUNT(*) FROM ${h} WHERE 单据编号 = N'${no}')`
      + ` + (SELECT COUNT(*) FROM ${d} WHERE 单据编号 = N'${no}')`
      + ` + (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = '${panel}' AND doc_no = N'${no}')`
      + ` + (SELECT COUNT(*) FROM yj_form_approval WHERE panel_code = '${panel}' AND form_no = N'${no}');`)
  }

  let piNo = '', soNo = '', fiNo = '', piAudited = false, soAudited = false, fiAudited = false
  let lot2 = ''   // ⑨ 对照靶单的批号(必须在 try 外声明:finally 里的清理要用它)
  try {
    // ───────── ① 迁移就位 ─────────
    console.log('\n=== ① 迁移就位:inh/outh 是否有 含税金额/税额 两列 ===')
    const colOf = (t, c) => q0(`SELECT ISNULL(CAST(COL_LENGTH('dbo.${t}', N'${c}') AS varchar(10)),'(缺)');`)
    const idetail = q0("SELECT ISNULL(ty.name,'(缺)')+ISNULL('('+CAST(c.precision AS varchar(4))+','+CAST(c.scale AS varchar(4))+')','')+CASE WHEN c.is_nullable=1 THEN ' NULL' ELSE ' NOT NULL' END FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.inh') AND c.name=N'含税金额';")
    console.log(`  inh.含税金额=${colOf('inh', '含税金额')} inh.税额=${colOf('inh', '税额')} outh.含税金额=${colOf('outh', '含税金额')} outh.税额=${colOf('outh', '税额')}`)
    console.log(`  inh.含税金额 类型: ${idetail}`)
    check('① inh 有 含税金额 列', colOf('inh', '含税金额') !== '(缺)', colOf('inh', '含税金额'))
    check('① inh 有 税额 列', colOf('inh', '税额') !== '(缺)', colOf('inh', '税额'))
    check('① outh 有 含税金额 列', colOf('outh', '含税金额') !== '(缺)', colOf('outh', '含税金额'))
    check('① outh 有 税额 列', colOf('outh', '税额') !== '(缺)', colOf('outh', '税额'))

    // ───────── ② 采购入库单 ─────────
    console.log('\n=== ② 采购入库单(src=1):审核后 inh 两列有值且与单据口径一致 ===')
    const saved = await call('PURCHASE_IN', '保存', {
      单据日期: today, 供应商: sup, 供应商编码: '', 仓库: wh, 经手人: 'admin',
      detail: { items: [{ 存货编码: inv, 存货名称: inv, 实收数量: QTY, 计量单位: '件', 单价: PRICE,
        税率: 13, 金额: QTY * PRICE, 含税金额: TAX_AMT, 批号: lot, 仓库: wh }] },
    })
    piNo = saved?.data?.编号
    if (!piNo) throw new Error('造采购入库单失败: ' + JSON.stringify(saved).slice(0, 400))
    console.log(`测试账套采购入库单: ${piNo}`)
    const aud = await call('PURCHASE_IN', '审核', { 编号: piNo })
    check('② 采购入库单审核成功', aud?.code === 200 || aud?.code === 0, JSON.stringify(aud).slice(0, 300))
    if (!(aud?.code === 200 || aud?.code === 0)) throw new Error('采购入库审核失败,后续断言无意义')
    piAudited = true

    // 单据口径(从单据行自己算,与 loadRows 的表达式同形)
    const docRow = q0(`SELECT ISNULL(CAST(l.[含税金额] AS varchar(30)),'(null)') + ' | ' + ISNULL(CAST(l.[金额] AS varchar(30)),'(null)')`
      + ` + ' | ' + ISNULL(CAST(l.[单价] AS varchar(30)),'(null)') + ' | ' + ISNULL(CAST(l.[实收数量] AS varchar(30)),'(null)')`
      + ` + ' | ' + ISNULL(l.[批号],'(null)') + ' | ' + ISNULL(l.[批次号],'(null)')`
      + ` FROM bl_purchase_in l WHERE l.[单据编号] = N'${piNo}' AND ISNULL(l.asp_cancel,'N') <> 'Y';`)
    console.log(`  单据行 含税金额|金额|单价|实收数量|批号|批次号 = ${docRow}`)
    const docTax = q0(`SELECT CAST(ISNULL(l.[含税金额],0) - ISNULL(l.[金额], l.[单价]*l.[实收数量]) AS decimal(18,4))`
      + ` FROM bl_purchase_in l WHERE l.[单据编号] = N'${piNo}' AND ISNULL(l.asp_cancel,'N') <> 'Y';`)
    const inhRow = q0(`SELECT CAST(src AS varchar(4)) + ' | ' + CAST(rid AS varchar(20)) + ' | ' + ISNULL(物料编码,'')`
      + ` + ' | ' + ISNULL(仓库编码,'') + ' | ' + ISNULL(批号,'(null)') + ' | ' + CAST(CAST(数量 AS decimal(18,4)) AS varchar(30))`
      + ` + ' | ' + ISNULL(CAST(金额 AS varchar(30)),'(null)') + ' | ' + ISNULL(CAST(含税金额 AS varchar(30)),'(null)')`
      + ` + ' | ' + ISNULL(CAST(税额 AS varchar(30)),'(null)') + ' | ' + ISNULL(asp_cancel,'N')`
      + ` FROM inh WHERE 单据编号 = N'${piNo}';`)
    console.log(`  inh 行 src|rid|物料|仓库|批号|数量|金额|含税金额|税额|cancel = ${inhRow}`)
    const f = inhRow.split(' | ')      // ⚠ sqlcmd -s '\t' 只在选中多列时生效;本探针把整行拼成一列,列间是 ' | '
    check('② inh 有且只有 1 行', q0(`SELECT COUNT(*) FROM inh WHERE 单据编号 = N'${piNo}';`) === '1', inhRow)
    check(`② inh.含税金额 = ${TAX_AMT}(= 单据 含税金额)`, Number(f[7]) === TAX_AMT, f[7])
    check(`② inh.税额 = ${docTax}(= 含税金额 − 金额,原视图反推口径)`, Math.abs(Number(f[8]) - Number(docTax)) < 0.0001, `${f[8]} vs ${docTax}`)
    check('② inh.税额 = 130(1130 − 1000)', Math.abs(Number(f[8]) - 130) < 0.0001, f[8])
    const lotActual = sql(`SELECT ISNULL(批号,'(null)') FROM inh WHERE 单据编号 = N'${piNo}';`)
    check(`② 流水批号 = 探针批号 ${lot}(手制单无批次键 ⇒ 批次号未被改成入库日期)`, lotActual === lot, lotActual)

    // ───────── ③ 视图不再恒 NULL ─────────
    console.log('\n=== ③ v_stock_movement 这两列不再恒 NULL(直接查视图) ===')
    const vRow = q0(`SELECT 单据编号 + ' | ' + 存货编码 + ' | ' + ISNULL(CAST(含税金额 AS varchar(30)),'(null)')`
      + ` + ' | ' + ISNULL(CAST(税额 AS varchar(30)),'(null)') + ' | ' + ISNULL(CAST(收入金额 AS varchar(30)),'(null)')`
      + ` FROM v_stock_movement WHERE 单据编号 = N'${piNo}';`)
    console.log(`  视图行 单据编号|存货编码|含税金额|税额|收入金额 = ${vRow}`)
    const vf = vRow.split(' | ')
    check('③ 视图里该单 含税金额 = 1130(不再 NULL)', Number(vf[2]) === TAX_AMT, vf[2])
    check('③ 视图里该单 税额 = 130(不再 NULL)', Math.abs(Number(vf[3]) - 130) < 0.0001, vf[3])
    const allNull = num("SELECT COUNT(*) FROM v_stock_movement WHERE 含税金额 IS NULL AND 税额 IS NULL;")
    const nonNull = num("SELECT COUNT(*) FROM v_stock_movement WHERE 含税金额 IS NOT NULL OR 税额 IS NOT NULL;")
    console.log(`  全视图:两列都 NULL 的行 ${allNull} / 至少一列有值的行 ${nonNull}(共 ${num('SELECT COUNT(*) FROM v_stock_movement;')} 行)`)
    check('③ 全视图出现「两列非全 NULL」的行(旧行期初仍可为 NULL)', nonNull >= 1, String(nonNull))

    // ───────── ④ 销售出库单 ─────────
    console.log('\n=== ④ 销售出库单(src=5):审核后 outh 两列有值且与单据口径一致 ===')
    const s2 = await call('SALE_OUT', '保存', {
      单据日期: today, 客户: '探针客户', 仓库: wh, 经手人: 'admin', 出库类别: '销售出库',
      detail: { items: [{ 存货编码: inv, 存货名称: inv, 数量: OUT_QTY, 计量单位: '件', 售价: 12.5,
        销售金额: SALE_AMT, 含税销售金额: SALE_TAX_AMT, 税额: SALE_TAX, 批号: lot, 仓库: wh }] },
    })
    soNo = s2?.data?.编号
    if (!soNo) throw new Error('造销售出库单失败: ' + JSON.stringify(s2).slice(0, 400))
    console.log(`测试账套销售出库单: ${soNo}`)
    const a2 = await call('SALE_OUT', '审核', { 编号: soNo })
    check('④ 销售出库单审核成功', a2?.code === 200 || a2?.code === 0, JSON.stringify(a2).slice(0, 300))
    if (!(a2?.code === 200 || a2?.code === 0)) throw new Error('销售出库审核失败,后续断言无意义')
    soAudited = true

    const soDoc = q0(`SELECT ISNULL(CAST(l.[含税销售金额] AS varchar(30)),'(null)') + ' | ' + ISNULL(CAST(l.[税额] AS varchar(30)),'(null)')`
      + ` + ' | ' + ISNULL(CAST(l.[销售金额] AS varchar(30)),'(null)') FROM bl_sale_out l`
      + ` WHERE l.[单据编号] = N'${soNo}' AND ISNULL(l.asp_cancel,'N') <> 'Y';`)
    console.log(`  销售单据行 含税销售金额|税额|销售金额 = ${soDoc}`)
    const outhRow = q0(`SELECT CAST(src AS varchar(4)) + ' | ' + CAST(rid AS varchar(20)) + ' | ' + ISNULL(物料编码,'')`
      + ` + ' | ' + ISNULL(仓库编码,'') + ' | ' + ISNULL(批号,'(null)') + ' | ' + CAST(CAST(数量 AS decimal(18,4)) AS varchar(30))`
      + ` + ' | ' + ISNULL(CAST(单据金额 AS varchar(30)),'(null)') + ' | ' + ISNULL(CAST(含税金额 AS varchar(30)),'(null)')`
      + ` + ' | ' + ISNULL(CAST(税额 AS varchar(30)),'(null)') + ' | ' + ISNULL(asp_cancel,'N')`
      + ` FROM outh WHERE 单据编号 = N'${soNo}';`)
    console.log(`  outh 行 src|rid|物料|仓库|批号|数量|单据金额|含税金额|税额|cancel = ${outhRow}`)
    const of = outhRow.split(' | ')
    check('④ outh 有且只有 1 行', q0(`SELECT COUNT(*) FROM outh WHERE 单据编号 = N'${soNo}';`) === '1', outhRow)
    check(`④ outh.含税金额 = ${SALE_TAX_AMT}(= 单据 含税销售金额)`, Number(of[7]) === SALE_TAX_AMT, of[7])
    check(`④ outh.税额 = ${SALE_TAX}(= 单据 税额)`, Number(of[8]) === SALE_TAX, of[8])
    const vRow2 = q0(`SELECT ISNULL(CAST(含税金额 AS varchar(30)),'(null)') + ' | ' + ISNULL(CAST(税额 AS varchar(30)),'(null)')`
      + ` + ' | ' + ISNULL(业务类型,'') FROM v_stock_movement WHERE 单据编号 = N'${soNo}';`)
    console.log(`  视图行(销售) 含税金额|税额|业务类型 = ${vRow2}`)
    const vf2 = vRow2.split(' | ')
    check('④ 视图里该出库单 含税金额 = 565 且 业务类型=出库', Number(vf2[0]) === SALE_TAX_AMT && vf2[2] === '出库', vRow2)

    // ───────── ⑤ 库存台账面板口径 ─────────
    console.log('\n=== ⑤ 库存台账面板 STOCK_LEDGER(口径 = v_stock_ledger) ===')
    const ledger = q0(`SELECT 单据编号 + ' | ' + 业务类型 + ' | ' + ISNULL(CAST(含税金额 AS varchar(30)),'(null)')`
      + ` + ' | ' + ISNULL(CAST(税额 AS varchar(30)),'(null)') + ' | ' + ISNULL(CAST(收入金额 AS varchar(30)),'(null)')`
      + ` FROM v_stock_ledger WHERE 单据编号 IN (N'${piNo}', N'${soNo}') ORDER BY 单据编号, 单据日期;`)
    console.log(`  v_stock_ledger 行 单据编号|业务类型|含税金额|税额|收入金额:\n    ${ledger.split(/\r?\n/).join('\n    ')}`)
    check('⑤ v_stock_ledger(面板取数视图)该两列有值', !/\(null\)/.test(ledger) && ledger.includes(piNo) && ledger.includes(soNo), ledger)
    const ledApi = await post('/px/queryFormDataList', { panelCode: 'STOCK_LEDGER', keyword: piNo, pageNo: 1, pageSize: 50 })
    const rows = (ledApi?.data?.rows || ledApi?.data?.list || ledApi?.data?.records || [])
    const hitRow = rows.find((r) => String(r['单据编号'] || '') === piNo) || rows[0]
    console.log(`  面板接口返回 ${rows.length} 行;命中行: 单据编号=${hitRow?.['单据编号']} 含税金额=${hitRow?.['含税金额']} 税额=${hitRow?.['税额']}`)
    check('⑤ 面板接口 STOCK_LEDGER 返回该行且 含税金额=1130', hitRow && Number(hitRow['含税金额']) === TAX_AMT, JSON.stringify(hitRow).slice(0, 200))
    check('⑤ 面板接口 STOCK_LEDGER 返回该行且 税额=130', hitRow && Math.abs(Number(hitRow['税额']) - 130) < 0.0001, JSON.stringify(hitRow).slice(0, 200))

    // ───────── ⑥ 勾稽 ─────────
    console.log('\n=== ⑥ 勾稽不受影响(含探针的两张单) ===')
    const yl1 = ylSum(), bal1 = balSum(), mov1 = movNet()
    console.log(`  kucun 余量合计 ${yl1} / balance 现存量合计 ${bal1} / 流水净额 ${mov1}`)
    check(`⑥ 流水净额 ${mov1} == balance 现存量 ${bal1}`, Math.abs(mov1 - bal1) < 0.0001, `${mov1} vs ${bal1}`)
    check(`⑥ kucun 余量 ${yl1} == balance 现存量 ${bal1}`, Math.abs(yl1 - bal1) < 0.0001, `${yl1} vs ${bal1}`)
    check(`⑥ 相对基线增量一致(净 +${QTY - OUT_QTY})`, Math.abs((yl1 - yl0) - (QTY - OUT_QTY)) < 0.0001, `Δ=${yl1 - yl0}`)

    // ───────── ⑨ 「其余段 NULL」口径的对照靶单(产成品入库 src=2:那 6 张行表本身没有这两列) ─────────
    //   为什么必须有这一组:任务的硬要求是「只有 PURCHASE_IN / SALE_OUT 两段有值,其余段 NULL」——
    //   只验"有值"会漏掉"该 NULL 的段被填了垃圾/被填了 0"这种反向错。
    console.log('\n=== ⑨ 对照:产成品入库单(src=2)这两列必须为 NULL ===')
    lot2 = 'TAXPROBE-NULL-' + stamp
    const s9 = await call('FINISH_IN', '保存', {
      单据日期: today, 仓库: wh, 业务类型: '产成品入库', 入库类别: '自制加工入库', 生产车间: '测试车间', 经手人: 'admin',
      detail: { items: [{ 产品编码: inv, 产品名称: inv, 实收数量: 5, 计量单位: '件', 单价: 12.5, 批号: lot2, 仓库: wh }] },
    })
    fiNo = s9?.data?.编号
    if (!fiNo) throw new Error('造产成品入库单失败: ' + JSON.stringify(s9).slice(0, 300))
    const a9 = await call('FINISH_IN', '审核', { 编号: fiNo })
    check('⑨ 产成品入库单审核成功', a9?.code === 200 || a9?.code === 0, JSON.stringify(a9).slice(0, 200))
    if (a9?.code === 200 || a9?.code === 0) fiAudited = true
    const fiRow = q0(`SELECT ISNULL(CAST(含税金额 AS varchar(20)),'(null)') + ' | ' + ISNULL(CAST(税额 AS varchar(20)),'(null)')`
      + ` + ' | ' + ISNULL(批号,'(null)') FROM inh WHERE 单据编号 = N'${fiNo}';`)
    console.log(`  inh 行 含税金额|税额|批号 = ${fiRow}`)
    const ff = fiRow.split(' | ')
    check('⑨ 产成品入库流水 含税金额 = NULL(该段无此列,不臆造)', ff[0] === '(null)', ff[0])
    check('⑨ 产成品入库流水 税额 = NULL', ff[1] === '(null)', ff[1])
    const v9 = q0(`SELECT ISNULL(CAST(含税金额 AS varchar(20)),'(null)') + ' | ' + ISNULL(CAST(税额 AS varchar(20)),'(null)')`
      + ` FROM v_stock_movement WHERE 单据编号 = N'${fiNo}';`)
    check('⑨ 视图里该段两列也是 NULL', v9 === '(null) | (null)', v9)
  } finally {
    // ── 清理 ──
    console.log('\n=== ⑦ 清理 ===')
    try {
      if (soNo && soAudited) {
        const un2 = await call('SALE_OUT', '弃审', { 编号: soNo })
        check('⑦ 销售出库单弃审成功(unaudit 路径:流水红冲 + kucun 冲回;⚠ 该路径**不**调 findPendingBatchId)', un2?.code === 200 || un2?.code === 0, JSON.stringify(un2).slice(0, 200))
        check('⑦ 弃审后 outh 标 Y(软删留痕)', sql(`SELECT ISNULL(asp_cancel,'N') FROM outh WHERE 单据编号 = N'${soNo}';`) === 'Y')
      }
      if (piNo && piAudited) {
        const un1 = await call('PURCHASE_IN', '弃审', { 编号: piNo })
        check('⑦ 采购入库单弃审成功(unaudit 路径:流水红冲 + kucun 冲回;⚠ 该路径**不**调 findPendingBatchId)', un1?.code === 200 || un1?.code === 0, JSON.stringify(un1).slice(0, 200))
        check('⑦ 弃审后 inh 标 Y(软删留痕)', sql(`SELECT ISNULL(asp_cancel,'N') FROM inh WHERE 单据编号 = N'${piNo}';`) === 'Y')
      }
      if (soNo) { cleanup(soNo, 'SALE_OUT'); check(`⑦ 销售出库单 ${soNo} 残留 0`, leftovers(soNo, 'SALE_OUT') === 0, String(leftovers(soNo, 'SALE_OUT'))) }
      if (piNo) { cleanup(piNo, 'PURCHASE_IN'); check(`⑦ 采购入库单 ${piNo} 残留 0`, leftovers(piNo, 'PURCHASE_IN') === 0, String(leftovers(piNo, 'PURCHASE_IN'))) }
      if (fiNo && fiAudited) {
        const un9 = await call('FINISH_IN', '弃审', { 编号: fiNo })
        check('⑦ 产成品入库单弃审成功(⑨ 对照靶单)', un9?.code === 200 || un9?.code === 0, JSON.stringify(un9).slice(0, 200))
      }
      if (fiNo) {
        cleanup(fiNo, 'FINISH_IN')
        check(`⑦ 产成品入库单 ${fiNo} 残留 0`, leftovers(fiNo, 'FINISH_IN') === 0, String(leftovers(fiNo, 'FINISH_IN')))
        if (num(`SELECT COUNT(*) FROM kucun WHERE lot_no = N'${lot2}';`) > 0) sql(`DELETE FROM kucun WHERE lot_no = N'${lot2}';`)
        check('⑦ kucun 无 ⑨ 对照批号残留', num(`SELECT COUNT(*) FROM kucun WHERE lot_no = N'${lot2}';`) === 0)
      }
      const kucunLeft = num(`SELECT COUNT(*) FROM kucun WHERE lot_no = N'${lot}';`)
      if (kucunLeft > 0) {
        sql(`DELETE FROM kucun WHERE lot_no = N'${lot}';`)
        console.log(`  已删除探针批号 ${lot} 的 kucun 行 ${kucunLeft} 行`)
      }
      check(`⑦ kucun 无探针批号残留`, num(`SELECT COUNT(*) FROM kucun WHERE lot_no = N'${lot}';`) === 0)
      // 成本重算:审核触发过重算,清完流水后再算一次让它收敛回基线
      const rc = await call('STOCK_LEDGER', '重算成本', {})
      console.log(`  重算成本应答: ${JSON.stringify(rc).slice(0, 200)}`)
      const kucunNow = kucunSnapshot()
      check('⑦ kucun 逐行回到原值(快照完全相同)', kucunNow === kucun0,
        '改后:\n' + kucunNow + '\n原值:\n' + kucun0)
      const costNow = costSnapshot()
      console.log(`  成本表: 改前 ${cost0} / 改后 ${costNow}`)
      check('⑦ 成本表回到基线(行数 + 收入金额合计)', costNow === cost0, `${costNow} vs ${cost0}`)

      // ───────── ⑧ 全库勾稽回到基线 ─────────
      console.log('\n=== ⑧ 全库勾稽回到基线 ===')
      const yl2 = ylSum(), bal2 = balSum(), mov2 = movNet()
      console.log(`  kucun 余量合计 ${yl2} / balance 现存量合计 ${bal2} / 流水净额 ${mov2}(基线 ${yl0} / ${bal0} / ${mov0})`)
      check(`⑧ kucun 余量合计 == 基线 ${yl0}`, Math.abs(yl2 - yl0) < 0.0001, String(yl2))
      check(`⑧ balance 现存量合计 == 基线 ${bal0}`, Math.abs(bal2 - bal0) < 0.0001, String(bal2))
      check(`⑧ 流水净额 == 基线 ${mov0}`, Math.abs(mov2 - mov0) < 0.0001, String(mov2))
    } catch (e) {
      fail++
      console.log('  ✗ 清理段异常: ' + String(e.message).split('\n')[0])
    }
  }
  console.log(`\n═══ 结果: 通过 ${pass} / 失败 ${fail} ═══`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('PROBE FAIL: ' + e.stack); process.exit(1) })
