/**
 * _q-bom-sync.mjs —— 端到端:产品信息表归档 ⇒ BOM 自动写入物料清单(覆盖更新)
 * 用法: node _q-bom-sync.mjs [base]
 *
 * 验收四步(全部对**探针数据**做,做完作废/清理):
 *   ① 造一张产品信息表(产品编号 ZZ-SYNC-01 + 2 行 BOM)→ 提交审批 → 归档;
 *   ② 查 mate:应出现 m_no=ZZ-SYNC-01 的 2 行子件,字段映射正确;
 *   ③ **覆盖验证**:改 BOM(删 1 行、加 1 行)再归档一次 → mate 仍应只有 2 行(旧的被覆盖,不累加);
 *   ④ 清理探针数据。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { execFileSync } = require('node:child_process')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const PROD = 'ZZ-SYNC-01'
const out = []
const log = (k, v) => { out.push({ k, v }); console.log(k, '=', typeof v === 'object' ? JSON.stringify(v, null, 2) : v) }

function q(sql) {
  const r = execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib/mssql-jdbc.jar', 'archive/_Query.java',
    'jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true',
    'yinjia', 'Yinjia@2026', sql], { cwd: 'C:/INCER/YINJIA-MES/tools', encoding: 'utf8' })
  return r.trim()
}

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }

// 预清理(上次残留)
q(`DELETE FROM mate WHERE m_no='${PROD}';
   UPDATE rd_prod_info_head SET asp_cancel='Y' WHERE 产品编号='${PROD}';
   UPDATE rd_prod_info_detail SET asp_cancel='Y' WHERE 单据编号 IN (SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号='${PROD}');`)
log('预清理', 'done')

/** 建单 + 保存(带 BOM) */
async function saveProd(bom) {
  const mk = await (await fetch(BASE + '/api/px/callButton', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'RD_PROD_INFO', buttonName: '提交', formData: {}, buttonParam: {} }),
  })).json()
  const no = String(mk?.data?.['编号'] || '')
  if (!no) throw new Error('新建失败')
  const sv = await (await fetch(BASE + '/api/px/callButton', {
    method: 'POST', headers: H,
    body: JSON.stringify({
      panelCode: 'RD_PROD_INFO', buttonName: '保存',
      formData: { 编号: no, 产品编号: PROD, 产品名称: '同步验证件', 单据日期: '2026-10-29', detail: { items: bom } },
      buttonParam: {},
    }),
  })).json()
  return { no, sv }
}

function readMate() {
  return q(`SELECT m_no, wzdm1, wzmc1, wzdm2, wzmc2, gg2, bzl FROM mate WHERE m_no='${PROD}' ORDER BY wzdm2`)
}

// ── ① 第一次归档 ──
const first = await saveProd([
  { 序号: '1', 物料编号: 'ZZ-A', 物料名称: '子件甲', 尺寸规格: 'Φ10*20', 数量: '2' },
  { 序号: '2', 物料编号: 'ZZ-B', 物料名称: '子件乙', 尺寸规格: 'Φ12*30', 数量: '3' },
])
log('建单1', first.no)
log('保存1', JSON.stringify(first.sv).slice(0, 160))
// 管理员保存后走审批;看状态
const st1 = q(`SELECT panel_code, doc_no, archived, pending FROM yj_doc_status WHERE panel_code='RD_PROD_INFO' AND doc_no='${first.no}'`)
log('状态1', st1)

await new Promise((r) => setTimeout(r, 800))
log('mate(第一次归档后)', readMate())

// ── ③ 覆盖验证:改 BOM 再保存 ──
const second = await saveProd([
  { 序号: '1', 物料编号: 'ZZ-A', 物料名称: '子件甲改', 尺寸规格: 'Φ11*21', 数量: '5' },
  { 序号: '2', 物料编号: 'ZZ-C', 物料名称: '子件丙', 尺寸规格: 'Φ14*40', 数量: '7' },
])
await new Promise((r) => setTimeout(r, 800))
log('建单2', second.no)
log('mate(第二次后)', readMate())

// ── ④ 清理 ──
log('清理', q(`DELETE FROM mate WHERE m_no='${PROD}';
  UPDATE rd_prod_info_head SET asp_cancel='Y' WHERE 产品编号='${PROD}';
  UPDATE rd_prod_info_detail SET asp_cancel='Y' WHERE 单据编号 IN (SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号='${PROD}');
  SELECT COUNT(*) AS 残留 FROM mate WHERE m_no='${PROD}'`))

await fs.writeFile(new URL('./out-bom-sync.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
