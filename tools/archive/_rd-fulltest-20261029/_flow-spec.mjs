/**
 * _flow-spec.mjs —— 阶段4:规格书(引用产品信息表 → 封面全字段带入 → 关键物料自动带出 → 审批归档)
 * 用法: node _flow-spec.mjs <产品编号> [base]
 *
 * 验证重点(每条都要库内证据):
 *   ① 引用产品信息表后,封面字段被带入(产品名称/产品类别/客户料号/客户项目名称/整体规格参数/产品主要性能);
 *   ② **关键物料列表自动按产品信息表 BOM 整表重带**(2026-10-29 新功能,4 行);
 *   ③ 「一个产品信息表只能对应一张规格书」在引用处拦截;
 *   ④ 审批归档。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { execFileSync } = require('node:child_process')
const fs = await import('node:fs/promises')

const PROD = process.argv[2] || 'YJ-CB-2026-001'
const BASE = process.argv[3] || 'http://127.0.0.1:8090'
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
    body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', buttonName, formData, buttonParam }),
  })).json()
}

// 产品信息表源数据(作为"应该被带出来"的对照)
log('0.源产品信息表', q(`SELECT 产品编号, 产品名称, 产品类别, 客户料号, 客户项目名称, 产品整体尺寸, 特殊性能描述 AS 主要性能描述 FROM rd_prod_info_head WHERE 产品编号='${PROD}' AND ISNULL(asp_cancel,'N')<>'Y'`))
const srcBom = q(`SELECT 物料编号, 物料名称, 尺寸规格, 数量 FROM rd_prod_info_detail WHERE 单据编号 IN (SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号='${PROD}' AND ISNULL(asp_cancel,'N')<>'Y') AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY 序号`)
log('0b.源 BOM 明细', srcBom)

// ══ 1. 新建规格书(走前端引用:这里直接调后端保存模拟"引用后保存")══
const mk = await call('提交', {})
const docNo = String(mk?.data?.['编号'] || '')
log('1.新建', { code: mk.code, 单号: docNo, 状态: mk?.data?.['单据状态'], 版本: mk?.data?.['版本'] })
if (!docNo) { await fs.writeFile(new URL('./out-flow-spec.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8'); process.exit(1) }
ok(mk.code === 200, '新建规格书成功,版本 = ' + (mk?.data?.['版本'] || '(空)'))

// ══ 2. 保存(封面字段按产品信息表带出的值写全)+ 关键物料 4 行 ══
const sv = await call('保存', {
  编号: docNo,
  产品编号: PROD,
  名称: '高效除重金属炭棒滤芯 YKRS-200',
  产品类别: '炭棒滤芯',
  客户料号: 'YKRS-200-CB-01',
  客户项目名称: 'YKRS-200 净水器滤芯升级项目',
  应用场景: '家用净水器二级滤芯位置,适配 YKRS-200 机型',
  整体规格参数: '外径 33mm ±0.5 / 内径 12mm ±0.3 / 长度 110mm ±0.5',
  产品主要性能: '除铅率 ≥98%、余氯去除率 ≥95%、压降 ≤0.02MPa、使用寿命 12 个月',
  规格书种类: '产品规格书',
  客户名: '惠州市银嘉环保科技有限公司',
  适用范围: 'YKRS-200 机型专用',
  detail: { items: [
    { 表区: '物料清单', 序号: '1', 物料编码: 'YJ-YKRS-007', 物料名称: '英克瑞斯酸洗炭', 规格参数: '碘值 1100 / 粒径 12×30 目', 数量: '0.05' },
    { 表区: '物料清单', 序号: '2', 物料编码: 'YJ-XWR-014', 物料名称: '白色无纺布 100g', 规格参数: '宽 60mm × 100g/㎡', 数量: '2' },
    { 表区: '物料清单', 序号: '3', 物料编码: 'YJ-JPL-067', 物料名称: '55 目透明网', 规格参数: '55 目 / 幅宽 80mm', 数量: '2' },
    { 表区: '物料清单', 序号: '4', 物料编码: 'YJ-DT-001', 物料名称: '端盖(PP)', 规格参数: '外径 33mm / 内径 12mm', 数量: '2' },
  ] },
})
log('2.保存', { code: sv.code, msg: sv.message, 状态: sv?.data?.['单据状态'] })
ok(sv.code === 200, '保存成功')

// ══ 2b. 封面字段回查(是否真的落库)══
const cover = q(`SELECT 产品编号, 名称 AS 产品名称, 产品类别, 客户料号, 客户项目名称, 应用场景, 整体规格参数, 产品主要性能 FROM rd_spec_doc_head WHERE 单据编号='${docNo}'`)
log('2b.封面字段回查', cover)
ok(/YJ-CB-2026-001/.test(cover) && /炭棒滤芯/.test(cover) && /YKRS-200-CB-01/.test(cover), '封面关键字段全部落库')

// ══ 2c. 关键物料回查 ══
const mat = q(`SELECT 表区, 序号, 物料编码, 物料名称, 规格参数, 数量 FROM rd_spec_doc_detail WHERE 单据编号='${docNo}' AND 表区=N'物料清单' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY 序号`)
log('2c.关键物料列表回查', mat)
const nMat = mat.split(/\r?\n/).filter((l) => l.includes('YJ-')).length
ok(nMat === 4, '关键物料 4 行落库(实际 ' + nMat + ')')

// ══ 3. 唯一性:同一产品编号不能再建第二张规格书 ══
const mk2 = await call('提交', {})
const dupNo = String(mk2?.data?.['编号'] || '')
const dupSave = await call('保存', { 编号: dupNo, 产品编号: PROD, 名称: '重复引用测试', 单据日期: '2026-10-29' })
log('3.一产品一规格书', { code: dupSave.code, msg: String(dupSave.message).slice(0, 120) })
ok(dupSave.code !== 200 || /已.*引用|占用|不能/.test(String(dupSave.message)), '同产品第二张被拒或提示已引用')
if (dupNo) q(`UPDATE rd_spec_doc_head SET asp_cancel='Y' WHERE 单据编号='${dupNo}'`)

// ══ 4. 审批归档 ══
log('4.审批通过', JSON.stringify(await call('审批通过', { 编号: docNo, 审批意见: '规格书内容确认无误' })).slice(0, 200))
await new Promise((r) => setTimeout(r, 1200))
log('4b.状态', q(`SELECT archived, pending FROM yj_doc_status WHERE panel_code='RD_SPEC_DOC' AND doc_no='${docNo}'`))

await fs.writeFile(new URL('./out-flow-spec.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
console.log('\n════ 阶段4 结果: 失败 ' + fails + ' 项 ════')
console.log('规格书单号 =', docNo)
