/**
 * _doc-v357.cjs — 数据库表清单追加 v3.57 维护行(2026-10-25)
 * 本次「供应商采购打印」从"复用采购订单页"改为**独立面板 SUPPLIER_PU_ORDER**(元数据副本),
 * 有建表以外的元数据新增(插 yj_panel 1 行 + yj_field 186 行 + 译名),按规范必须登记。
 * 幂等:已有 v3.57 行先删再追加(按行处理,不做字符串替换)。
 */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', '..', 'docs', 'development', '数据库表清单.md')
const lines = fs.readFileSync(FILE, 'utf8').split('\n')

const ROW = [
  '| v3.57 | 2026-10-25 | **新增独立面板 `SUPPLIER_PU_ORDER`(供应商采购打印):采购订单的只读元数据副本**',
  '(用户口径「是多做一个和采购订单一样的供应商面版,只有打印按钮和查询(查询必须只能查供应商关联的数据)按钮的」;',
  '`migrate-supplier-po-panel-20261025.sql`,两账套已执行)。① **不建表**:面板与采购订单**共用** ',
  '`bd_pu_order` + `bl_pu_order`(同一张单、同一份数据),`yj_panel` 只插 1 行 ',
  '(`mode/doc/头行表/分组键/前缀/page_size` 全部照 PU_ORDER),`module_group`=智能供应链;',
  '② `yj_field` 按 PU_ORDER 的 **186 行逐列复制**(label/place/seq/类型/参照/必填/只读/宽/页签全沿用,',
  '按 `col_name + place` 判重幂等)⇒ 纸张、明细表、表头字段与采购订单**逐字一致**;',
  '③ 面板名译名 9 语言入 `yj_translation`(scope=panel,manual);',
  '④ 自检:面板存在 / 字段行数 ≥ 采购订单 / 含「供应商编码」「单据编号」/ 译名 ≥ 9 语言。',
  '**按钮口径**(`PanelConfigService.PANDA_BUTTONS`):只登记 **查询**(查询)+ **打印**(打印采购订单/预览/导出/',
  '打印订单无金额/打印材料码)两组 —— 「查询」由前端常驻查询按钮承担、组内不带「刷新」,故工具栏**只有查询和打印两颗**;',
  '没有 新增/保存/删除/审核/生单/转ERP/导入/更多(内部账号进来同样只读)。',
  '**数据范围**(服务端强制,不信前端):`QueryService.enforceSupplierScope` —— 供应商会话调列表接口时',
  '用 `yj_supplier_account` 认定的供应商编码**覆盖**前端条件成「供应商编码 LIKE 值」,且只认本面板;',
  '`getFormDescriptor` 逐单核对归属(`supplierMayReadDoc`,别人的单一律 403);`SupplierPortalGuardFilter` ',
  '定向放行 `queryFormDataList` / `getPanelConfig?panelCode=SUPPLIER_PU_ORDER` / `getFormDescriptor`,',
  '其余 /api(叫按钮、删除、别的面板…)仍一律 403。',
  '**前端**:`menus.js` 把「供应商采购打印」移到采购管理 →「单据」组(与采购订单并列),供应商门户组只剩「供应商权限配置」;',
  '`router` 用 `props: { panelCode: 「SUPPLIER_PU_ORDER」 }` 走通用面板页(⚠ 先前写成静态路径不带参数 ⇒ ',
  '`route.params.panelCode` 为空 ⇒ 组件判"面板编号无效"直接 return,界面只剩一颗查询按钮,已修);',
  '`PanelxList` 增加可选 `panelCode` prop 与 `DOC_RAIL_PANELS.SUPPLIER_PU_ORDER`(左栏与采购订单同列)。',
  '⑤ **验证**:`_v-supplier-po-panel.cjs` **19/19**(结构/按钮/范围/越权/内部账号全量)、',
  '`_ui-supplier-po-panel.cjs` **12/12**(真实登录 → 只有查询+打印、左栏+明细、74 张、打印出「银嘉采购订单」纸质单;',
  '内部账号同一面板 2245 张)、`_v-puorder-intact.cjs` **10/10**(采购订单原按钮一个不少)、',
  '既有回归 25/25 + 10/10 + 5/5、前端单测 858/858。⚠ 本行手写(理由同 v3.31) |',
].join('')

const out = []
for (const line of lines) {
  if (line.startsWith('| v3.57 |')) continue
  out.push(line)
}
const lastVer = out.map((l, i) => (l.startsWith('| v3.') ? i : -1)).filter((i) => i >= 0).pop()
out.splice(lastVer + 1, 0, ROW)
fs.writeFileSync(FILE, out.join('\n'), 'utf8')
console.log(`v3.57 已插入(位置 ${lastVer + 1});总行 ${out.length};v3.57 行数 =`,
  out.filter((l) => l.startsWith('| v3.57 |')).length)
