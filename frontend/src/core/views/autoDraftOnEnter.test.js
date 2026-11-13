/**
 * autoDraftOnEnter.test.js —— 「立项申请和产品信息表我现在点进去看到的是旧的单据，
 *                              我想要点击进去就能开始填写新的草稿了」（2026-11-13 用户口径）
 *
 * 【现状】面板加载完，`cur = list[curIdx]`、`curIdx` 初始为 0 ⇒ 显示的是**列表第一张旧单**。
 *   想填新单得自己去点「新增」。用户要的是「点进去就能开始填写新的草稿」。
 *
 * 【口径】
 *   · 只对**这两张以"草稿"为主要录入形态的单据**自动建草稿（立项申请 / 产品信息表），
 *     其它面板（订单、工单、检验单…）进去仍看已有单据 —— 一刀切会让"新增"变成副作用；
 *   · **复用已有的空白草稿**（立项申请已有该口径，见 directAdd 的 reusableBlankApproval）：
 *     反复进出不该越攒越多空单；
 *   · 只在**真正"进入"时**触发一次：翻页/查询/刷新不该再建单；
 *   · 进不去（无新增权限 / 后端报错）时必须**静默降级**成原来的"显示列表第一张"，
 *     不能弹错误把整个面板拦住。
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

test('① 有两张单据进面板即建草稿（白名单，不写死判断散落各处）', () => {
  assert.match(list, /AUTO_DRAFT_PANELS/, '要有白名单常量（可读、可单测、加面板只改一处）')
  const i = list.indexOf('AUTO_DRAFT_PANELS')
  const block = list.slice(i, i + 260)
  assert.match(block, /RD_APPROVAL/, '立项申请在名单里')
  assert.match(block, /RD_PROD_INFO/, '产品信息表在名单里')
  // 白名单必须只含这两张（防止有人顺手把所有面板都加进去）
  const m = block.match(/\[([^\]]*)\]/)
  assert.ok(m, '白名单要是数组字面量')
  const items = m[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean)
  assert.deepEqual(items, ['RD_APPROVAL', 'RD_PROD_INFO'], `白名单只该有这两张，实际 ${items.join('/')}`)
})

test('② 自动建草稿只在「进入面板」时做一次（翻页/查询/刷新不重复建单）', () => {
  // 闸门 = 记住"上次为哪个面板建过"（autoDraftPanel）：同一面板翻页/刷新直接 return
  assert.match(list, /autoDraftPanel/, '要有"为哪个面板建过"的闸门标记')
  const i = list.indexOf('async function autoDraftOnEnter')
  assert.ok(i > 0, '要有 autoDraftOnEnter 函数')
  const fn = list.slice(i, i + 900)
  const gateIdx = fn.search(/autoDraftPanel\s*=\s*code/)
  const addIdx = fn.indexOf('directAdd')
  assert.ok(gateIdx > 0, '要置闸门')
  assert.ok(addIdx > 0, '要调 directAdd')
  assert.ok(gateIdx < addIdx, '闸门要在建单之前置位（防并发重复建）')
})

test('③ 复用已有空白草稿（反复进出不攒空单）', () => {
  // directAdd 内部已有 reuse 分支；自动建草稿必须走 directAdd 而不是自己再调一次保存接口
  const i = list.indexOf('async function autoDraftOnEnter')
  const fn = list.slice(i, i + 900)
  assert.match(fn, /directAdd\(\)/, '必须复用 directAdd（它内部已含"复用空白草稿"口径）')
  assert.doesNotMatch(fn, /callButton\(\{\s*panelCode[^}]*buttonName:\s*['"]保存['"]/,
    '不许自己再写一遍建单调用（会绕过复用逻辑）')
})

test('④ 失败要静默降级，不能把面板拦住', () => {
  const i = list.indexOf('async function autoDraftOnEnter')
  const fn = list.slice(i, i + 900)
  assert.match(fn, /catch/, '要有 catch')
  // catch 里不许 ElMessage.error（自动行为失败不该弹错吓用户）
  const catchBlock = fn.slice(fn.indexOf('catch'))
  assert.doesNotMatch(catchBlock.slice(0, 200), /ElMessage\.error/,
    '自动建草稿失败不许弹 ElMessage.error（降级成显示原列表即可）')
})

test('⑤ 只在不同面板「进入」时触发，同一面板内刷新不触发', () => {
  const i = list.indexOf('async function autoDraftOnEnter')
  const fn = list.slice(i, i + 900)
  // 判据要有"当前面板变了"这类比较，而不是无条件跑
  assert.match(fn, /autoDraftPanel|lastAutoDraftPanel|!==\s*String\(panelCode/,
    '要记住上次为哪个面板建过，切面板才重新触发')
})

test('⑥ 复用判据不能用前端本地标记（saved 从来没人赋值 ⇒ 恒失效）', () => {
  const i = list.indexOf('function reusableBlankDraft(')
  assert.ok(i > 0, '应有 reusableBlankDraft')
  const fn = list.slice(i, i + 1200)
  // saved 是前端本地标记，列表接口不下发（全文件无 `.saved =` 赋值）⇒ 不能当判据
  assert.doesNotMatch(fn, /it\['saved'\]|it\.saved/,
    '不许用 saved 判空白草稿 —— 它恒为 undefined，复用因此从来不生效（实测攒了 7 张空单）')
  // 必须按业务字段判空白
  assert.match(fn, /客户名|立项背景|产品编号/, '要按业务内容字段判空')
  // 必须只认草稿态
  assert.match(fn, /草稿/, '只认草稿态（已提交/已审核的空字段单不能被复用）')
})

test('⑦ 产品信息表也要能复用空白草稿（否则进出一次攒一张）', () => {
  const i = list.indexOf('function reusableBlankDraft(')
  const fn = list.slice(i, i + 1200)
  assert.match(fn, /RD_PROD_INFO/, '产品信息表要在复用判据里')
  assert.match(fn, /产品编号/, '产品编号是它的唯一标识，空着才算空草稿')
})
