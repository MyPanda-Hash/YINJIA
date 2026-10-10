/**
 * panelAccess 单测 —— 「能不能看这个面板」与「能不能配这个面板的自定义字段」两个纯判定。
 *
 * 口径与导航/桌面入口**同一真源**(menus.filterMenuTree / dashboard/deskQuick):
 *   · admin 全量;
 *   · 其余账号看 user.visiblePanels / user.fieldPanels(后端 AuthController 按角色面板权限下发);
 *   · 拿不到用户信息时一律**不放行**(宁可提示无权限,也不要放进去吃一个 403 白屏)。
 *
 * 用于产品文件列表点「状态」跳转到对应文件面板之前的预检(2026-09-30 用户口径:
 * 没有该面板查看权限时提示「无查看该面板的权限」),免得多跑一趟必然被拒的跳转;
 * 以及「字段管理 / 自定义字段」入口的显隐(2026-10-09 用户口径)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { canViewPanel, canConfigFields } from './panelAccess.js'

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

/* ── canConfigFields:「能不能配该面板的自定义字段」(2026-10-09 用户口径) ──
 * 权限来自组织架构 →「角色与面板权限」勾的「自定义字段」列(AuthController 下发 fieldPanels);
 * 后端同词闸门 PanelPermissionService.requireFieldConfig —— 两边必须同一判据。 */

const QC_ROLE = { isAdmin: false, fieldPanels: ['QC_INSP_REQ', 'QC_INSP_REQ_SERIES'] }

test('canConfigFields:管理员恒可,普通账号按 fieldPanels 逐面板判', () => {
  assert.equal(canConfigFields(ADMIN, 'QC_INSP_REQ'), true)
  assert.equal(canConfigFields(ADMIN, '任意面板'), true)
  assert.equal(canConfigFields(QC_ROLE, 'QC_INSP_REQ'), true)
  assert.equal(canConfigFields(QC_ROLE, 'QC_INSP_REQ_SERIES'), true)
  // 同一账号在别的面板没有该权限 ⇒ 入口不出现(否则点进去也是 403)
  assert.equal(canConfigFields(QC_ROLE, 'PURCHASE_IN'), false)
})

test('canConfigFields:fieldPanels 里是 * (后端管理员口径)时全量放行', () => {
  assert.equal(canConfigFields({ isAdmin: false, fieldPanels: ['*'] }, 'QC_INSP_REQ'), true)
})

test('canConfigFields:看不见的面板 / 拿不到权限信息时不放行', () => {
  assert.equal(canConfigFields(LIMITED, 'QC_INSP_REQ'), false)   // 有可见面板但无 field 词
  assert.equal(canConfigFields(null, 'QC_INSP_REQ'), false)
  assert.equal(canConfigFields(undefined, 'QC_INSP_REQ'), false)
  assert.equal(canConfigFields({ isAdmin: false }, 'QC_INSP_REQ'), false)
  assert.equal(canConfigFields(QC_ROLE, ''), false)
  assert.equal(canConfigFields(QC_ROLE, null), false)
})
