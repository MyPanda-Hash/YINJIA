/**
 * _flow-prodinfo.mjs —— 阶段3:产品信息表(全字段 + BOM 明细 → 两级审批归档 → BOM 同步物料清单)
 * 用法: node _flow-prodinfo.mjs [base]
 *
 * 验证重点(每条都要有库内证据):
 *   ① 35 个字段中可填的全部填满并落库;
 *   ② BOM 明细 4 行(物料编号/名称/尺寸规格/数量)落库;
 *   ③ 两级审批:一级通过 → 待二级审批 → 二级通过 → 已归档;
 *   ④ **归档触发 BOM 同步到物料清单(mate)** —— 字段映射正确;
 *   ⑤ 产品编号唯一性(同号第二张必须被拒)。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { execFileSync } = require('node:child_process')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const out = []
let fails = 0
const log = (k, v) => { out.push({ step: k, result: v }); console.log('\n── ' + k + ' ──'); console.log(typeof v === 'object' ? JSON.stringify(v, null, 2) : v) }
const ok = (c, m) => { console.log((c ? '  OK   ' : '  FAIL ') + m); if (!c) fails++; return !!c }

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
  return await (await fetch(BASE + '/api/px/callButton', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'RD_PROD_INFO', buttonName, formData, buttonParam }),
  })).json()
}

const PROD = 'YJ-CB-2026-001'   // 产品编号(唯一)
q(`DELETE FROM mate WHERE m_no='${PROD}';
   UPDATE rd_prod_info_head SET asp_cancel='Y' WHERE 产品编号='${PROD}';`)

// ══ 1. 新建 ══
const mk = await call('新增', {})
const docNo = String(mk?.data?.['编号'] || '')
log('1.新建', { code: mk.code, 单号: docNo, 状态: mk?.data?.['单据状态'] })
if (!docNo) { await fs.writeFile(new URL('./out-flow-prodinfo.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8'); process.exit(1) }
ok(mk.code === 200, '新建成功')

// ══ 2. 填满所有可填字段 + 4 行 BOM ══
const head = {
  编号: docNo,
  产品编号: PROD,
  产品名称: '高效除重金属炭棒滤芯 YKRS-200',
  单据日期: '2026-10-29',
  项目编号: 'XM-2026-CB-001',
  项目名称: '高效除重金属炭棒滤芯开发',
  立项文档编号: 'YJ-RD-2026-001',
  客户名称: '惠州市银嘉环保科技有限公司',
  客户项目名称: 'YKRS-200 净水器滤芯升级项目',
  客户料号: 'YKRS-200-CB-01',
  产品管控等级: 'A类',
  产品功能类别: '除重金属',
  产品类别: '炭棒滤芯',
  产品形态: '圆柱形',
  应用场景: '家用净水器二级滤芯位置,适配 YKRS-200 机型',
  产品整体尺寸: '外径 33mm ±0.5 / 内径 12mm ±0.3 / 长度 110mm ±0.5',
  炭棒外径: '33',
  炭棒内径: '12',
  炭棒长度: '110',
  主要性能描述: '除铅率 ≥98%、余氯去除率 ≥95%、压降 ≤0.02MPa、使用寿命 12 个月',
  下单数量: '500',
  客户图纸或规格书: '已随客户图纸 YKRS-200-DWG-02 确认',
  责任人: '系统管理员',   // ⚠ 数据键 = yj_field.label「产品负责人」→ 物理列名 责任人
  审核人一级: '系统管理员',
  审核人二级: '系统管理员',
  备注: '研发管理全流程验收 —— 产品信息表',
  detail: {
    items: [
      { 序号: '1', 物料编号: 'YJ-YKRS-007', 物料名称: '英克瑞斯酸洗炭', 尺寸规格: '碘值 1100 / 粒径 12×30 目', 数量: '0.05' },
      { 序号: '2', 物料编号: 'YJ-XWR-014', 物料名称: '白色无纺布 100g', 尺寸规格: '宽 60mm × 100g/㎡', 数量: '2' },
      { 序号: '3', 物料编号: 'YJ-JPL-067', 物料名称: '55 目透明网', 尺寸规格: '55 目 / 幅宽 80mm', 数量: '2' },
      { 序号: '4', 物料编号: 'YJ-DT-001', 物料名称: '端盖(PP)', 尺寸规格: '外径 33mm / 内径 12mm', 数量: '2' },
    ],
  },
}
const sv = await call('保存', head)
log('2.保存(全字段+BOM)', { code: sv.code, msg: sv.message, 状态: sv?.data?.['单据状态'] })
ok(sv.code === 200, '保存成功')

// ══ 2b. 字段完整性回查 ══
const filled = q(`SELECT 产品编号, 产品名称, 项目编号, 客户名称, 客户料号, 产品管控等级, 应用场景, 产品整体尺寸, 炭棒外径, 炭棒内径, 炭棒长度, 下单数量, 责任人 AS 产品负责人 FROM rd_prod_info_head WHERE 单据编号='${docNo}'`)
log('2b.头字段回查', filled)
const missing = q(`SELECT COUNT(*) AS 空字段数 FROM rd_prod_info_head WHERE 单据编号='${docNo}' AND (产品编号 IS NULL OR 产品名称 IS NULL OR 客户名称 IS NULL OR 客户料号 IS NULL OR 应用场景 IS NULL OR 产品整体尺寸 IS NULL)`)
log('2c.空字段检查', missing)
ok(missing.trim().split(/\r?\n/).filter((l) => /^\d+$/.test(l.trim())).pop() === '0', '关键字段全部落库(无空值)')

const bom = q(`SELECT 序号, 物料编号, 物料名称, 尺寸规格, 数量 FROM rd_prod_info_detail WHERE 单据编号='${docNo}' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY 序号`)
log('2d.BOM 明细回查', bom)
ok(bom.split(/\r?\n/).filter((l) => l.includes('YJ-')).length === 4, '4 行 BOM 全部落库')

// ══ 2e. 产品编号唯一性(同号第二张必须被拒)══
const mk2 = await call('新增', {})
const dupDoc = String(mk2?.data?.['编号'] || '')
const dupSave = await call('保存', { 编号: dupDoc, 产品编号: PROD, 产品名称: '重复编号测试', 单据日期: '2026-10-29' })
log('2e.产品编号唯一性', { code: dupSave.code, msg: dupSave.message })
ok(dupSave.code !== 200 && /占用/.test(String(dupSave.message)), '同号第二张被正确拒绝')
if (dupDoc) q(`UPDATE rd_prod_info_head SET asp_cancel='Y' WHERE 单据编号='${dupDoc}'`)

// ══ 3. 两级审批 ══
log('3.一级审批', JSON.stringify(await call('审批通过', { 编号: docNo, 二级审批人: 'admin', 审批意见: '一级通过' })).slice(0, 180))
log('3b.状态(应待二级)', q(`SELECT archived, pending FROM yj_doc_status WHERE panel_code='RD_PROD_INFO' AND doc_no='${docNo}'`))
log('3c.二级审批', JSON.stringify(await call('审批通过', { 编号: docNo, 审批意见: '二级通过' })).slice(0, 180))
await new Promise((r) => setTimeout(r, 1200))
log('3d.状态(应已归档)', q(`SELECT archived, pending FROM yj_doc_status WHERE panel_code='RD_PROD_INFO' AND doc_no='${docNo}'`))

// ══ 4. BOM 是否同步进物料清单 ══
const mate = q(`SELECT m_no, wzmc1, wzdm2, wzmc2, gg2, bzl FROM mate WHERE m_no='${PROD}' ORDER BY wzdm2`)
log('4.物料清单(mate)同步结果', mate)
const mateRows = mate.split(/\r?\n/).filter((l) => l.includes('YJ-')).length
ok(mateRows === 4, '4 行 BOM 已同步到物料清单(数量 ' + mateRows + ')')
ok(mate.includes('英克瑞斯酸洗炭') && mate.includes('0.05'), '映射正确:子件名称与标准用量(0.05)')

await fs.writeFile(new URL('./out-flow-prodinfo.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
console.log('\n════ 阶段3 结果: 失败 ' + fails + ' 项 ════')
console.log('产品信息表单号 =', docNo, '| 产品编号 =', PROD)
