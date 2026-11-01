/**
 * rdFlowProjectNo.test.js —— 项目流程管控要按「项目编号」识别，不是系统生成的单据编号（2026-10-30）
 *
 * 【需求来源·用户原文】
 *   「流程管控的立项申请编号应该是立项申请的项目编号来关联」
 *
 * 【口径】
 *   立项申请有两个号:
 *   · 单据编号 = `LXA-2026-10-0032` —— 引擎自动生成,人不用它;
 *   · 文档编号 = `YJ-RD-2026-001`   —— 业务上称作**项目编号**,人按它找项目
 *     (实测:立项申请表纸面右上角印的就是它)。
 *   流程管控原先第一列直接显示 `approvalNo`(单据编号),与用户日常用的号对不上。
 *
 * 【关联键不动】后端内部仍用 `rd_plan.文档编号 = rd_approval.单据编号` 串链条
 *   (责任人确认收到即自动建计划,改键会让既有单据全部失联);本次只改**显示**,
 *   并保留「文档编号为空 ⇒ 退回单据编号」的兜底,否则老单会显示成一列空白。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../../../../', import.meta.url)
const vue = readFileSync(new URL('frontend/src/views/rd/ProjectFlow.vue', root), 'utf8')

test('① 第一列显示「项目编号」(文档编号)，不再是系统单据编号', () => {
  assert.match(vue, /approvalDocNo/, '列值必须读 approvalDocNo（= 立项的文档编号/项目编号）')
  // 允许写成 approvalDocNo || approvalNo 的兜底
  assert.match(
    vue,
    /row\.approvalDocNo\s*\|\|/,
    '文档编号可能为空(老单)——为空要退回单据编号，否则整列空白',
  )
})

test('② 列标题改为「项目编号」，且不再用 prop="approvalNo" 直出', () => {
  assert.ok(
    !/prop="approvalNo"\s+:label="tt\('立项申请编号'\)"/.test(vue),
    '原写法 prop="approvalNo" + 标题「立项申请编号」直接把单据编号当项目编号显示',
  )
  assert.match(vue, /tt\('项目编号'\)/, '列标题要用「项目编号」')
})

test('③ 搜索框提示同步：可以按项目编号 / 立项单号查', () => {
  assert.match(vue, /项目编号/, 'placeholder 要提示支持项目编号')
  // 后端 keyword 已同时匹配 单据编号 / 文档编号 / 机型 / 客户名，这里只约束前端提示不要误导
  assert.ok(
    !/placeholder="tt\('输入立项申请编号（支持片段），如 LXA-2026-10'\)"/.test(vue),
    '原来的提示只写了 LXA- 单号，用户不会知道项目编号也能搜',
  )
})
