/**
 * _verify-final.mjs —— 三项需求终验(用正确的 label 作 payload 键)
 * 用法: node _verify-final.mjs [base]
 *
 * ⚠ 教训(上一版误判):callButton 的 formData **键必须是 yj_field.label**,
 *   不是物理列名。审核人的 label 是「审核人（一级审批人）」/「审核人（二级审批人）」,
 *   列名才是 审核人一级/审核人二级 —— 传列名会被 labelsToCols 直接丢弃(静默)。
 *   这不是缺陷,是引擎的既有契约(ADR-0001:数据键 = label)。
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const { execFileSync } = await import('node:child_process')
const PROD1 = 'YJ-FINAL-01'
const PROD2 = 'YJ-FINAL-02'
let fails = 0
const ok = (c, m) => { console.log((c ? '  OK   ' : '  FAIL ') + m); if (!c) fails++; return !!c }
const q = (sql) => execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib/mssql-jdbc.jar', 'archive/_Query.java',
  'jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true',
  'yinjia', 'Yinjia@2026', sql], { cwd: 'C:/INCER/YINJIA-MES/tools', encoding: 'utf8' }).trim()

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const tk = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }
const call = async (panel, btn, data) => await (await fetch(BASE + '/api/px/callButton', {
  method: 'POST', headers: H, body: JSON.stringify({ panelCode: panel, buttonName: btn, formData: data, buttonParam: {} }),
})).json()

q(`UPDATE rd_prod_info_head SET asp_cancel='Y' WHERE 产品编号 IN ('${PROD1}','${PROD2}');`)

// ═══ 需求① 默认值 + ② 可修改 ═══
const mk = await call('RD_PROD_INFO', '新增', {})
const no1 = String(mk?.data?.['编号'] || '')
const d1 = await call('RD_PROD_INFO', '保存为草稿', {
  编号: no1, 产品编号: PROD1, 产品名称: '终验件一', 单据日期: '2026-10-29',
})
const h1 = q(`SELECT 审核人一级 AS 一级, 审核人二级 AS 二级 FROM rd_prod_info_head WHERE 单据编号='${no1}'`)
console.log('\n①默认值 =', h1.replace(/\n/g, ' '))
ok(/冯敏/.test(h1) && /陈秀丽/.test(h1), '① 默认值 = 冯敏 / 陈秀丽(自动写入)')

const d2 = await call('RD_PROD_INFO', '保存为草稿', {
  编号: no1, 产品编号: PROD1, 产品名称: '终验件一', 单据日期: '2026-10-29',
  '审核人（一级审批人）': '刘磊', '审核人（二级审批人）': '柴善银',
})
const h2 = q(`SELECT 审核人一级 AS 一级, 审核人二级 AS 二级 FROM rd_prod_info_head WHERE 单据编号='${no1}'`)
console.log('②人工改 =', h2.replace(/\n/g, ' '))
ok(/刘磊/.test(h2) && /柴善银/.test(h2), '② 可人工修改并落库')

// 再存一次(仍传人工值),不能被默认值抢回
await call('RD_PROD_INFO', '保存为草稿', {
  编号: no1, 产品编号: PROD1, 产品名称: '终验件一', 单据日期: '2026-10-29',
  '审核人（一级审批人）': '刘磊', '审核人（二级审批人）': '柴善银',
})
const h3 = q(`SELECT 审核人一级 AS 一级 FROM rd_prod_info_head WHERE 单据编号='${no1}'`)
ok(/刘磊/.test(h3), '② 再次保存不会抢回默认值')

// 恢复默认并走完整审批归档
await call('RD_PROD_INFO', '保存为草稿', {
  编号: no1, 产品编号: PROD1, 产品名称: '终验件一', 单据日期: '2026-10-29',
  '审核人（一级审批人）': '冯敏', '审核人（二级审批人）': '陈秀丽',
})
await call('RD_PROD_INFO', '保存', {
  编号: no1, 产品编号: PROD1, 产品名称: '终验件一', 单据日期: '2026-10-29',
  '审核人（一级审批人）': '冯敏', '审核人（二级审批人）': '陈秀丽',
  detail: { items: [{ 序号: '1', 物料编号: 'F-1', 物料名称: '终验料', 尺寸规格: 'Φ1', 数量: '1' }] },
})
await call('RD_PROD_INFO', '审批通过', { 编号: no1, 二级审批人: 'admin', 审批意见: '一级通过' })
const arch = await call('RD_PROD_INFO', '审批通过', { 编号: no1, 审批意见: '二级通过' })
console.log('归档 =', arch.code, arch?.data?.['单据状态'])

// ═══ 需求③ 归档后仍能读到(显示)═══
const list = await (await fetch(BASE + '/api/px/queryFormDataList', {
  method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'RD_PROD_INFO', pageNo: 1, pageSize: 500, condition: {} }),
})).json()
const row = (list?.data?.list || []).find((r) => String(r['单据编号']) === no1) || {}
const keys = Object.keys(row).filter((k) => /审核人（/.test(k))
console.log('③归档后接口返回 =', keys, Object.fromEntries(Object.entries(row).filter(([k]) => /审核人（/.test(k))))
ok(keys.length === 2, '③ 归档后纸面仍能显示两个审核人')

// ═══ 需求④ 规格书分发 → 回填产品负责人 + 不改状态 ═══
const stBefore = q(`SELECT ISNULL(archived,'N') AS a FROM yj_doc_status WHERE panel_code='RD_PROD_INFO' AND doc_no='${no1}'`)
await call('RD_PROD_INFO', '分发责任人', { 编号: no1, 分发责任人: { RD_SPEC_DOC: 'cp' } })
const specNo = (q(`SELECT TOP 1 单据编号 FROM rd_spec_doc_head WHERE 产品编号='${PROD1}' AND ISNULL(asp_cancel,'N')<>'Y'`)
  .match(/SD-\d{4}-\d{2}-\d{4}/) || [''])[0]
console.log('规格书 =', specNo)
if (specNo) {
  const asg = await call('RD_PROD_INFO', '规格书分发', { 编号: no1, assigns: [{ 编号: specNo, 责任人: 'cp' }] })
  console.log('规格书分发 =', asg.code, JSON.stringify(asg.data || asg.message).slice(0, 160))
  const owner = q(`SELECT 责任人 FROM rd_prod_info_head WHERE 单据编号='${no1}'`)
  const stAfter = q(`SELECT ISNULL(archived,'N') AS a FROM yj_doc_status WHERE panel_code='RD_PROD_INFO' AND doc_no='${no1}'`)
  console.log('④责任人 =', owner.replace(/\n/g, ' '), '| 状态前后 =', stBefore.replace(/\n/g, ' '), '/', stAfter.replace(/\n/g, ' '))
  ok(/陈秀丽/.test(owner), '④ 产品负责人回填为规格书责任人「陈秀丽」')
  ok(stBefore === stAfter, '④ 回填未改动产品信息表状态(仍为已归档)')
} else {
  console.log('  FAIL 未建成规格书'); fails++
}

console.log(`\n════ 终验结论: 失败 ${fails} 项 ════`)
