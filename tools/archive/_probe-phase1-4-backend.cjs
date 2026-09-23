/**
 * _probe-phase1-4-backend.cjs — 重启后验证 Phase 1~4 的后端侧改动
 *
 * 覆盖:
 *   ① 标准库 asm.proc 4 变体可读(Phase 4)
 *   ② RD_ASM_PROC 面板配置:工艺形态 字段 / 变体下拉 / 页结构(Phase 4)
 *   ③ 多语言:同字段切 en 取译名(Phase 1~4 的 label 与 alias)
 *   ④ 参照过滤 ref_filter 生效(Phase 1:只列已归档)
 *   ⑤ 样品编号表字段元数据(Phase 1)
 */
'use strict'
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'

let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  ' + e : ''}`)) }

async function main() {
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const lj = await lr.json()
  if (lj.code !== 200) throw new Error('登录失败: ' + JSON.stringify(lj))
  const H = { Authorization: `Bearer ${lj.data.token}` }
  console.log('登录成功')

  // ── ① asm.proc 4 变体 ──
  //  ⚠ 端点顺序不是业务序:StdLibController.list 的 SQL 是 `ORDER BY item_code, seq, id`,
  //    单条 item_code 时退化为**字母序** ⇒ 前端按 seq 自行重排(见 RecordSheetPanels.openLib)。
  //    故这里只断言"4 个变体齐备 + 每个的 seq 符合设计序",不断言接口返回顺序。
  console.log('\n① GET /api/stdlib/list?lib=asm.proc')
  const s = await (await fetch(`${BASE}/api/stdlib/list?lib=asm.proc&all=1`, { headers: H })).json()
  const byItem = new Map((s.data || []).map((r) => [r.item, r]))
  const items = [...byItem.keys()].sort()
  console.log('   条目(接口序):', (s.data || []).map((r) => r.item).join(' / '))
  check('HTTP/业务成功', s.code === 200)
  check('4 变体齐备(设计 4 个 sheet)', JSON.stringify(items) === JSON.stringify(['复合半成品', '成品', '机器包布', '裸棒'].sort()), JSON.stringify(items))
  const DESIGN_SEQ = { 裸棒: 10, 机器包布: 20, 复合半成品: 30, 成品: 40 }
  for (const [item, want] of Object.entries(DESIGN_SEQ)) {
    const r = byItem.get(item)
    check(`  ${item} seq=${want}(设计 sheet 序,前端据此重排)`, !!r && Number(r.seq) === want, r ? String(r.seq) : '缺')
  }
  for (const r of s.data || []) {
    let n = -1
    try { n = (JSON.parse(r.content).rows || []).length } catch { n = -1 }
    check(`  ${r.item} 正文可解析且含工序行(rows=${n})`, n > 0)
    check(`  ${r.item} content ≤ 4000(StdLibController 上限)`, String(r.content).length <= 4000, String(r.content).length)
  }

  // ── ② RD_ASM_PROC 面板配置 ──
  console.log('\n② GET /api/px/getPanelConfig?panelCode=RD_ASM_PROC')
  const cfg = await (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=RD_ASM_PROC`, { headers: H })).json()
  const allFields = [
    ...((cfg.data && cfg.data.dataSchema && cfg.data.dataSchema.fields) || []),
    ...(((cfg.data && cfg.data.detail && cfg.data.detail.tabs) || [])[0]?.fields || []),
  ]
  const xingtai = allFields.find((f) => (f.dataName || f.code) === '工艺形态')
  check('面板配置取回成功', cfg.code === 200)
  check('存在 工艺形态 字段(Phase 4 新增)', !!xingtai)
  if (xingtai) {
    console.log('   工艺形态:', JSON.stringify({ dataName: xingtai.dataName, dataType: xingtai.dataType, options: xingtai.options }))
    check('  工艺形态 为下拉框且 4 选项=设计变体名',
      xingtai.dataType === '下拉框' && JSON.stringify(xingtai.options) === JSON.stringify(['裸棒', '机器包布', '复合半成品', '成品']),
      JSON.stringify(xingtai.options))
  }

  // ── ③ 多语言(切 en)──
  //  ⚠ 后端字段对象的**数据键永远是中文**(ADR-0001:dataName/code 不随语言变),
  //    译名体现在 `displayName`(fieldSpec 的设计就是"displayName 与 label 不同才下发")。
  //    不要断言"找不到 code=工艺形态" —— 那是拿中文键去找英文名,必然落空。
  console.log('\n③ 多语言:Accept-Language: en')
  const en = await (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=RD_ASM_PROC`, { headers: { ...H, 'Accept-Language': 'en' } })).json()
  const enFields = [
    ...((en.data && en.data.dataSchema && en.data.dataSchema.fields) || []),
    ...(((en.data && en.data.detail && en.data.detail.tabs) || [])[0]?.fields || []),
  ]
  const enX = enFields.find((f) => f.code === '工艺形态' || f.dataName === '工艺形态')
  console.log('   en 工艺形态 =', JSON.stringify(enX ? { dataName: enX.dataName, displayName: enX.displayName } : null))
  check('工艺形态 中文数据键不变(ADR-0001 红线)', !!enX && enX.dataName === '工艺形态')
  check('工艺形态 显示名英文化(Process Form)', !!enX && /Process Form/i.test(enX.displayName || ''), enX ? enX.displayName : '')

  // ── ④ 参照过滤(normRef 语义:fieldSpec 走 field.filter;buildMeta 走 field.ref.filter)──
  //  engine.js 的 normRef:`const src = r.ref && typeof r.ref==='object' ? r.ref : r` ⇒ 两种形状都要覆盖
  console.log('\n④ 参照过滤:RD_SPEC_DOC 的 客户项目名称 应带 filter;编号 应不带')
  const spec = await (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=RD_SPEC_DOC`, { headers: H })).json()
  const sf = ((spec.data && spec.data.dataSchema && spec.data.dataSchema.fields) || [])
  const filterOf = (f) => (f && f.ref && typeof f.ref === 'object' ? f.ref.filter : f && f.filter)
  const cName = sf.find((f) => (f.code || f.dataName) === '客户项目名称')
  const bianhao = sf.find((f) => (f.code || f.dataName) === '编号')
  console.log('   客户项目名称 dataType =', cName && cName.dataType, ' filter =', JSON.stringify(filterOf(cName)))
  console.log('   编号        dataType =', bianhao && bianhao.dataType, ' filter =', JSON.stringify(filterOf(bianhao)))
  const f1 = filterOf(cName)
  check('客户项目名称 是参照且带 filter=单据状态:已归档', !!cName && cName.dataType === '参照' && !!f1 && f1['单据状态'] === '已归档', JSON.stringify(f1))
  check('编号 不带 filter(规格书在产品开发中编写,须能选在研产品)', !!bianhao && !filterOf(bianhao), JSON.stringify(filterOf(bianhao)))

  // ── ⑤ 样品编号表元数据(此处 H 无 Accept-Language ⇒ 中文基线)──
  //  ⚠ isRequired 挂在 **fieldSpec**(列表/明细字段);isNotNull 只在 buildMeta(表单描述)里。
  //    getPanelConfig 走 fieldSpec ⇒ 断言 isRequired。
  console.log('\n⑤ 样品编号表(RD_SAMPLE_NO)字段元数据')
  const sn = await (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=RD_SAMPLE_NO`, { headers: H })).json()
  const snDetail = (((sn.data && sn.data.detail && sn.data.detail.tabs) || [])[0]?.fields) || []
  const code = snDetail.find((f) => (f.code || f.dataName) === '客户项目代号')
  const no = snDetail.find((f) => (f.code || f.dataName) === '样品编号')
  console.log('   客户项目代号:', code ? JSON.stringify({ type: code.dataType, stdLib: code.stdLib, n: (code.options || []).length, first3: (code.options || []).slice(0, 3) }) : '(缺)')
  console.log('   样品编号:', JSON.stringify(no))
  check('客户项目代号 存在且为标准库字段(rd.customer_code)', !!code && code.dataType === '标准库' && code.stdLib === 'rd.customer_code')
  check('客户项目代号 下拉有选项(标准库 dict_sql 陷阱:写错会空白且无报错)', !!code && (code.options || []).length > 0,
    code ? 'options=' + (code.options || []).length : '')
  check('样品编号 存在且必填(isRequired)', !!no && no.isRequired === true, no ? JSON.stringify(no.isRequired) : '')

  console.log(`\n结果:${pass} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
