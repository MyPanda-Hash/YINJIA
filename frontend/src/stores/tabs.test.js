/**
 * 页签身份键(tabKey)单测 —— 2026-11-11「页签名字反复横跳」的防线。
 *
 * 现场:PanelxList 补页签时传了 route.fullPath(?code=/?docNo=),页签 path 与菜单那条不同 ⇒
 *   · tabs.open 去不了重 ⇒ 页签栏出现两个同名页签;
 *   · 面板"按自己的路径找页签改标题"找不到/找错 ⇒ 显示的名字与内容对不上。
 * 规则:身份只取路径,query 一律剥掉(path 里带 ?/# 也一并剥)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { tabKey } from './tabs.js'

test('tabKey:剥掉 query / hash,只留路径', () => {
  assert.equal(tabKey('/panelx/list/SO_ORDER'), '/panelx/list/SO_ORDER')
  assert.equal(tabKey('/panelx/list/SO_ORDER?code=SO-0001'), '/panelx/list/SO_ORDER')
  assert.equal(tabKey('/panelx/list/PU_ORDER?docNo=YJ-1&focus=2'), '/panelx/list/PU_ORDER')
  assert.equal(tabKey('/panelx/list/SO_ORDER#detail'), '/panelx/list/SO_ORDER')
  assert.equal(tabKey('/panelx/list/SO_ORDER?code=x#detail'), '/panelx/list/SO_ORDER')
})

test('tabKey:空值不抛异常(菜单/路由偶发 undefined 时不至于把页签搞崩)', () => {
  assert.equal(tabKey(undefined), '')
  assert.equal(tabKey(null), '')
  assert.equal(tabKey(''), '')
})
