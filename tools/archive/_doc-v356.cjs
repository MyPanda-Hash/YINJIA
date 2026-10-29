/**
 * _doc-v356.cjs — 数据库表清单追加 v3.56 维护行(2026-10-25)
 * 「供应商打印面版前端与采购订单一致」这次改动没有建表/加列,但换了实现路线(自建列表 → 复用面板),
 * 按惯例在维护记录里留一条,便于以后追溯"为什么供应商端和采购订单长得一样"。
 * 幂等:已有 v3.56 行先删再追加(全程按行处理,不做字符串替换)。
 */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', '..', 'docs', 'development', '数据库表清单.md')
const lines = fs.readFileSync(FILE, 'utf8').split('\n')

const ROW = [
  '| v3.56 | 2026-10-25 | **供应商采购打印改为复用采购订单面板(前端与采购订单一致,只差显示与权限)**',
  '(用户口径「供应商打印面版的前端要与采购订单一致。只是显示和权限不一样。」;**无建表/加列/改数据**)。',
  '① 前端:删除自建列表 `SupplierPrint.vue` 的表格,改为 `/scm/supplierPrint` 直接渲染 `@core/views/PanelxList.vue`',
  '(新增薄壳 `SupplierPrintPanel.vue`:用 vue-router 的 `routeLocationKey`/`routerKey` 给子树提供',
  '「真实 route 副本 + panelCode=PU_ORDER」与一个只读路由代理,保证左栏切单不会把地址换出供应商门户);',
  '于是左栏单据选择、明细页签、纸张、工具栏、打印出口(打印采购订单/无金额/材料码)全部与采购部**同一份代码**;',
  '② 权限:PanelxList 增 `supplierReadonly`(登录态带 supplierCode 即只读)—— 工具栏按**组名 + 动作名**双过',
  '`READONLY_ACTIONS` 白名单(⚠ 只按动作名会把「打印/更多」整组误删:组名是按钮文字、组内是下拉项,2026-10-25 实测踩到);',
  '编辑态(`draftEditable`)直接为假;',
  '③ 数据:`QueryService` 新增 `SUPPLIER_SCOPE_KEY` 控制键与 `enforceSupplierScope()` —— 供应商会话调列表接口时,',
  '**忽略前端条件**,用 `yj_supplier_account` 认定的供应商编码覆盖成 `供应商编码 LIKE 值`,且只认 PU_ORDER;',
  '`SupplierPortalGuardFilter` 定向放行 `queryFormDataList` 与 `getPanelConfig?panelCode=PU_ORDER`(只读元数据 + 只读列表),',
  '`PanelPermissionService.requirePanelView/requirePanelRead` 同步给供应商会话开 PU_ORDER 的读;写接口(callButton/deleteForms/',
  'getFormDescriptor 等)仍一律 403;',
  '④ **验证**:界面 e2e `_ui-supplier-is-puorder.cjs` **18/18**(供应商端=单据选择左栏+明细列头与管理员**逐字一致**、',
  '工具栏是管理员组里去掉写动作后的子集[审批/刷新/打印/更多]、无新增/保存/删除/生单/导入;服务端只回本供应商 74 行、',
  '前端不传条件也照样受限;调别的面板配置与 callButton 均 403);既有回归 `_v-supplier-account-perm.cjs` 25/25、',
  '`_ui-supplier-account-perm.cjs` 10/10、`_ui-topbar-guard.cjs` 5/5;前端单测 858/858。⚠ 本行手写(理由同 v3.31) |',
].join('')

const out = []
for (const line of lines) {
  if (line.startsWith('| v3.56 |')) continue
  out.push(line)
}
const lastVer = out.map((l, i) => (l.startsWith('| v3.') ? i : -1)).filter((i) => i >= 0).pop()
out.splice(lastVer + 1, 0, ROW)
fs.writeFileSync(FILE, out.join('\n'), 'utf8')
console.log(`v3.56 已插入(位置 ${lastVer + 1});总行 ${out.length};v3.56 行数 =`,
  out.filter((l) => l.startsWith('| v3.56 |')).length)
