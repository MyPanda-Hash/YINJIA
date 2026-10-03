/**
 * panelAccess 单测 —— 「能不能看这个面板」的纯判定。
 *
 * 口径与导航/桌面入口**同一真源**(menus.filterMenuTree / dashboard/deskQuick):
 *   · admin 全量;
 *   · 其余账号看 user.visiblePanels(后端 AuthController 按角色面板权限下发);
 *   · 拿不到用户信息时一律**不放行**(宁可提示无权限,也不要放进去吃一个 403 白屏)。
 *
 * 用于产品文件列表点「状态」跳转到对应文件面板之前的预检(2026-09-30 用户口径:
 * 没有该面板查看权限时提示「无查看该面板的权限」),免得多跑一趟必然被拒的跳转。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { canViewPanel } from './panelAccess.js'

const ADMIN = { isAdmin: true, visiblePanels: [] }
const LIMITED = { isAdmin: false, visiblePanels: ['RD_PROD_DOCLIST', 'RD_SPEC_DOC'] }

test('admin 全量放行', () => {
  assert.equal(canViewPanel(ADMIN, 'RD_MOLD_PROC'), true)
  assert.equal(canViewPanel(ADMIN, '任意面板'), true)
})

test('普通账号按 visiblePanels 判定', () => {
  assert.equal(canViewPanel(LIMITED, 'RD_SPEC_DOC'), true)
  assert.equal(canViewPanel(LIMITED, 'RD_MOLD_PROC'), false)
})

test('拿不到用户信息 / 面板编码为空时不放行', () => {
  assert.equal(canViewPanel(null, 'RD_SPEC_DOC'), false)
  assert.equal(canViewPanel(undefined, 'RD_SPEC_DOC'), false)
  assert.equal(canViewPanel({ isAdmin: false }, 'RD_SPEC_DOC'), false)
  assert.equal(canViewPanel(LIMITED, ''), false)
  assert.equal(canViewPanel(LIMITED, null), false)
})
