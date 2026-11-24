/**
 * 「项目流程管控」顶部提示块必须整块移除（2026-11-24 用户口径）。
 *
 * 用户原话：「把这个研发管理的项目流程管控面板的圈起来的展示的提示词去掉」，
 * 追问后确认范围 = **整个头部**（标题「项目流程管控」+ 灰色说明 + 右下「数据来源…」）。
 * 页签本身已显示页面名，头部重复一遍标题并堆两行灰字，属于噪声。
 *
 * 钉三件事：
 * ① 模板里不再有 pf-head 头部与其三段（标题 / 说明 / 数据来源）；
 * ② 残留的头部样式一并删掉（避免死 CSS 让人以为还能用回去）；
 * ③ 页面主体不能被误删 —— KPI 卡片、检索条、清单表都还在。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('./ProjectFlow.vue', import.meta.url), 'utf8')

test('流程管控页：顶部提示块整块移除（标题 + 说明 + 数据来源）', () => {
  assert.doesNotMatch(page, /class="pf-head"/, '头部容器 pf-head 必须删掉')
  assert.doesNotMatch(page, /pf-title/, '标题 pf-title 必须删掉（模板与样式都算）')
  assert.doesNotMatch(page, /pf-sub\b/, '灰色说明 pf-sub 必须删掉')
  assert.doesNotMatch(page, /pf-source/, '数据来源 pf-source 必须删掉（含窄屏 media 分支）')
})

test('流程管控页：旧提示文案不得再出现在模板里', () => {
  assert.doesNotMatch(page, /按立项申请单号查这条项目走到哪一步/, '旧的灰色说明文案必须删掉')
  assert.doesNotMatch(page, /数据来源：立项申请/, '旧的数据来源文案必须删掉')
})

test('流程管控页：去掉头部后主体功能仍在（KPI / 检索 / 清单）', () => {
  assert.match(page, /class="pf-kpis"/, 'KPI 卡片区不能被误删')
  assert.match(page, /class="pf-bar"/, '检索条不能被误删')
  assert.match(page, /class="pf-card"/, '流程清单卡片不能被误删')
})
