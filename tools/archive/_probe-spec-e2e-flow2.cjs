/**
 * _probe-spec-e2e-flow2.cjs —— 规格书数据 + 两条跨面板导入链的端到端验证(2026-10-13)
 *
 * 用户要求:「写一个规格书的数据然后进行一个小的流程验证,测试刚才的功能是否正确运行了」。
 * (本文件取代 _probe-spec-e2e-flow.cjs —— 那份被我用 PowerShell Set-Content 回写时按 ANSI
 *  读 UTF-8 弄坏了中文,且违反"不要用 shell 命令写回文件"的规范;留档作反面教材。)
 *
 * 验证四件事:
 *   ① cp(非管理员)新建规格书单 → 填 产品编号=CSCS + 「检验要求」2 行 + 「物料清单」2 行
 *      ⇒ 状态应是「审批中」(未审批)。⚠ 必须用 cp:admin 在这张表上「保存」= 保存即归档,
 *      造不出"存在但未审批"这个待验状态;也必须是**新建单**,因为已归档的单压不回未审批。
 *   ② **未审批**时两条链都必须**一个格都不带**(reason=not_approved):
 *        /px/specByProduct(出货检验计划表) 与 /px/specByProductForAsm(组装工艺清单 BOM)
 *   ③ admin 审批通过 → 已归档后,两条链各自带回**自己表区**的行
 *   ④ 互不串表:检验链的行不含物料列、BOM 链的行不含检验列
 *
 * 明细载荷格式取自 SelectVoucherDialog.vue:393 —— formData.detail.items。
 * 账套 YJ_TEST;会在测试库新建 1 张规格书单(单号见输出),清理语句在末尾。
 * 用法:node tools/archive/_probe-spec-e2e-flow2.cjs
 */
'use strict'

const API = 'http://127.0.0.1:8090/api'
const FACTORY = 'YJ_TEST'
const PRODUCT = 'CSCS'

let PASS = 0, FAIL = 0
function check(id, expect, ok, actual) {
  if (ok) PASS++; else FAIL++
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${id}\n        期望: ${expect}\n        实际: ${actual}`)
}
const show = (r) => `code=${r.code} msg=「${r.msg}」`

async function login(u) {
  const r = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: u, password: '123456', factory: FACTORY }),
  })).json()
  if (r?.code !== 200) throw new Error(`登录失败 ${u}`)
  return { token: r.data.token, name: r.data.user.realName, isAdmin: r.data.user.isAdmin }
}

async function call(tk, buttonName, formData) {
  const x = await fetch(`${API}/px/callButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
    body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', buttonName, formData: formData || {}, buttonParam: {} }),
  })
  let j = null
  const t = await x.text()
  try { j = JSON.parse(t) } catch { /* 非 JSON 响应 */ }
  return { code: j?.code ?? x.status, msg: j?.message ?? t.slice(0, 120), data: j?.data }
}

const getSpec = async (tk, url) =>
  (await (await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${tk}` } })).json())?.data || {}

/** 规格书两张表区的样例数据(键一律中文字段 label —— 本项目铁律) */
const DETAIL = [
  { 表区: '检验要求', 序号: '1', 检验项目: '外观', 检验要求: '无黑点、无破损、无毛刺', 检验方法: '目视检查', 检验依据: 'YJ-Q-30' },
  { 表区: '检验要求', 序号: '2', 检验项目: '尺寸', 检验要求: '外径 20±0.5mm、长度 250±2mm', 检验方法: '游标卡尺', 检验依据: 'YJ-Q-30' },
  { 表区: '物料清单', 序号: '1', 物料编码: 'M-001', 物料名称: '炭棒', 规格参数: '', 数量: '1', 备注: '' },
  { 表区: '物料清单', 序号: '2', 物料编码: 'M-003', 物料名称: '炭纤维', 规格参数: '', 数量: '1', 备注: '' },
]

async function main() {
  console.log(`\n=== 规格书数据 + 跨面板导入链端到端验证(账套 ${FACTORY} / 产品 ${PRODUCT}) ===`)
  const ad = await login('admin')
  const cp = await login('cp')
  console.log(`  admin=${ad.name}(isAdmin=${ad.isAdmin}) / cp=${cp.name}(isAdmin=${cp.isAdmin})`)

  console.log('\n──────── ① cp 新建规格书单并写入数据 ────────')
  const rDraft = await call(cp.token, '保存为草稿', {})
  const docNo = String(rDraft.data?.['编号'] ?? '')
  console.log(`  [cp] 新建草稿: ${show(rDraft)} → 单号 ${docNo || '(无)'}`)
  check('0-newdoc', 'cp 能新建规格书草稿(拿到单号)', rDraft.code === 200 && !!docNo, `单号=${docNo || '(无)'}`)
  if (!docNo) throw new Error('没拿到新单号,后续无法验证')

  const rSave = await call(cp.token, '保存', {
    编号: docNo, 单据日期: '2026-10-13', 产品编号: PRODUCT, detail: { items: DETAIL },
  })
  console.log(`  [cp] 保存(带数据): ${show(rSave)}`)
  check('1-save', 'cp 保存成功', rSave.code === 200, show(rSave))
  const st1 = String(rSave.data?.['单据状态'] ?? '')
  console.log(`  保存后状态 = 「${st1}」`)
  check('1b-not-approved', '状态确为未审批(审批中/待二级审批/草稿)',
    ['审批中', '待二级审批', '草稿'].includes(st1), `状态=「${st1}」`)

  console.log('\n──────── ② 未审批时两条链应"一个格都不带" ────────')
  const insp0 = await getSpec(ad.token, `/px/specByProduct?code=${encodeURIComponent(PRODUCT)}`)
  const asm0 = await getSpec(ad.token, `/px/specByProductForAsm?code=${encodeURIComponent(PRODUCT)}`)
  check('2a-insp-blocked', '出货检验链: found=false 且 reason=not_approved',
    insp0.found === false && insp0.reason === 'not_approved',
    `found=${insp0.found} reason=${insp0.reason} 规格书=${insp0['规格书编号'] || ''} 状态=${insp0['规格书状态'] || ''} items=${(insp0.items || []).length}`)
  check('2b-asm-blocked', '组装BOM链: found=false 且 reason=not_approved',
    asm0.found === false && asm0.reason === 'not_approved',
    `found=${asm0.found} reason=${asm0.reason} items=${(asm0.items || []).length}`)

  console.log('\n──────── ③ admin 审批通过 → 已归档后取数 ────────')
  const rApp = await call(ad.token, '审批通过', { 编号: docNo })
  const st2 = String(rApp.data?.['单据状态'] ?? '')
  console.log(`  [admin] 审批通过: ${show(rApp)} → 状态「${st2}」`)
  check('3-archived', '规格书进入「已审核/已归档」(门禁放行前提)',
    st2 === '已审核' || st2 === '已归档', `状态=「${st2}」`)

  const insp1 = await getSpec(ad.token, `/px/specByProduct?code=${encodeURIComponent(PRODUCT)}`)
  const asm1 = await getSpec(ad.token, `/px/specByProductForAsm?code=${encodeURIComponent(PRODUCT)}`)
  console.log(`  检验链: found=${insp1.found} matched=${insp1.matched} items=${(insp1.items || []).length}`)
  console.log(`        首行 = ${JSON.stringify((insp1.items || [])[0] || {})}`)
  console.log(`  BOM 链: found=${asm1.found} matched=${asm1.matched} items=${(asm1.items || []).length}`)
  console.log(`        首行 = ${JSON.stringify((asm1.items || [])[0] || {})}`)

  check('4a-insp-found', '审批后检验链 found=true 且带回 2 条「检验要求」行',
    insp1.found === true && (insp1.items || []).length === 2, `found=${insp1.found} items=${(insp1.items || []).length}`)
  check('4b-asm-found', '审批后 BOM 链 found=true 且带回 2 条「物料清单」行',
    asm1.found === true && (asm1.items || []).length === 2, `found=${asm1.found} items=${(asm1.items || []).length}`)
  check('4c-no-cross', '互不串表:检验链的行不含物料列、BOM 链的行不含检验列',
    (insp1.items || []).every((r) => !r['物料编码'] && !r['物料名称'])
      && (asm1.items || []).every((r) => !r['检验项目'] && !r['检验要求']),
    `检验链=${(insp1.items || []).some((r) => r['物料编码']) ? '混入物料列!' : '干净'} / BOM链=${(asm1.items || []).some((r) => r['检验项目']) ? '混入检验列!' : '干净'}`)
  check('5-insp-cols', '检验链的行带着 检验项目/检验要求/检验方法',
    (insp1.items || []).every((r) => r['检验项目'] && r['检验要求'] && r['检验方法'] !== undefined),
    JSON.stringify((insp1.items || [])[0] || {}))
  check('5b-asm-cols', 'BOM 链的行带着 物料编码/物料名称',
    (asm1.items || []).every((r) => r['物料编码'] && r['物料名称']),
    JSON.stringify((asm1.items || [])[0] || {}))

  console.log('\n════════ 汇总 ════════')
  console.log(`格子数=${PASS + FAIL}  PASS=${PASS}  FAIL=${FAIL}`)
  console.log(`\n本次新建的规格书单号 = ${docNo}(测试库 ${FACTORY},产品编号=${PRODUCT},已归档)`)
  console.log(`清理(需要时执行):`)
  console.log(`  DELETE FROM rd_spec_doc_detail WHERE 单据编号=N'${docNo}';`)
  console.log(`  DELETE FROM yj_doc_status WHERE panel_code=N'RD_SPEC_DOC' AND doc_no=N'${docNo}';`)
  console.log(`  DELETE FROM rd_spec_doc_head WHERE 单据编号=N'${docNo}';`)
  process.exit(FAIL ? 1 : 0)
}

main().catch((e) => { console.error('脚本异常:', e.message); process.exit(2) })
