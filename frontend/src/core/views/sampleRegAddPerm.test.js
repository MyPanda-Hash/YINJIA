/**
 * 送样登记表(SAMPLE_REG)「新增数据」按钮必须受「新增保存」(add)词控制(2026-11-19)。
 *
 * 用户口径:「送样登记表明细页签工具栏的绿色『+ 新增数据』按钮,其『新增』要能在
 * 组织架构 → 角色与面板权限里去掉:取消该面板的『新增保存』后,按钮应消失;
 * 后端也不能靠直调接口绕过」。
 *
 * 病根:PanelxList 的两个绿色按钮分支(下拉「新增数据/导入商品数据」与普通「新增数据」)
 * 条件只有 detailEditable(b)(草稿/修改中就算可编辑),**从不看 yj_role_panel.perms**,
 * 加行函数 addInlineDetailRow 也只判 detailEditable ⇒ 权限矩阵里勾不勾「新增保存」都一样能加行。
 * 修法两层(缺一不可):
 *   ① 显示层:canAddDetailRow(b)= detailEditable ∧ canPanelDo(user, panelCode, 'add');
 *   ② 后端权威闸门:ButtonService.saveArchive 落库前按 add 词拦新增行(直调 /api/px/callButton 也 403)。
 *
 * 本测试只钉源码契约(组件要挂载跑起来,故用 readFileSync 源码断言;判据纯函数见
 * core/auth/panelAccess.test.js 的 canPanelDo 用例)。断言都锚在**唯一上下文**上,
 * 避免按词匹配到同名文案造成的假红。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vue = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const panelAccess = readFileSync(new URL('../auth/panelAccess.js', import.meta.url), 'utf8')
const buttonService = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')

/** 取某段代码:从锚点起,到第一个 needle 为止(找不到 needle 就取 len 字) */
function sliceFrom(src, anchor, len = 1200) {
  const at = src.indexOf(anchor)
  assert.ok(at > 0, `源码里找不到锚点:${anchor}`)
  return src.slice(at, at + len)
}

test('panelAccess 必须导出 canPanelDo(真实面板的 action 词判定)', () => {
  assert.match(panelAccess, /export function canPanelDo\(user, panelCode, word\)/, '缺 canPanelDo')
  // 只读显示层判据:JSDoc 要写明后端是权威闸门(防后人把前端当唯一闸门)
  const at = panelAccess.indexOf('export function canPanelDo(')
  const doc = panelAccess.slice(Math.max(0, at - 1600), at)
  assert.match(doc, /只用于显示层/, 'JSDoc 要写明只用于显示层')
  assert.match(doc, /panelPerms/, 'JSDoc 要写明数据源是 user.panelPerms')
})

test('PanelxList 必须 import 并调用 canPanelDo(user, panelCode, add)', () => {
  assert.match(vue, /import \{[^}]*canPanelDo[^}]*\} from '@core\/auth\/panelAccess'/, '必须 import canPanelDo')
  const hits = vue.match(/computed\(\(\) => canPanelDo\(user, panelCode\.value, 'add'\)\)/g) || []
  assert.equal(hits.length, 1, `canAddRowsHere 必须且只判一次 add 词,实际 ${hits.length} 处`)
})

test('canAddDetailRow = 单据可编辑 ∧ 面板 add 词(两个判据都在)', () => {
  const seg = sliceFrom(vue, 'function canAddDetailRow(b) {', 200)
  assert.match(seg, /detailEditable\(b\)/, '保留「单据状态可编辑」这条原有判据')
  assert.match(seg, /canAddRowsHere\.value/, '必须叠加面板「新增保存」词判据')
})

test('绿色「新增数据」两个分支都改判 canAddDetailRow(含下拉分支)', () => {
  // 下拉分支(「新增数据 / 导入商品数据」两项菜单)同样属于加行
  const dropdown = vue.match(/v-if="canAddDetailRow\(b\) && canImportProducts\(b\)"/g) || []
  assert.equal(dropdown.length, 1, `下拉分支条件应恰为 canAddDetailRow(b) && canImportProducts(b),实际 ${dropdown.length} 处`)
  // 普通分支(一击加行)
  const plain = vue.match(/v-else-if="canAddDetailRow\(b\)"/g) || []
  assert.equal(plain.length, 1, `普通分支条件应恰为 canAddDetailRow(b),实际 ${plain.length} 处`)
  // 旧条件不得残留(否则权限只管到一半)
  assert.equal((vue.match(/v-if="detailEditable\(b\) && canImportProducts\(b\)"/g) || []).length, 0,
    '下拉分支不能再只看 detailEditable')
  assert.equal((vue.match(/v-else-if="detailEditable\(b\)"/g) || []).length, 0,
    '「新增数据」分支不能再只看 detailEditable')
})

test('addInlineDetailRow 首行必须有 canAddDetailRow guard(其它入口/直调也不加行)', () => {
  const at = vue.indexOf('function addInlineDetailRow(b) {')
  assert.ok(at > 0, '缺 addInlineDetailRow')
  const body = vue.slice(at, vue.indexOf('const tabKey = activeTab(b).key', at))
  assert.match(body, /if \(!canAddDetailRow\(b\)\) return/, '首行要 guard')
  assert.doesNotMatch(body, /if \(!detailEditable\(b\)\) return/, 'guard 不能还是只看 detailEditable')
})

test('onAddDetailCommand(加行/导入商品数据)同样有 guard', () => {
  const at = vue.indexOf('function onAddDetailCommand(cmd, b) {')
  assert.ok(at > 0, '缺 onAddDetailCommand')
  const cmd1 = vue.slice(at, vue.indexOf('productImpVisible.value = true', at))
  assert.match(cmd1, /if \(!canAddDetailRow\(b\)\) return/, '导入商品数据(也是加行)要 guard')
  assert.ok(cmd1.indexOf('if (!canAddDetailRow(b)) return') < cmd1.indexOf("if (cmd === 'importProduct')"),
    'guard 要在命令分发之前')
})

test('不许波及其它按钮:保存/删除/行内编辑仍按 detailEditable', () => {
  // 操作列(删除本行)与单元格编辑仍走 detailEditable —— 本次只动「新增数据」
  assert.equal((vue.match(/<el-table-column v-if="detailEditable\(b\)" width="60"/g) || []).length, 1,
    '操作列可见性口径不应被改')
  assert.ok((vue.match(/detailEditable\(b\)/g) || []).length > 5, 'detailEditable 仍被其它地方使用')
})

/* ── 后端二道闸:直调接口也不能绕过「新增保存」 ── */

test('ButtonService 必须注入 PanelPermissionService', () => {
  assert.match(buttonService, /private final PanelPermissionService panelPermissionService;/,
    '缺字段')
  const ctor = sliceFrom(buttonService, 'public ButtonService(', 2000)
  assert.match(ctor, /PanelPermissionService panelPermissionService\)/, '构造器要有该参数')
  assert.match(ctor, /this\.panelPermissionService = panelPermissionService;/, '构造器要赋值')
})

test('saveArchive 落库前按 add 词拦新增行(id 为空 = 插入新行)', () => {
  const seg = sliceFrom(buttonService, 'private Map<String, Object> saveArchive(', 4000)
  assert.match(seg, /boolean hasNewRow = items\.stream\(\)/, '要识别新增行')
  assert.match(seg, /hasAnyPerm\(def\.code\(\), "add"\)/, '词必须是该面板的 add「新增保存」')
  assert.match(seg, /org\.springframework\.security\.access\.AccessDeniedException/,
    '要抛 403(与其它按钮闸门一致)')
  assert.match(seg, /当前角色无该面板「新增保存」权限，不能新增数据行/, '错误话术要指明缺哪个词')
  // 必须是「落库前」:先判 add,再进入逐行 upsert
  const guardAt = seg.indexOf('hasAnyPerm(def.code(), "add")')
  const writeAt = seg.indexOf('labelsToCols(def.fields(), item, true)')
  assert.ok(guardAt > 0 && writeAt > guardAt, 'add 词校验必须在写库循环之前')
})
