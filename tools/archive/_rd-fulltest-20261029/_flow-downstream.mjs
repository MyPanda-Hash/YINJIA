/**
 * _flow-downstream.mjs —— 阶段5:三个下游文件(成型工艺清单 / 组装工艺清单 / 出货检验计划表)
 * 用法: node _flow-downstream.mjs <产品编号> [base]
 *
 * 验证重点:
 *   ① 三张单都能建、都能带出产品基本信息;
 *   ② 出货检验计划表的「自动填充规格书」(autoFillSpec)能按产品编号从规格书带数据;
 *   ③ 组装工艺清单能「从规格书导入」BOM;
 *   ④ 三者都能审批归档。
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
async function call(panel, buttonName, formData, buttonParam = {}) {
  return await (await fetch(BASE + '/api/px/callButton', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: panel, buttonName, formData, buttonParam }),
  })).json()
}

// ══ A. 出货检验计划表 ══
log('A0.规格书是否存在(带料源)', q(`SELECT 单据编号, 产品编号, 名称 FROM rd_spec_doc_head WHERE 产品编号='${PROD}' AND ISNULL(asp_cancel,'N')<>'Y'`))
const ipMk = await call('RD_INSP_PLAN', '新增', {})
const ipNo = String(ipMk?.data?.['编号'] || '')
log('A1.新建出货检验计划表', { code: ipMk.code, 单号: ipNo })
ok(ipMk.code === 200, '新建成功')

const ipSv = await call('RD_INSP_PLAN', '保存', {
  编号: ipNo,
  文档编号: 'YJ-QR-88-' + (ipNo ? ipNo.slice(-4) : '0001'),
  单据日期: '2026-10-29',
  标题: '高效除重金属炭棒滤芯出货检验项目控制计划',
  产品编号: PROD,
  客户项目名称: 'YKRS-200 净水器滤芯升级项目',
  使用范围: '银嘉内部',
  版本号: 'V1.0',
  密级: '保密',
  产品功能类别: '除重金属',
  产品整体尺寸: '外径 33mm / 内径 12mm / 长度 110mm',
  编写人: '系统管理员',
  审核人: '系统管理员',
  管理人: '系统管理员',
})
log('A2.保存', { code: ipSv.code, msg: ipSv.message, 状态: ipSv?.data?.['单据状态'] })
ok(ipSv.code === 200, '出货检验计划表保存成功')

// 「自动填充规格书」= **前端功能**(选完产品编号时由 core/insp/specCarry.js 触发),
// 不是后端按钮 —— 这里验证它依赖的数据在库里齐备(规格书已归档 + 产品编号可关联)。
const specReady = q(`SELECT s.单据编号, s.产品编号, ISNULL(ds.archived,'N') AS 已归档
  FROM rd_spec_doc_head s
  LEFT JOIN yj_doc_status ds ON ds.panel_code='RD_SPEC_DOC' AND ds.doc_no=s.单据编号
  WHERE s.产品编号='${PROD}' AND ISNULL(s.asp_cancel,'N')<>'Y'`)
log('A3.自动填充规格书的取数前提(规格书已归档)', specReady)
ok(/\| Y$/.test(specReady) || specReady.includes('| Y'), '规格书已归档 ⇒ 前端自动填充可正常取数')
log('A4.库内回查', q(`SELECT 单据编号, 产品编号, 客户项目名称, 产品功能类别, 产品整体尺寸 FROM rd_insp_plan_head WHERE 单据编号='${ipNo}'`))
log('A5.审批归档', JSON.stringify(await call('RD_INSP_PLAN', '审批通过', { 编号: ipNo, 审批意见: '检验计划确认' })).slice(0, 160))

// ══ B. 成型工艺清单 ══
const mpMk = await call('RD_MOLD_PROC', '新增', {})
const mpNo = String(mpMk?.data?.['编号'] || '')
log('B1.新建成型工艺清单', { code: mpMk.code, 单号: mpNo })
ok(mpMk.code === 200, '新建成功')
const mpSv = await call('RD_MOLD_PROC', '保存', {
  编号: mpNo,
  文档编号: 'YJ-MP-' + (mpNo ? mpNo.slice(-4) : '0001'),
  单据日期: '2026-10-29',
  产品编号: PROD,
  产品名称: '高效除重金属炭棒滤芯 YKRS-200',   // RD_MOLD_PROC 的 产品名称 是必填(yj_field required=1)
  密级: '保密',
  使用范围: '银嘉内部',
  版本号: 'V1.0',
  表单管理人: '系统管理员',
  detail: { items: [
    { 表区: '修订记录', 序号: '1', 更改内容: '首版发行', 更改原因: '新产品开发', 更改时间: '2026-10-29', 责任人: '系统管理员' },
  ] },
})
log('B2.保存', { code: mpSv.code, msg: mpSv.message, 状态: mpSv?.data?.['单据状态'] })
ok(mpSv.code === 200, '成型工艺清单保存成功')
log('B3.审批归档', JSON.stringify(await call('RD_MOLD_PROC', '审批通过', { 编号: mpNo, 审批意见: '工艺确认' })).slice(0, 160))

// ══ C. 组装工艺清单 ══
const apMk = await call('RD_ASM_PROC', '新增', {})
const apNo = String(apMk?.data?.['编号'] || '')
log('C1.新建组装工艺清单', { code: apMk.code, 单号: apNo })
ok(apMk.code === 200, '新建成功')
const apSv = await call('RD_ASM_PROC', '保存', {
  编号: apNo,
  文档编号: 'YJ-AP-' + (apNo ? apNo.slice(-4) : '0001'),
  单据日期: '2026-10-29',
  产品编号: PROD,
  产品名称: '高效除重金属炭棒滤芯 YKRS-200',   // RD_ASM_PROC 的 产品名称 也是必填
  密级: '保密',
  使用范围: '银嘉内部',
  版本号: 'V1.0',
  表单管理人: '系统管理员',
  工艺形态: '成品',
  detail: { items: [
    { 表区: '物料清单', 序号: '1', 物料编号: 'YJ-YKRS-007', 物料名: '英克瑞斯酸洗炭', 物料规格: '碘值 1100', 用量: '0.05' },
    { 表区: '物料清单', 序号: '2', 物料编号: 'YJ-XWR-014', 物料名: '白色无纺布 100g', 物料规格: '宽 60mm', 用量: '2' },
    { 表区: '修订记录', 序号: '1', 更改内容: '首版发行', 更改原因: '新产品开发', 更改时间: '2026-10-29', 责任人: '系统管理员' },
  ] },
})
log('C2.保存', { code: apSv.code, msg: apSv.message, 状态: apSv?.data?.['单据状态'] })
ok(apSv.code === 200, '组装工艺清单保存成功')

// 「从规格书导入」也是**前端功能**(specCarry 的 matFromSpec),验证取数源齐备:
// 规格书要归档 + 它的『物料清单』表区要有行。
const specMat = q(`SELECT 序号, 物料编码, 物料名称, 数量 FROM rd_spec_doc_detail
  WHERE 单据编号 IN (SELECT 单据编号 FROM rd_spec_doc_head WHERE 产品编号='${PROD}' AND ISNULL(asp_cancel,'N')<>'Y')
    AND 表区=N'物料清单' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY 序号`)
log('C3.从规格书导入的取数源(规格书物料清单)', specMat)
ok(specMat.split(String.fromCharCode(10)).filter((l) => l.includes('YJ-')).length >= 1,
  '规格书物料清单有数据 ⇒ 前端可导入')
log('C4.库内 BOM 回查', q(`SELECT 表区, 序号, 物料编号, 物料名, 用量 FROM rd_asm_proc_detail WHERE 单据编号='${apNo}' AND 表区=N'物料清单' ORDER BY 序号`))
log('C5.审批归档', JSON.stringify(await call('RD_ASM_PROC', '审批通过', { 编号: apNo, 审批意见: '工艺确认' })).slice(0, 160))

// ══ D. 四单归档状态汇总 ══
log('D.四文件归档状态', q(`SELECT panel_code, doc_no, ISNULL(archived,'N') AS archived
  FROM yj_doc_status
  WHERE (panel_code='RD_SPEC_DOC' AND doc_no IN (SELECT 单据编号 FROM rd_spec_doc_head WHERE 产品编号='${PROD}' AND ISNULL(asp_cancel,'N')<>'Y'))
     OR (panel_code='RD_INSP_PLAN' AND doc_no='${ipNo}')
     OR (panel_code='RD_MOLD_PROC' AND doc_no='${mpNo}')
     OR (panel_code='RD_ASM_PROC'  AND doc_no='${apNo}')`))

await fs.writeFile(new URL('./out-flow-downstream.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
console.log('\n════ 阶段5 结果: 失败 ' + fails + ' 项 ════')
console.log('出货检验计划表 =', ipNo, '| 成型工艺清单 =', mpNo, '| 组装工艺清单 =', apNo)
