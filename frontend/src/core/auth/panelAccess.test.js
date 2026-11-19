/**
 * panelAccess 单测 —— 「能不能看这个面板」「能不能配这个面板的自定义字段」
 * 与「能不能配这个面板的库存预警数量」三个纯判定。
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
import { canViewPanel, canConfigFields, canConfigWarn, canDo, canDoAny, canPanelDo, PAGE_PANELS } from './panelAccess.js'

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

/* ── canConfigWarn:「能不能配该面板的库存预警数量」(2026-10-15 用户口径) ──
 * 权限来自组织架构 →「角色与面板权限」勾的「预警配置」列(AuthController 下发 warnPanels);
 * 后端同词闸门 PanelPermissionService.requireWarnConfig —— 两边必须同一判据。
 * 写入口:库存状况行内编辑「更新预警数量」、库存明细展开区按批次设置(/api/stock/warn/set)。 */

const WARN_ROLE = { isAdmin: false, warnPanels: ['STOCK_STATUS', 'STOCK_DETAIL'] }

test('canConfigWarn:管理员恒可,普通账号按 warnPanels 逐面板判', () => {
  assert.equal(canConfigWarn(ADMIN, 'STOCK_STATUS'), true)
  assert.equal(canConfigWarn(ADMIN, '任意面板'), true)
  assert.equal(canConfigWarn(WARN_ROLE, 'STOCK_STATUS'), true)
  assert.equal(canConfigWarn(WARN_ROLE, 'STOCK_DETAIL'), true)
  // 同一账号在别的面板没有该权限 ⇒ 编辑入口不出现(否则点下去也是 403)
  assert.equal(canConfigWarn(WARN_ROLE, 'PURCHASE_IN'), false)
})

test('canConfigWarn:warnPanels 里是 * (后端管理员口径)时全量放行', () => {
  assert.equal(canConfigWarn({ isAdmin: false, warnPanels: ['*'] }, 'STOCK_STATUS'), true)
})

test('canConfigWarn:看不见的面板 / 拿不到权限信息时不放行', () => {
  assert.equal(canConfigWarn(LIMITED, 'STOCK_STATUS'), false)   // 有可见面板但无 warn 词
  assert.equal(canConfigWarn(null, 'STOCK_STATUS'), false)
  assert.equal(canConfigWarn(undefined, 'STOCK_STATUS'), false)
  assert.equal(canConfigWarn({ isAdmin: false }, 'STOCK_STATUS'), false)
  // 有 field 词不带 warn 词 —— 两个词各判各的,不能互相顶替
  assert.equal(canConfigWarn(QC_ROLE, 'STOCK_STATUS'), false)
  assert.equal(canConfigWarn(WARN_ROLE, ''), false)
  assert.equal(canConfigWarn(WARN_ROLE, null), false)
})

/* ── canDo / canDoAny:页面级虚拟面板的动作词(2026-10-16) ──
 * 订单结转/快速排产/工单排产/生产工单四页是**看板页面**(无 yj_panel 行,按钮不走 yj_button),
 * 动作权限由 AuthController 单独下发 pagePerms(code → perms csv);真闸门是后端
 * PanelPermissionService.requirePanelView / requireButtonAny —— 两边必须同一判据。 */

const PLANNER = {
  isAdmin: false,
  pagePerms: {
    ORDER_CONVERT: 'view,query,date,convert',
    SCHEDULE_BOARD: 'view,query,assign',
    WORK_ORDER_BOARD: 'view,query',
    WORK_ORDER_LIST: 'view,query,print',
  },
}

test('canDo:管理员恒可,普通账号按 pagePerms 逐词精确匹配', () => {
  assert.equal(canDo(ADMIN, PAGE_PANELS.ORDER_CONVERT, 'convert'), true)
  assert.equal(canDo(ADMIN, '任意页面码', '任意词'), true)
  assert.equal(canDo(PLANNER, PAGE_PANELS.ORDER_CONVERT, 'convert'), true)
  assert.equal(canDo(PLANNER, PAGE_PANELS.ORDER_CONVERT, 'date'), true)
  // 同页没有的词 / 别的页面才有的词 ⇒ 一律不显示按钮(点了也是 403)
  assert.equal(canDo(PLANNER, PAGE_PANELS.ORDER_CONVERT, 'unassign'), false)
  assert.equal(canDo(PLANNER, PAGE_PANELS.SCHEDULE_BOARD, 'unassign'), false)
  assert.equal(canDo(PLANNER, PAGE_PANELS.WORK_ORDER_BOARD, 'transfer'), false)
  // 没被授予的面板整条空串 ⇒ 全部动作不放行
  assert.equal(canDo({ isAdmin: false, pagePerms: {} }, PAGE_PANELS.WORK_ORDER_LIST, 'print'), false)
})

test('canDo:逐词精确匹配,不吃前缀(assign ≠ unassign)', () => {
  // 用 LIKE/前缀匹配会把 unassign 误判成 assign —— 这两个词在排产页同时存在,最易踩
  assert.equal(canDo({ isAdmin: false, pagePerms: { SCHEDULE_BOARD: 'view,unassign' } },
    PAGE_PANELS.SCHEDULE_BOARD, 'assign'), false)
  assert.equal(canDo({ isAdmin: false, pagePerms: { SCHEDULE_BOARD: 'view,assign' } },
    PAGE_PANELS.SCHEDULE_BOARD, 'unassign'), false)
})

test('canDo:pagePerms 为 * (后端管理员口径)时全量放行', () => {
  assert.equal(canDo({ isAdmin: false, pagePerms: { ORDER_CONVERT: '*' } }, PAGE_PANELS.ORDER_CONVERT, 'convert'), true)
})

test('canDo:拿不到权限信息 / 空参数时不放行', () => {
  assert.equal(canDo(null, PAGE_PANELS.ORDER_CONVERT, 'convert'), false)
  assert.equal(canDo(undefined, PAGE_PANELS.ORDER_CONVERT, 'convert'), false)
  assert.equal(canDo({ isAdmin: false }, PAGE_PANELS.ORDER_CONVERT, 'convert'), false)
  assert.equal(canDo(PLANNER, '', 'convert'), false)
  assert.equal(canDo(PLANNER, PAGE_PANELS.ORDER_CONVERT, ''), false)
})

test('canDoAny:同一动作两个入口任一授予即可(与后端 requireButtonAny 同口径)', () => {
  // 「排产」在快速排产页与生产工单页各有一个按钮:只授其中一处也应放行
  const onlyQuick = { isAdmin: false, pagePerms: { SCHEDULE_BOARD: 'view,assign' } }
  const onlyList = { isAdmin: false, pagePerms: { WORK_ORDER_LIST: 'view,assign' } }
  const entries = [PAGE_PANELS.SCHEDULE_BOARD, PAGE_PANELS.WORK_ORDER_LIST]
  assert.equal(canDoAny(onlyQuick, entries, 'assign'), true)
  assert.equal(canDoAny(onlyList, entries, 'assign'), true)
  assert.equal(canDoAny({ isAdmin: false, pagePerms: { WORK_ORDER_LIST: 'view' } }, entries, 'assign'), false)
  assert.equal(canDoAny(PLANNER, [], 'assign'), false)
  assert.equal(canDoAny(PLANNER, null, 'assign'), false)
})

/* ── canPanelDo:真实面板(yj_panel)的动作词(2026-11-19) ──
 * 判据与 canDo 逐字一致,数据源换成 user.panelPerms(AuthController.panelPermsOf 下发:
 * panel_code → yj_role_panel.perms csv;管理员 = {"*":"*"})。
 * 首个用例:送样登记表 SAMPLE_REG 的绿色「新增数据」按钮显隐 —— 取消「新增保存」(add)后必须消失;
 * 真闸门在后端 ButtonService.saveArchive(新增行校验 add),两边同一份 perms。 */

const QC_CLERK = {
  isAdmin: false,
  panelPerms: {
    SAMPLE_REG: 'view,query,add,export',
    INSP_COMMISSION: 'view,query,modify',
  },
}

test('canPanelDo:管理员恒可(isAdmin 标志与后端 {"*":"*"} 两种载荷都认)', () => {
  assert.equal(canPanelDo(ADMIN, 'SAMPLE_REG', 'add'), true)
  assert.equal(canPanelDo(ADMIN, '任意面板', '任意词'), true)
  // 后端 panelPermsOf 对管理员只放一行 '*' → '*' 键也要认(旧会话丢了 isAdmin 标志时同理)
  assert.equal(canPanelDo({ isAdmin: false, panelPerms: { '*': '*' } }, 'SAMPLE_REG', 'add'), true)
})

test('canPanelDo:普通账号按 panelPerms 逐面板、逐词精确匹配', () => {
  assert.equal(canPanelDo(QC_CLERK, 'SAMPLE_REG', 'add'), true)
  assert.equal(canPanelDo(QC_CLERK, 'SAMPLE_REG', 'export'), true)
  // 同一账号在别的面板没有 add 词 ⇒ 该面板不显示「新增数据」(否则点下去也是 403)
  assert.equal(canPanelDo(QC_CLERK, 'INSP_COMMISSION', 'add'), false)
  assert.equal(canPanelDo(QC_CLERK, 'INSP_COMMISSION', 'modify'), true)
  // 面板整条不在 panelPerms 里 ⇒ 全部动作不放行
  assert.equal(canPanelDo(QC_CLERK, 'RD_SPEC_DOC', 'add'), false)
})

test('canPanelDo:取消「新增保存」(add)后即为 false —— 送样登记表按钮消失的判据', () => {
  // 角色与面板权限里把 SAMPLE_REG 的 add 勾掉后,perms 里就不再有这个词
  const noAdd = { isAdmin: false, panelPerms: { SAMPLE_REG: 'view,query,export' } }
  assert.equal(canPanelDo(noAdd, 'SAMPLE_REG', 'add'), false)
  assert.equal(canPanelDo(noAdd, 'SAMPLE_REG', 'view'), true)
  // modify(申请修改)不能顶替 add(新增保存):改已有行 ≠ 加新行
  assert.equal(canPanelDo({ isAdmin: false, panelPerms: { SAMPLE_REG: 'view,modify' } }, 'SAMPLE_REG', 'add'), false)
})

test('canPanelDo:逐词精确匹配,不吃前缀(add ≠ add2、audit ≠ selfaudit)', () => {
  assert.equal(canPanelDo({ isAdmin: false, panelPerms: { SAMPLE_REG: 'view,add2' } }, 'SAMPLE_REG', 'add'), false)
  assert.equal(canPanelDo({ isAdmin: false, panelPerms: { SAMPLE_REG: 'view,selfaudit' } }, 'SAMPLE_REG', 'audit'), false)
  // 管理员形载荷的 csv 值 '*' 也放行(与 canDo 的 pagePerms 口径一致)
  assert.equal(canPanelDo({ isAdmin: false, panelPerms: { SAMPLE_REG: '*' } }, 'SAMPLE_REG', 'add'), true)
})

test('canPanelDo:拿不到权限信息 / 空参数时不放行', () => {
  assert.equal(canPanelDo(null, 'SAMPLE_REG', 'add'), false)
  assert.equal(canPanelDo(undefined, 'SAMPLE_REG', 'add'), false)
  assert.equal(canPanelDo({ isAdmin: false }, 'SAMPLE_REG', 'add'), false, '无 panelPerms')
  assert.equal(canPanelDo({ isAdmin: false, panelPerms: null }, 'SAMPLE_REG', 'add'), false)
  assert.equal(canPanelDo({ isAdmin: false, panelPerms: 'view,add' }, 'SAMPLE_REG', 'add'), false, 'map 不是对象')
  assert.equal(canPanelDo(QC_CLERK, '', 'add'), false)
  assert.equal(canPanelDo(QC_CLERK, null, 'add'), false)
  assert.equal(canPanelDo(QC_CLERK, 'SAMPLE_REG', ''), false)
  assert.equal(canPanelDo(QC_CLERK, 'SAMPLE_REG', null), false)
})
