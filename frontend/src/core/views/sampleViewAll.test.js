/**
 * sampleViewAll.test.js —— 样品申请单「可见全部单据」权限词(view_all)(用户口径 2026-11-11)
 *
 * 【用户原话】「1:显示」（指"刘磊账号需要看到全部外部开发样品单信息"这一条要显示/要做）、
 *   「3：内部单信息是全部共享的，但是只能由提交信息行的编辑人和文件管理员和管理员进行修改，
 *     就是普通提交人不允许去修改其他的同级的人的提交的信息」。
 *
 * 【改动前的真实机制】`QueryService.OWN_DOCS_PANELS = {RD_SAMPLE_EXT, RD_SAMPLE_INT}` 对所有
 *   非管理员强制 `AND asp_user1 = 当前账号`，`loadOneDoc` 还额外拦一次。
 *   刘磊是「文件负责人(1025)」**不是管理员** ⇒ 外部样品单 11 张里他一张都看不到（生产实测）。
 *
 * 【本次口径】
 *   ① 新增权限词 `view_all`（可见全部单据），授给谁由组织架构「角色与面板权限」勾选决定；
 *   ② 勾了 ⇒ 不追加 asp_user1 过滤，能看到该面板全部单据；没勾 ⇒ 维持"只看自己"；
 *      管理员恒放行（现状不变）；
 *   ③ 内部单**信息全部共享**（用户第 3 条首句）⇒ RD_SAMPLE_INT 不再按人过滤**可见性**；
 *      写权限仍由行级归属 + edit_others 控制（ButtonService.applySampleIntRowRules 现状不动）。
 *
 * 【为什么用权限词而不是硬编码角色】R7「做成面板权限，把个人角色的权限配置好」；
 *   且项目里 edit_others 已经是「面板权限 + 组织架构勾选」同一模式，不自造第二套。
 *
 * 单测跑不了运行时，按仓库既有做法读源码钉住（同 permWordDrift.test.js）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ROOT = new URL('../../../', import.meta.url) // frontend/
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8')

const sys = read('../backend/src/main/java/com/yinjia/mes/controller/SysAdminController.java')
const perms = read('../backend/src/main/java/com/yinjia/mes/service/PanelPermissionService.java')
const query = read('../backend/src/main/java/com/yinjia/mes/service/QueryService.java')
const auth = read('../backend/src/main/java/com/yinjia/mes/controller/AuthController.java')
const userStore = read('src/stores/user.js')

test('① 权限词 view_all 同时登记在动作集与中文标签表(否则组织架构里勾不到)', () => {
  assert.match(sys, /"view_all"\s*,\s*"可见全部单据"/,
    'SysAdminController 缺少 view_all 动作(应加在样品面板动作集里)')
  assert.match(perms, /Map\.entry\("view_all",\s*"可见全部单据"\)/,
    'PanelPermissionService.PERM_LABEL 缺少 view_all 的中文标签')
})

test('② view_all 只挂在样品面板动作集，不污染通用集/文件类集', () => {
  // ⚠ 不能用 indexOf('};') 截断:静态初始化块里每行赋值都以 `};` 结尾,
  //   会在 edit_others 那一行就把 view_all 切掉(本测试第一版就是这么误报的)。
  const at = sys.indexOf('String[][] SAMPLE_INT_ACTIONS')
  assert.ok(at > 0, '找不到 SAMPLE_INT_ACTIONS')
  const block = sys.slice(at, sys.indexOf('FILE_PANEL_ACTIONS', at))
  assert.match(block, /view_all/, '样品面板动作集必须含 view_all')
  assert.match(block, /edit_others/, '样品面板动作集必须仍含 edit_others')
  // 通用集是引擎词表全集,view_all 若混进去会让所有面板都多出一列毫无意义的勾选框
  const genericAt = sys.indexOf('String[][] PERMISSION_ACTIONS = {')
  const generic = sys.slice(genericAt, sys.indexOf('};', genericAt))
  assert.ok(!/view_all/.test(generic), 'view_all 不该进通用动作集(只有样品两面板用得上)')
})

test('③ 服务端:勾了 view_all 就不追加 asp_user1 过滤(这是"刘磊能看到全部"的真闸门)', () => {
  // 必须存在一个按面板查 view_all 的判定
  assert.match(query, /view_all/, 'QueryService 没有读 view_all 词 ⇒ 勾了也不生效')
  const ownAt = query.indexOf('OWN_DOCS_PANELS.contains(def.code())')
  assert.ok(ownAt > 0, '找不到 OWN_DOCS_PANELS 过滤分支')
  const block = query.slice(ownAt, ownAt + 900)
  assert.match(block, /canViewAll|view_all|viewAll/,
    'OWN_DOCS_PANELS 分支必须先判 view_all,否则勾了也仍被 asp_user1 挡住')
})

test('④ 内部单信息全部共享:RD_SAMPLE_INT 不再按人过滤可见性', () => {
  // 用户第 3 条:「内部单信息是全部共享的」 ⇒ RD_SAMPLE_INT 应退出 OWN_DOCS_PANELS
  const at = query.indexOf('OWN_DOCS_PANELS = java.util.Set.of(')
  assert.ok(at > 0, '找不到 OWN_DOCS_PANELS 定义')
  const block = query.slice(at, query.indexOf(');', at))
  assert.ok(!block.includes('RD_SAMPLE_INT'),
    'RD_SAMPLE_INT 不该再在 OWN_DOCS_PANELS 里（内部单信息全部共享；写权限由行级归属 + edit_others 管）')
  assert.ok(block.includes('RD_SAMPLE_EXT'),
    'RD_SAMPLE_EXT 仍要保留在集合里（外部单默认只看自己的，除非有 view_all）')
})

test('⑤ loadOneDoc 旁路也必须认 view_all(否则知道单号就能被 403)', () => {
  const at = query.indexOf('public Map<String, Object> loadOneDoc')
  assert.ok(at > 0, '找不到 loadOneDoc')
  const block = query.slice(at, at + 1600)
  assert.match(block, /canViewAll|view_all|viewAll/,
    'loadOneDoc 的归属校验要同时认 view_all，否则列表能看到、点进去 403')
})

test('⑥ 登录下发 viewAllPanels，前端 store 白名单同步(否则前端拿不到这个能力)', () => {
  assert.match(auth, /viewAllPanels/, 'AuthController 未下发 viewAllPanels')
  assert.match(userStore, /viewAllPanels/, 'stores/user.js 未保存 viewAllPanels（权限刷新会丢）')
})
