/**
 * _verify-auditor-owner.mjs —— 验三项:①审核人默认值 ②保存后显示 ③规格书分发后回填负责人且不改状态
 * 用法: node _verify-auditor-owner.mjs [base]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const { execFileSync } = await import('node:child_process')
const PROD = 'YJ-VERIFY-1029'
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

// 清场
q(`UPDATE rd_prod_info_head SET asp_cancel='Y' WHERE 产品编号='${PROD}'; DELETE FROM mate WHERE m_no='${PROD}';`)

// ══ ① 新建 + 保存(不显式传审核人)⇒ 默认值应自动写入 ══
const mk = await call('RD_PROD_INFO', '新增', {})
const no = String(mk?.data?.['编号'] || '')
console.log('\n新建 =', no)
const sv = await call('RD_PROD_INFO', '保存', {
  编号: no, 产品编号: PROD, 产品名称: '审核人默认值验证件', 单据日期: '2026-10-29',
  detail: { items: [{ 序号: '1', 物料编号: 'V-1', 物料名称: '验证料', 尺寸规格: 'Φ1', 数量: '1' }] },
})
console.log('保存 =', sv.code, sv.message)
const head = q(`SELECT 产品编号, 审核人一级, 审核人二级, 责任人 FROM rd_prod_info_head WHERE 单据编号='${no}'`)
console.log('库内 =', head)
ok(/冯敏/.test(head), '① 一级审核人默认值「冯敏」已自动写入')
ok(/陈秀丽/.test(head), '① 二级审核人默认值「陈秀丽」已自动写入')

// ══ ② 可以修改 ══
const sv2 = await call('RD_PROD_INFO', '保存', {
  编号: no, 产品编号: PROD, 产品名称: '审核人默认值验证件', 单据日期: '2026-10-29',
  审核人一级: '刘磊', 审核人二级: '柴善银',
  detail: { items: [{ 序号: '1', 物料编号: 'V-1', 物料名称: '验证料', 尺寸规格: 'Φ1', 数量: '1' }] },
})
const head2 = q(`SELECT 审核人一级, 审核人二级 FROM rd_prod_info_head WHERE 单据编号='${no}'`)
console.log('改后 =', sv2.code, '|', head2)
ok(/刘磊/.test(head2) && /柴善银/.test(head2), '② 审核人可人工修改(改后落库)')

// 改回默认,继续后续链路
await call('RD_PROD_INFO', '保存', {
  编号: no, 产品编号: PROD, 产品名称: '审核人默认值验证件', 单据日期: '2026-10-29',
  审核人一级: '冯敏', 审核人二级: '陈秀丽',
  detail: { items: [{ 序号: '1', 物料编号: 'V-1', 物料名称: '验证料', 尺寸规格: 'Φ1', 数量: '1' }] },
})

// ══ ③ 归档后再看接口能否读到(显示问题)══
await call('RD_PROD_INFO', '审批通过', { 编号: no, 二级审批人: 'admin', 审批意见: '一级通过' })
const arch = await call('RD_PROD_INFO', '审批通过', { 编号: no, 审批意见: '二级通过' })
console.log('归档 =', arch.code, arch?.data?.['单据状态'])

const list = await (await fetch(BASE + '/api/px/queryFormDataList', {
  method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'RD_PROD_INFO', pageNo: 1, pageSize: 500, condition: {} }),
})).json()
const row = (list?.data?.list || []).find((r) => String(r['单据编号']) === no) || {}
const auditKeys = Object.keys(row).filter((k) => /审核人（/.test(k))
console.log('接口返回的审核人键 =', auditKeys, '| 值 =', Object.fromEntries(Object.entries(row).filter(([k]) => /审核人（/.test(k))))
ok(auditKeys.length === 2, '③ 归档后接口仍返回两个审核人(纸面能显示)')

// ══ ④ 产品开发下发 → 规格书分发 → 回填负责人且不改状态 ══
const stateBefore = q(`SELECT ISNULL(archived,'N') AS archived, ISNULL(pending,'N') AS pending FROM yj_doc_status WHERE panel_code='RD_PROD_INFO' AND doc_no='${no}'`)
console.log('\n分发前状态 =', stateBefore)
await call('RD_PROD_INFO', '产品开发', { 编号: no })

// 分发规格书(先要有规格书草稿)
const specDraft = q(`SELECT TOP 1 单据编号 FROM rd_spec_doc_head WHERE 产品编号='${PROD}' AND ISNULL(asp_cancel,'N')<>'Y'`)
const specNo = (specDraft.match(/SD-\d{4}-\d{2}-\d{4}/) || [''])[0]
console.log('规格书单 =', specNo || '(需先分发才能自动建)')
// specAssign 要求先有规格书单:用「分发责任人」触发的自动建单
const dev = await call('RD_PROD_INFO', '分发责任人', { 编号: no, 分发责任人: { RD_SPEC_DOC: 'cp' } })
console.log('分发责任人 =', dev.code, JSON.stringify(dev.data || dev.message).slice(0, 200))

const specNo2 = (q(`SELECT TOP 1 单据编号 FROM rd_spec_doc_head WHERE 产品编号='${PROD}' AND ISNULL(asp_cancel,'N')<>'Y'`)
  .match(/SD-\d{4}-\d{2}-\d{4}/) || [''])[0]
console.log('规格书单(分发后) =', specNo2)

if (specNo2) {
  const asg = await call('RD_PROD_INFO', '规格书分发', { 编号: no, assigns: [{ 编号: specNo2, 责任人: 'cp' }] })
  console.log('规格书分发 =', asg.code, JSON.stringify(asg.data || asg.message).slice(0, 220))
  const owner = q(`SELECT 责任人 FROM rd_prod_info_head WHERE 单据编号='${no}'`)
  const stateAfter = q(`SELECT ISNULL(archived,'N') AS archived, ISNULL(pending,'N') AS pending FROM yj_doc_status WHERE panel_code='RD_PROD_INFO' AND doc_no='${no}'`)
  console.log('分发后 责任人 =', owner, '| 状态 =', stateAfter)
  ok(/陈秀丽/.test(owner), '④ 产品负责人已回填为规格书责任人「陈秀丽」(cp 的真实姓名)')
  ok(stateBefore === stateAfter, '④ 回填**没有改动**产品信息表的单据状态')
} else {
  console.log('FAIL 未建成规格书草稿,跳过 ④')
  fails++
}

console.log(`\n════ 结论: 失败 ${fails} 项 ════`)
