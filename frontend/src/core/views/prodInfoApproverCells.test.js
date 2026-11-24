/**
 * prodInfoApproverCells.test.js — 产品信息表三格审批人的只读与回填(用户口径 2026-11-11)
 *
 * 【用户原话】
 *   「产品信息表的一级审核人名字改为：陈秀丽，这个是固定的
 *     二级审核人是分配的产品责任人（规格书的责任人）是谁就回填显示谁的名字
 *     这三个都是只读的，但是都要有对应的数据回填进去，二级签核就是对应的规格书的责任人
 *     也就是产品负责人来签核」
 *   追问后确认的三条口径：
 *     ① 一级审核人 = **纸面只读恒显示陈秀丽，一级审批权限不变**（仍按角色「审批」权判定）；
 *     ② 二级审核人 = **一级审批选了二级签核人之后才回填**，选之前为空；后续改人也跟着改；
 *     ③ 产品负责人同上（选中谁回填谁）。
 *
 * 【改动前的真实状态】
 *   · docDefaults 里一级默认 `冯总`、二级默认 `陈秀丽`，且注释明写"也可以修改的"；
 *   · yj_field 三格（审核人（一级审批人）/审核人（二级审批人）/产品负责人）都是 editable=1
 *     ⇒ 用户能直接改这三个名字；
 *   · 二级回填已经是"一级审批选了人之后"由 writeBackL2Approver 写 `审核人二级` 列
 *     （时机与②一致，本次只需确认列名与只读口径没被破坏）。
 *
 * 单测跑不了运行时，按仓库既有做法读源码 + 配置文件钉住。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ROOT = new URL('../../../', import.meta.url) // frontend/
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8')

const defaults = read('src/core/panel/docDefaults.js')
const cfg = read('src/core/views/recordSheetConfigs.js')
const btn = read('../backend/src/main/java/com/yinjia/mes/service/ButtonService.java')
const mig = read('../tools/migrate-prodinfo-approver-cells-20261111.sql')

test('① 两级审核人不再有默认值（2026-11-19/20 用户口径）', () => {
  const at = defaults.indexOf('RD_PROD_INFO: [')
  assert.ok(at >= 0, '找不到 RD_PROD_INFO 默认值段')
  const end = defaults.indexOf('\n  ],', at)
  const seg = defaults.slice(at, end)
  // 2026-11-19 用户口径「审批人没有默认显示名字，在审批之后才填进去」
  //   ⇒ docDefaults 两格都必须为空串；名字由审批动作写（见 ButtonService.writeBackL1Approver）。
  assert.match(seg, /'审核人（一级审批人）',\s*''/, '一级审核人不得再有默认值')
  assert.match(seg, /'审核人（二级审批人）',\s*''/, '二级审核人不得再有默认值')
  assert.ok(!/'审核人（一级审批人）',\s*'[^']+'/.test(seg), '一级不能残留任何姓名默认值')
  assert.ok(!/'审核人（二级审批人）',\s*'[^']+'/.test(seg), '二级不能残留任何姓名默认值')
})

test('② 两级审核人在纸面上都是只读（ro:true）', () => {
  const at = cfg.indexOf('五、文件与签署')
  assert.ok(at > 0, '找不到「五、文件与签署」段')
  // 窗口放宽到 2400:两格之间隔着大段口径注释
  const seg = cfg.slice(at, at + 2400)
  for (const [label, key] of [
    ['审核人（一级审核）', '审核人（一级审批人）'],
    ['审核人（二级审核）', '审核人（二级审批人）'],
  ]) {
    const re = new RegExp(`label: '${label}', key: '${key}'[^}]*`)
    const hit = seg.match(re)
    assert.ok(hit, `找不到 ${label} 那一格`)
    assert.match(hit[0], /ro:\s*true/, `${label} 必须 ro:true（用户口径"这三个都是只读的"）`)
  }
  // 2026-11-19 版式：产品负责人不再单列一行（二级审核即产品负责人）
  assert.ok(!seg.includes("label: '产品负责人'"), '产品负责人不再上纸面')
})

test('③ yj_field 里三格必须 editable=0（只读要落到元数据，不能只靠前端配置）', () => {
  // 迁移脚本必须把三格改成 editable=0
  for (const k of ['审核人（一级审批人）', '审核人（二级审批人）', '产品负责人']) {
    assert.ok(mig.includes(k), `迁移里没有 ${k} 的 editable=0 处理`)
  }
  assert.match(mig, /editable\s*=\s*0/, '迁移没有把 editable 置 0')
})

test('④ 二级审核人回填仍走「一级选中之后」(writeBackL2Approver 写 审核人二级)', () => {
  const at = btn.indexOf('private void writeBackL2Approver(')
  assert.ok(at > 0, '找不到 writeBackL2Approver')
  const body = btn.slice(at, at + 700)
  // 列名必须与纸面 key 的物理列一致（审核人（二级审批人） → 审核人二级）
  assert.match(body, /审核人二级/, '回填写错了列（纸面 审核人（二级审批人） 的物理列是 审核人二级）')
  // 时机：必须在一级通过转二级的那条路径里被调用（用户口径"选之前都是空的"）
  const l2write = btn.indexOf('writeBackL2Approver(def.code(), no, l2)')
  assert.ok(l2write > 0, '一级通过时没有调用 writeBackL2Approver ⇒ 二级审核人的名字回填不进去')
  // 且必须在 approve_node = 2 之后（即"选了人"之后）
  const node2 = btn.indexOf('approve_node = 2')
  assert.ok(node2 > 0 && l2write > node2, '回填必须在"一级通过 → 转待二级"之后发生')
})

test('⑦ 一级选人后，二级审核人**和**产品负责人一起回填(用户口径"责任人在选择之前都是空的，选了就回填")', () => {
  // 用户追问后的原话：「责任人在一级审批选择二级签核人之前都是空的，选了二级签核人就回填二级签核人进去，
  //   后续改动也对应改动」⇒ 两格都要在 writeBackL2Approver 里一起写。
  const at = btn.indexOf('private void writeBackL2Approver(')
  assert.ok(at > 0, '找不到 writeBackL2Approver')
  const body = btn.slice(at, at + 1400)
  assert.match(body, /审核人二级/, '必须写 审核人二级(纸面 审核人（二级审批人）)')
  assert.match(body, /责任人/, '必须同时写 责任人(纸面 产品负责人)——用户口径两格都回填')
})

test('⑧ 默认值有**两个来源**，迁移必须两个都改(实测踩过:只改前端仍显示陈秀丽)', () => {
  // 实测发现:yj_panel.config.headDefaults 里也有这两个键，后端 buildMeta 下发后
  //   PanelxList 在草稿态 applyDocDefaults 会把空值补成它 ⇒ 只改 docDefaults.js 界面照旧显示陈秀丽。
  //   故迁移必须同时：① 一级改成陈秀丽；② **删掉**二级这个键（选择前必须为空）。
  assert.match(mig, /yj_panel/, '迁移没有处理 yj_panel.config（第二个默认值来源）')
  assert.match(mig, /headDefaults/, '迁移没有处理 headDefaults')
  assert.match(mig, /JSON_MODIFY/, '应用 JSON_MODIFY 改 config，而不是整段覆盖（会冲掉 config 里别的东西）')
  assert.match(mig, /审核人（二级审批人）/, '迁移没有清理二级的 headDefaults 键')
})

test('⑥ 组件真的读了 pair.ro(否则配置写 ro:true 也拦不住输入框)', () => {
  // ⚠ 这条是实测踩出来的:pairs 分支原来只判 editable，c.ro 只对 row.grid 生效
  //   ⇒ 只改配置时界面照旧 hasInput=true。没有这条断言，配置改动会"看起来做了"。
  const panel = read('src/core/views/RecordSheetPanels.vue')
  const hits = [...panel.matchAll(/editable && !pair\.ro/g)]
  assert.ok(hits.length >= 2,
    'pairs 的两条输入分支(text / textarea)都必须判 !pair.ro，实际匹配到 ' + hits.length)
})

test('⑤ 产品负责人不再上纸面，但历史字段/只读元数据仍保留', () => {
  // 2026-11-19 用户口径（对照《产品信息表（固定）》新版式）：
  //   二级审核那一格写的就是「产品负责人」，不再单列一行。
  assert.ok(!cfg.includes("label: '产品负责人', key: '产品负责人'"),
    '产品负责人不得再上纸面（二级审核已承担该格）')
  // 历史字段不能删：老单据的值、元数据、2026-11-11 的只读迁移都要保留。
  assert.ok(mig.includes('产品负责人'), '2026-11-11 迁移里的 产品负责人 只读处理不能删（历史列仍在）')
})
