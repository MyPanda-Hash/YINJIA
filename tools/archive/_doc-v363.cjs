/**
 * _doc-v363.cjs — 追加 v3.63:供应商「打印材料码」恢复弹窗(2026-10-29)
 */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', '..', 'docs', 'development', '数据库表清单.md')
const lines = fs.readFileSync(FILE, 'utf8').split('\n')

const ROW = [
  '| v3.63 | 2026-10-29 | **供应商「打印材料码」恢复弹窗(不再直接提示打印成功)**(用户报障「供应商登录打印材料码时,',
  '直接就显示打印成功了,没有和采购订单一样有弹窗。这是一个错误」;**无数据库变更**,纯代码)。',
  '**根因**:「打印材料码」的开窗分支写死了 `panelCode === \'PU_ORDER\'`,而供应商采购打印是**另一个面板编码**',
  '`SUPPLIER_PU_ORDER`(采购订单的只读副本)⇒ 供应商点它不进弹窗,落到通用分支直接提示成功,',
  '**批次号根本没登记、订单余量也不扣**;且供应商端 `puLabel` 三条接口全被 `SupplierPortalGuardFilter` 拦成 403',
  '(供应商只有本面板的 view/query/print,没有 PU_ORDER 的修改权),弹窗即便打开也取不到数。',
  '**修法**:① 前端 `PanelxList` 引入面板族 `MATERIAL_LABEL_PANELS = [PU_ORDER, SUPPLIER_PU_ORDER]`,',
  '判据改为 `includes(panelCode)`(与后端 `PanelAliases` 的副本面板登记同源,以后新增副本面板加一处即可);',
  '② 后端 `PxController.requireMaterialLabelAccess()`:`/px/puLabel/dialog`、`/px/puLabel/print` 对供应商会话改按',
  '**逐单归属**把关(`QueryService.supplierMayReadDoc` —— 只能操作自己供应商的采购订单,别人的单一律 403),',
  '内部账号仍按 PU_ORDER 的查看/修改权;③ `SupplierPortalGuardFilter` 放行 `puLabel/dialog`、`puLabel/print`、',
  '`puLabel/batchLock` 三条(重打/作废维持原权限,供应商界面无入口);④ `QueryService.sessionSupplierCode()` 改 public',
  '(权限闸门要区分「内部账号按面板权 / 供应商按归属」)。',
  '**验证**:接口 `_v-supplier-material-label.cjs` **9/9**(弹窗取数 200 / 预填批次号 20261029 / 别人的单 403 /',
  '登记打印 200 / **可打印量 999→998 实扣** / 记录落 `bd_pu_label` / 管理员不受影响)、',
  '界面 `_ui-supplier-material-label.cjs` **5/5**(真实登录点「打印材料码」→ 弹窗出现、标题「打印材料码 · 单号」、',
  '批次号可改、列出订单行可勾选;网络日志确认发的是 `/px/puLabel/dialog` 而非通用 `callButton`);',
  '回归:面板接口 19/19、采购订单未受影响 10/10、单据状态同步 6/6、前端单测 1031/1031。',
  '⚠ 测试打印记录(批次号 ML*)已软删清理。⚠ 本行手写(理由同 v3.31) |',
].join('')

const out = []
for (const line of lines) {
  if (line.startsWith('| v3.63 |')) continue
  out.push(line)
}
const lastVer = out.map((l, i) => (l.startsWith('| v3.') ? i : -1)).filter((i) => i >= 0).pop()
out.splice(lastVer + 1, 0, ROW)
fs.writeFileSync(FILE, out.join('\n'), 'utf8')
console.log(`v3.63 已插入(位置 ${lastVer + 1});v3.63 行数 =`, out.filter((l) => l.startsWith('| v3.63 |')).length)
