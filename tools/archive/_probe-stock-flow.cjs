'use strict'
/**
 * _probe-stock-flow.cjs — 端到端验证:单据审核把流水写进 inh/outh,与 kucun **同事务**、幂等、弃审红冲。
 * (2026-09-30 库存三表结构 · 任务 3 的验收探针)
 *
 * ⚠ 只在**测试账套**(HSDZ_MES_TEST / 登录工厂 YJ_TEST)造数,正式库一行不动;跑完清理干净。
 *   靶子选 FINISH_IN(产成品入库单, src=2):入库方向不需要预置现存量,且不挂加工单号
 *   ⇒ 不触发 ManuWritebackService 的生产回填(那是另一条链,与本任务无关)。
 *
 * 断言:
 *   ① 审核前:inh/outh 里没有该单据编号的行
 *   ② 审核后:有且只有 1 行,src/rid/数量/仓库编码/批号/物料编码/单据类型/单据日期/经手人/金额 与单据一致
 *   ③ kucun.yl 的变化量 == 该单流水的数量之和(结存与流水同源)
 *   ④ 弃审后:流水标 asp_cancel='Y'(软删留痕,不物理删),kucun.yl 冲回原值
 *   ⑤ 幂等:弃审后再审核不产生第 2 行(唯一索引),且流水被"复活"(asp_cancel 回 'N');
 *      已审核单据再点审核被状态机拒,流水仍 1 行
 *   ⑥ 该三键上 kucun.yl == Σ流水净额(inh 正 − outh 负)
 *   ⑦ **同事务**:两行的单里第 2 行仓库档案不存在 ⇒ 审核整笔失败,第 1 行(合法行)的 kucun 与流水
 *      都不许留痕 —— 证明"守卫抛错时流水不会先落库、kucun 也不会半截生效"
 *
 * 用法: node tools/archive/_probe-stock-flow.cjs [http://127.0.0.1:8090]
 */
const { execFileSync } = require('node:child_process')

const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api'
const DB = 'HSDZ_MES_TEST'                       // 只碰测试账套
let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  → ' + e : ''}`)) }
// -I:QUOTED_IDENTIFIER ON —— inh/outh 上有**过滤索引**,DML 在 QUOTED_IDENTIFIER OFF 下会报 1934
const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', DB, '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-f', '65001', '-I', '-Q', `SET NOCOUNT ON; ${q}`], { encoding: 'utf8' }).trim()
const num = (q) => Number(sql(q) || 0)
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

  // 靶子:测试账套里真实存在的启用仓库 + 存货,批号每次唯一(保证 kucun 三键干净)
  const wh = sql("SELECT TOP 1 仓库名称 FROM bs_wh WHERE ISNULL(状态,N'启用')=N'启用' ORDER BY 仓库编码;")
  const whCode = sql(`SELECT TOP 1 仓库编码 FROM bs_wh WHERE 仓库名称 = N'${wh}' AND ISNULL(状态,N'启用')=N'启用' ORDER BY 仓库编码;`)
  const prod = sql("SELECT TOP 1 存货编码 FROM bs_inv WHERE ISNULL(状态,N'启用')=N'启用' ORDER BY 存货编码;")
  const stamp = Date.now().toString(36).toUpperCase()
  const lot = 'SF-PROBE-' + stamp
  const QTY = 100
  console.log(`靶子: 仓库=${wh}(${whCode}) 存货=${prod} 批号=${lot} 数量=${QTY}`)

  const ylOf = (l) => num(`SELECT ISNULL(yl,0) FROM kucun WHERE wzdm = N'${prod}' AND ckdm = N'${whCode}' AND lot_no = N'${l}';`)
  // 清理:单据行 id 是**软删**(asp_cancel='Y')留痕的,探针自己造的要物理清掉,免得测试账套越跑越脏
  const DOC_TBLS = { FINISH_IN: ['bd_finish_in', 'bl_finish_in'], MATERIAL_OUT: ['bd_material_out', 'bl_material_out'] }
  const cleanup = (no, panel, l) => {
    const [h, d] = DOC_TBLS[panel]
    return sql(`DELETE FROM inh WHERE 单据编号 = N'${no}';
       DELETE FROM outh WHERE 单据编号 = N'${no}';
       DELETE FROM ${d} WHERE 单据编号 = N'${no}';
       DELETE FROM ${h} WHERE 单据编号 = N'${no}';
       DELETE FROM yj_doc_status WHERE panel_code = '${panel}' AND doc_no = N'${no}';
       DELETE FROM yj_form_approval WHERE panel_code = '${panel}' AND form_no = N'${no}';`)
       + (l ? sql(`DELETE FROM kucun WHERE wzdm = N'${prod}' AND ckdm = N'${whCode}' AND lot_no = N'${l}';`) : '')
  }
  const leftovers = (no, panel, l) => {
    const [h, d] = DOC_TBLS[panel]
    return num(`SELECT (SELECT COUNT(*) FROM inh WHERE 单据编号 = N'${no}')`
      + ` + (SELECT COUNT(*) FROM outh WHERE 单据编号 = N'${no}')`
      + ` + (SELECT COUNT(*) FROM ${h} WHERE 单据编号 = N'${no}')`
      + ` + (SELECT COUNT(*) FROM ${d} WHERE 单据编号 = N'${no}')`
      + ` + (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = '${panel}' AND doc_no = N'${no}')`
      + ` + (SELECT COUNT(*) FROM yj_form_approval WHERE panel_code = '${panel}' AND form_no = N'${no}')`
      // kucun 只在该单**独占**这批号时才归它(⑧ 出库靶单与主靶单共用同一批号 ⇒ 传 null 不数)
      + (l ? ` + (SELECT COUNT(*) FROM kucun WHERE wzdm = N'${prod}' AND ckdm = N'${whCode}' AND lot_no = N'${l}')` : '') + ';')
  }
  /** 残留明细(哪张表还留着行),失败时直接打出来,免得只有个数字 */
  const leftoverDetail = (no, panel, l) => {
    const [h, d] = DOC_TBLS[panel]
    return sql(`SELECT 'inh=' + CAST((SELECT COUNT(*) FROM inh WHERE 单据编号 = N'${no}') AS varchar(9))`
      + ` + ' outh=' + CAST((SELECT COUNT(*) FROM outh WHERE 单据编号 = N'${no}') AS varchar(9))`
      + ` + ' ${h}=' + CAST((SELECT COUNT(*) FROM ${h} WHERE 单据编号 = N'${no}') AS varchar(9))`
      + ` + ' ${d}=' + CAST((SELECT COUNT(*) FROM ${d} WHERE 单据编号 = N'${no}') AS varchar(9))`
      + ` + ' status=' + CAST((SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = '${panel}' AND doc_no = N'${no}') AS varchar(9))`
      + ` + ' approval=' + CAST((SELECT COUNT(*) FROM yj_form_approval WHERE panel_code = '${panel}' AND form_no = N'${no}') AS varchar(9))`
      + (l ? ` + ' kucun=' + CAST((SELECT COUNT(*) FROM kucun WHERE wzdm = N'${prod}' AND ckdm = N'${whCode}' AND lot_no = N'${l}') AS varchar(9))` : '') + ';')
  }

  let no = ''            // 主靶单(入库)
  let guardNo = ''       // ⑦ 同事务靶单
  let moNo = ''          // ⑧ 出库靶单
  const guardLot = 'SF-PROBE-GUARD-' + stamp
  let audited = false
  let moAudited = false
  try {
    // ── 造单(草稿) ──
    const saved = await call('FINISH_IN', '保存', {
      单据日期: today, 仓库: wh, 业务类型: '产成品入库', 入库类别: '自制加工入库', 生产车间: '测试车间', 经手人: 'admin',
      detail: { items: [{ 产品编码: prod, 产品名称: prod, 实收数量: QTY, 计量单位: '件', 单价: 12.5, 批号: lot, 仓库: wh }] },
    })
    no = saved?.data?.编号
    if (!no) throw new Error('造产成品入库单失败: ' + JSON.stringify(saved).slice(0, 300))
    console.log(`测试账套产成品入库单: ${no}`)

    // ── ① 审核前:流水里没有该单 ──
    check('① 审核前 inh 无该单流水', num(`SELECT COUNT(*) FROM inh WHERE 单据编号 = N'${no}';`) === 0)
    check('① 审核前 outh 无该单流水', num(`SELECT COUNT(*) FROM outh WHERE 单据编号 = N'${no}';`) === 0)

    const ylBefore = ylOf(lot)

    // ── 审核 ──
    const aud = await call('FINISH_IN', '审核', { 编号: no })
    check('审核成功', aud?.code === 200 || aud?.code === 0, JSON.stringify(aud).slice(0, 300))
    if (!(aud?.code === 200 || aud?.code === 0)) throw new Error('审核失败,后续断言无意义')
    audited = true

    // ── ② 审核后:流水行与单据行一致 ──
    const cnt = num(`SELECT COUNT(*) FROM inh WHERE 单据编号 = N'${no}';`)
    check('② 审核后 inh 有且只有 1 行', cnt === 1, `实际 ${cnt}`)
    const rid = num(`SELECT TOP 1 id FROM bl_finish_in WHERE 单据编号 = N'${no}' AND ISNULL(asp_cancel,'N') <> 'Y';`)
    const row = sql(`SELECT CAST(src AS varchar(10)), CAST(rid AS varchar(20)), ISNULL(单据类型,''), CONVERT(varchar(10),单据日期,120),`
      + ` ISNULL(物料编码,''), ISNULL(仓库编码,''), ISNULL(批号,''), CAST(数量 AS varchar(20)), ISNULL(asp_cancel,'N'),`
      + ` ISNULL(经手人,''), ISNULL(CAST(金额 AS varchar(20)),'(null)'), ISNULL(物料名称,'')`
      + ` FROM inh WHERE 单据编号 = N'${no}';`)
    const f = row.split('\t')
    console.log(` 流水行: src=${f[0]} rid=${f[1]} 单据类型=${f[2]} 单据日期=${f[3]} 物料=${f[4]} 名称=${f[11]} 仓=${f[5]} 批号=${f[6]} 数量=${f[7]} cancel=${f[8]} 经手人=${f[9]} 金额=${f[10]}`)
    check('② src = 2(产成品入库)', f[0] === '2', f[0])
    check('② rid = 单据行 id', f[1] === String(rid), `${f[1]} vs ${rid}`)
    check('② 单据类型 = 产成品入库单', f[2] === '产成品入库单', f[2])
    check('② 单据日期 = 单据日期', f[3] === today, `${f[3]} vs ${today}`)
    check('② 物料编码一致', f[4] === prod, `${f[4]} vs ${prod}`)
    check('② 仓库编码 = 解析后的档案编码', f[5] === whCode, `${f[5]} vs ${whCode}`)
    check('② 批号一致', f[6] === lot, `${f[6]} vs ${lot}`)
    check('② 数量 = 100', Number(f[7]) === QTY, f[7])
    check('② 未红冲(asp_cancel = N)', f[8] === 'N', f[8])
    check('② 经手人 = 单据头经手人', f[9] === 'admin', f[9])
    const docAmt = num(`SELECT ISNULL(ISNULL(l.金额, l.单价*l.实收数量),0) FROM bl_finish_in l WHERE l.单据编号 = N'${no}' AND ISNULL(l.asp_cancel,'N') <> 'Y';`)
    check(`② 金额 = 单据金额(或 单价×数量)= ${docAmt}`, Math.abs(Number(f[10]) - docAmt) < 0.0001, `${f[10]} vs ${docAmt}`)

    // ── ③ kucun.yl 变化量 == 流水数量之和 ──
    const ylAfter = ylOf(lot)
    const flowSum = num(`SELECT ISNULL(SUM(数量),0) FROM inh WHERE 单据编号 = N'${no}' AND ISNULL(asp_cancel,'N') <> 'Y';`)
    check(`③ kucun.yl 变化量 ${ylAfter - ylBefore} == 流水数量之和 ${flowSum}`, Math.abs((ylAfter - ylBefore) - flowSum) < 0.0001)
    check('③ kucun.yl 实际入库 100', Math.abs(ylAfter - ylBefore - QTY) < 0.0001, String(ylAfter - ylBefore))

    // ── ④ 弃审:流水软删红冲 + kucun 冲回 ──
    const un = await call('FINISH_IN', '弃审', { 编号: no })
    check('弃审成功', un?.code === 200 || un?.code === 0, JSON.stringify(un).slice(0, 300))
    audited = false
    check('④ 弃审后流水行仍在(软删不物理删)', num(`SELECT COUNT(*) FROM inh WHERE 单据编号 = N'${no}';`) === 1)
    check('④ 弃审后流水 asp_cancel = Y',
      sql(`SELECT ISNULL(asp_cancel,'N') FROM inh WHERE 单据编号 = N'${no}';`) === 'Y')
    const ylBack = ylOf(lot)
    check(`④ 弃审后 kucun.yl 冲回原值 ${ylBefore}`, Math.abs(ylBack - ylBefore) < 0.0001, String(ylBack))

    // ── ⑤ 幂等:弃审后再审核 → 不产生第 2 行,且流水复活 ──
    const re = await call('FINISH_IN', '审核', { 编号: no })
    check('⑤ 重新审核成功', re?.code === 200 || re?.code === 0, JSON.stringify(re).slice(0, 300))
    audited = true
    const cnt2 = num(`SELECT COUNT(*) FROM inh WHERE 单据编号 = N'${no}';`)
    check('⑤ 重新审核后流水仍只有 1 行(无重复)', cnt2 === 1, `实际 ${cnt2}`)
    check('⑤ 流水被复活(asp_cancel 回到 N)',
      sql(`SELECT ISNULL(asp_cancel,'N') FROM inh WHERE 单据编号 = N'${no}';`) === 'N')
    const ylRe = ylOf(lot)
    check(`⑤ 复活后 kucun.yl = ${ylBefore + QTY}`, Math.abs(ylRe - (ylBefore + QTY)) < 0.0001, String(ylRe))
    // 已审核状态再点审核应被状态机拒绝,流水行数不变
    const again = await call('FINISH_IN', '审核', { 编号: no })
    check('⑤ 已审核单据再点审核被拒(状态机)', !(again?.code === 200 || again?.code === 0), JSON.stringify(again).slice(0, 200))
    check('⑤ 被拒后流水仍只有 1 行', num(`SELECT COUNT(*) FROM inh WHERE 单据编号 = N'${no}';`) === 1)

    // ── ⑥ 汇总勾稽:该三键上「kucun 余量 == Σ 流水净额(inh 正、outh 负)」 ──
    const ylNow = ylOf(lot)
    const net = num(`SELECT ISNULL((SELECT SUM(数量) FROM inh WHERE 物料编码 = N'${prod}' AND 仓库编码 = N'${whCode}' AND 批号 = N'${lot}' AND ISNULL(asp_cancel,'N') <> 'Y'),0)`
      + ` - ISNULL((SELECT SUM(数量) FROM outh WHERE 物料编码 = N'${prod}' AND 仓库编码 = N'${whCode}' AND 批号 = N'${lot}' AND ISNULL(asp_cancel,'N') <> 'Y'),0);`)
    check(`⑥ 该三键 kucun.yl ${ylNow} == Σ流水净额 ${net}`, Math.abs(ylNow - net) < 0.0001)

    // ── ⑧ 出库方向(outh / src=6 材料出库单):同一条链上把刚入库的 100 领走 40 ──
    const s3 = await call('MATERIAL_OUT', '保存', {
      单据日期: today, 仓库: wh, 业务类型: '材料出库', 出库类别: '直接领料', 生产车间: '测试车间', 领用人: 'admin',
      detail: { items: [{ 材料编码: prod, 材料名称: prod, 数量: 40, 计量单位: '件', 单价: 5, 批号: lot, 仓库: wh }] },
    })
    moNo = s3?.data?.编号
    if (!moNo) throw new Error('造材料出库单失败: ' + JSON.stringify(s3).slice(0, 300))
    const a3 = await call('MATERIAL_OUT', '审核', { 编号: moNo })
    check('⑧ 材料出库审核成功', a3?.code === 200 || a3?.code === 0, JSON.stringify(a3).slice(0, 300))
    moAudited = true
    const orow = sql(`SELECT CAST(src AS varchar(10)), CAST(rid AS varchar(20)), ISNULL(单据类型,''), ISNULL(物料编码,''),`
      + ` ISNULL(仓库编码,''), ISNULL(批号,''), CAST(数量 AS varchar(20)), ISNULL(asp_cancel,'N'),`
      + ` ISNULL(CAST(单据金额 AS varchar(20)),'(null)') FROM outh WHERE 单据编号 = N'${moNo}';`).split('\t')
    console.log(` outh 行: src=${orow[0]} rid=${orow[1]} 单据类型=${orow[2]} 物料=${orow[3]} 仓=${orow[4]} 批号=${orow[5]} 数量=${orow[6]} cancel=${orow[7]} 单据金额=${orow[8]}`)
    check('⑧ outh src = 6(材料出库)', orow[0] === '6', orow[0])
    check('⑧ outh rid = 出库单行 id',
      orow[1] === sql(`SELECT TOP 1 CAST(id AS varchar(20)) FROM bl_material_out WHERE 单据编号 = N'${moNo}' AND ISNULL(asp_cancel,'N') <> 'Y';`), orow[1])
    check('⑧ outh 单据类型 = 材料出库单', orow[2] === '材料出库单', orow[2])
    check('⑧ outh 物料编码/仓库编码/批号 一致', orow[3] === prod && orow[4] === whCode && orow[5] === lot, orow.slice(3, 6).join('|'))
    check('⑧ outh 数量 = 40', Math.abs(Number(orow[6]) - 40) < 0.0001, orow[6])
    const ylOut = ylOf(lot)
    check(`⑧ 出库后 kucun.yl = 60(100 − 40)`, Math.abs(ylOut - (ylBefore + QTY - 40)) < 0.0001, String(ylOut))
    const un3 = await call('MATERIAL_OUT', '弃审', { 编号: moNo })
    check('⑧ 材料出库弃审成功', un3?.code === 200 || un3?.code === 0, JSON.stringify(un3).slice(0, 300))
    moAudited = false
    check('⑧ 弃审后 outh 标 Y(软删留痕)',
      sql(`SELECT ISNULL(asp_cancel,'N') FROM outh WHERE 单据编号 = N'${moNo}';`) === 'Y')
    check(`⑧ 弃审后 kucun.yl 回到 ${ylBefore + QTY}`, Math.abs(ylOf(lot) - (ylBefore + QTY)) < 0.0001, String(ylOf(lot)))

    // ── ⑦ 同事务:第 2 行仓库档案不存在 ⇒ 整笔回滚,第 1 行(合法行,先落 kucun)也不许留痕 ──
    const gs = await call('FINISH_IN', '保存', {
      单据日期: today, 仓库: wh, 业务类型: '产成品入库', 入库类别: '自制加工入库', 生产车间: '测试车间', 经手人: 'admin',
      detail: { items: [
        { 产品编码: prod, 产品名称: prod, 实收数量: 10, 计量单位: '件', 单价: 1, 批号: guardLot, 仓库: wh },      // 合法行(字典序在前,先过账)
        { 产品编码: prod, 产品名称: prod, 实收数量: 10, 计量单位: '件', 单价: 1, 批号: guardLot, 仓库: '不存在的仓库ZZZ' }, // 仓库档案不存在
      ] },
    })
    guardNo = gs?.data?.编号
    if (!guardNo) throw new Error('造 ⑦ 靶单失败: ' + JSON.stringify(gs).slice(0, 300))
    // 前提诊断:loadRows 的 SELECT **没有 ORDER BY** —— 先打印数据库实际返回的行序,
    // 证明"合法行排在前面、确实先过了一遍 kucun 又被整笔回滚"(否则本组只证明"守卫拦住了")
    const seen = sql(`SELECT ISNULL(l.[仓库],'(null)') FROM bl_finish_in l`
      + ` LEFT JOIN bd_finish_in h ON h.[单据编号] = l.[单据编号]`
      + ` WHERE l.[单据编号] = N'${guardNo}' AND ISNULL(l.asp_cancel,'N') <> 'Y';`).split(/\r?\n/).map(s => s.trim()).join(' / ')
    console.log(` ⑦ 靶单两行的扫描序(仓库): ${seen}`)
    check('⑦ 合法行在扫描序中先出现(本断言才算"部分过账后整笔回滚")', seen.split(' / ')[0] === wh, seen)
    const gaud = await call('FINISH_IN', '审核', { 编号: guardNo })
    console.log(` ⑦ 审核应答: ${JSON.stringify(gaud).slice(0, 200)}`)
    check('⑦ 第 2 行仓库不存在 ⇒ 审核被拒', !(gaud?.code === 200 || gaud?.code === 0))
    check('⑦ 合法行未写 kucun(整笔回滚)', num(`SELECT COUNT(*) FROM kucun WHERE wzdm = N'${prod}' AND ckdm = N'${whCode}' AND lot_no = N'${guardLot}';`) === 0)
    check('⑦ 合法行未写流水(inh)', num(`SELECT COUNT(*) FROM inh WHERE 单据编号 = N'${guardNo}';`) === 0)
    check('⑦ 单据状态未被置为已审核(yj_doc_status 回滚)',
      num(`SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = 'FINISH_IN' AND doc_no = N'${guardNo}' AND shr IS NOT NULL;`) === 0)
  } finally {
    try {
      if (moNo && moAudited) { try { await call('MATERIAL_OUT', '弃审', { 编号: moNo }) } catch { /* 清理尽力而为 */ } }
      if (no && audited) { try { await call('FINISH_IN', '弃审', { 编号: no }) } catch { /* 清理尽力而为 */ } }
      if (moNo) { cleanup(moNo, 'MATERIAL_OUT', null); check('清理干净(⑧ 出库靶单残留 0 行)', leftovers(moNo, 'MATERIAL_OUT', null) === 0, leftoverDetail(moNo, 'MATERIAL_OUT', null)) }
      if (guardNo) { cleanup(guardNo, 'FINISH_IN', null); check('清理干净(⑦ 靶单残留 0 行)', leftovers(guardNo, 'FINISH_IN', guardLot) === 0, leftoverDetail(guardNo, 'FINISH_IN', guardLot)) }
      if (no) { cleanup(no, 'FINISH_IN', lot); check('清理干净(主靶单残留 0 行)', leftovers(no, 'FINISH_IN', lot) === 0, leftoverDetail(no, 'FINISH_IN', lot)) }
      console.log(`已清理测试账套 ${no}${moNo ? ' / ' + moNo : ''}${guardNo ? ' / ' + guardNo : ''}(批号 ${lot} / ${guardLot})`)
    } catch (e) { console.log('\n  ⚠ 清理失败: ' + String(e.message).split('\n')[0]) }
  }
  console.log(`\n═══ 结果: 通过 ${pass} / 失败 ${fail} ═══`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('PROBE FAIL: ' + e.stack); process.exit(1) })
