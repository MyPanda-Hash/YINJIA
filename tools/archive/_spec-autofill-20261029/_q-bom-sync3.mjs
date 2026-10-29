/**
 * _q-bom-sync3.mjs —— 覆盖更新验证:同一产品编号改 BOM 再归档 ⇒ mate 只有新的一批,不累加
 * 用法: node _q-bom-sync3.mjs [base]
 *
 * 用户口径 B:「产品编号是唯一的,如果BOM更新了,就根据这个产品编号重新覆盖原来的BOM就行了」。
 * 判据(必须同时成立):
 *   ① 行数 = 新 BOM 行数(不是新旧之和);
 *   ② 旧子件(ZZ-B)消失、新子件(ZZ-C)出现;
 *   ③ 内容以最新一次为准(ZZ-A 的名称/规格/数量变成"改"后的值)。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { execFileSync } = require('node:child_process')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const PROD = 'ZZ-SYNC-02'
const out = []
const log = (k, v) => { out.push({ k, v }); console.log('\n' + k + ' ='); console.log(v) }

function q(sql) {
  return execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib/mssql-jdbc.jar', 'archive/_Query.java',
    'jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true',
    'yinjia', 'Yinjia@2026', sql], { cwd: 'C:/INCER/YINJIA-MES/tools', encoding: 'utf8' }).trim()
}

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
async function call(buttonName, formData, buttonParam = {}) {
  return (await (await fetch(BASE + '/api/px/callButton', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'RD_PROD_INFO', buttonName, formData, buttonParam }),
  })).json())
}

log('① 覆盖前 mate', q(`SELECT wzdm2, wzmc2, gg2, bzl FROM mate WHERE m_no='${PROD}' ORDER BY wzdm2`))

// 对已归档单:先「申请修改」经管理员审批 → 修改态,改 BOM 保存 → 再归档
// ⚠ 用 -noheaders 时 _Query 会打出表头行与 "-- (N rows) --",这里只取真正的单号形状
const rawNo = q(`SELECT TOP 1 单据编号 FROM rd_prod_info_head WHERE 产品编号='${PROD}' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY 单据编号 DESC`)
const no = (rawNo.match(/PI-\d{4}-\d{2}-\d{4}/) || [''])[0]
if (!no) { log('!! 没取到单号', rawNo); process.exit(1) }
log('目标单', no)

log('申请修改', JSON.stringify(await call('申请修改', { 编号: no, 修改原因: 'BOM 覆盖验证' }, {})).slice(0, 160))
log('修改审批通过', JSON.stringify(await call('修改审批通过', { 编号: no }, {})).slice(0, 160))

// 改 BOM:删 ZZ-B、加 ZZ-C、ZZ-A 全字段改
log('保存(改后)', JSON.stringify(await call('保存', {
  编号: no, 产品编号: PROD, 产品名称: '同步验证件', 单据日期: '2026-10-29',
  detail: { items: [
    { 序号: '1', 物料编号: 'ZZ-A', 物料名称: '子件甲改', 尺寸规格: 'Φ11*21', 数量: '5' },
    { 序号: '2', 物料编号: 'ZZ-C', 物料名称: '子件丙', 尺寸规格: 'Φ14*40', 数量: '7' },
  ] },
}, {})).slice(0, 160))

// 再归档(修改态 → 提交审批 → 一级 → 二级)
log('提交审批', JSON.stringify(await call('提交审批', { 编号: no }, {})).slice(0, 160))
log('一级', JSON.stringify(await call('审批通过', { 编号: no, 二级审批人: 'admin' }, {})).slice(0, 160))
log('二级', JSON.stringify(await call('审批通过', { 编号: no }, {})).slice(0, 160))
await new Promise((r) => setTimeout(r, 1000))

const after = q(`SELECT wzdm2, wzmc2, gg2, bzl FROM mate WHERE m_no='${PROD}' ORDER BY wzdm2`)
log('② 覆盖后 mate', after)

const rows = after.split('\n').filter((l) => l.includes('|'))
log('③ 判据', JSON.stringify({
  行数: rows.length,
  期望行数: 2,
  '旧子件 ZZ-B 已消失': !after.includes('ZZ-B'),
  '新子件 ZZ-C 已出现': after.includes('ZZ-C'),
  'ZZ-A 已更新为改后值': after.includes('子件甲改') && after.includes('5.0'),
}))

// 清理
log('清理', q(`DELETE FROM mate WHERE m_no='${PROD}';
  UPDATE rd_prod_info_head SET asp_cancel='Y' WHERE 产品编号='${PROD}';
  UPDATE rd_prod_info_detail SET asp_cancel='Y' WHERE 单据编号 IN (SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号='${PROD}');
  SELECT COUNT(*) AS mate残留 FROM mate WHERE m_no='${PROD}'`))

await fs.writeFile(new URL('./out-bom-sync3.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
