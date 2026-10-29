/**
 * _verify-spec-unique.mjs —— 验证「一产品一规格书」后端校验已生效
 * 用法: node _verify-spec-unique.mjs <已有规格书的产品编号> [base]
 *
 * 期望:对已被未作废规格书占用的产品编号,再保存一张 → 409 + 明确提示。
 */
const PROD = process.argv[2] || 'YJ-CB-2026-001'
const BASE = process.argv[3] || 'http://127.0.0.1:8090'

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
async function call(buttonName, formData) {
  return await (await fetch(BASE + '/api/px/callButton', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', buttonName, formData, buttonParam: {} }),
  })).json()
}

const mk = await call('提交', {})
const no = String(mk?.data?.['编号'] || '')
console.log('新建规格书 =', no)

const sv = await call('保存', { 编号: no, 产品编号: PROD, 名称: '重复产品测试', 单据日期: '2026-10-29' })
console.log('对已占用产品编号再保存:')
console.log('  code =', sv.code)
console.log('  msg  =', sv.message)
console.log(sv.code === 409 && /只能对应一张/.test(String(sv.message)) ? '\n✅ 后端校验已生效' : '\n❌ 校验未生效')

// 清理这张试验单
if (no) {
  const { execFileSync } = require('node:child_process')
  execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib/mssql-jdbc.jar', 'archive/_Query.java',
    'jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true',
    'yinjia', 'Yinjia@2026',
    `UPDATE rd_spec_doc_head SET asp_cancel='Y' WHERE 单据编号='${no}'; DELETE FROM yj_doc_status WHERE panel_code='RD_SPEC_DOC' AND doc_no='${no}';`],
    { cwd: 'C:/INCER/YINJIA-MES/tools', encoding: 'utf8' })
  console.log('试验单已作废')
}
