/**
 * _doc-v361.cjs — 追加 v3.61:单据状态(审核/作废/删除)跟随源面板(2026-10-25)
 *
 * 背景:用户报障「采购订单删除数据,供应商打印并不同步」。
 * 根因是 `yj_doc_status` 按**面板编码**分账,副本面板查不到自己的状态行。
 * 幂等:已有 v3.61 先删再追加;表行不动。
 */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', '..', 'docs', 'development', '数据库表清单.md')
const lines = fs.readFileSync(FILE, 'utf8').split('\n')

const ROW = [
  '| v3.61 | 2026-10-25 | **供应商采购打印的「单据状态」改为跟随采购订单**(用户报障「采购订单删除数据,',
  '供应商打印并不同步」;**无数据库变更**,纯代码)。',
  '**根因**:单据状态不存业务表,存 `yj_doc_status(panel_code, doc_no)` —— 审核/作废/删除/归档/提交审批全在这张表,',
  '按**面板编码**分账。供应商面板 `SUPPLIER_PU_ORDER` 是另一个编码,按自己的编码查**一条都查不到** ⇒',
  '① 列表每张单的「审核状态」恒为「草稿」(采购订单显示「已审核」);',
  '② 已删除的单据**排除不掉**(`canceled = \'Y\'` 的过滤按它自己的编码查,永不命中)⇒ 总数比采购订单多 1',
  '(实测 2245 vs 2244)—— 用户看到的就是"删除不同步"。',
  '**修法**:新增 `panel/PanelAliases.java` 集中登记"副本面板 → 源面板"的两处映射',
  '(`fieldSource` 字段定义 + `statusSource` 单据状态);`QueryService` 的 4 处状态读取全部先折算 ——',
  '列表状态 `loadStatus`、归档区间过滤、作废/删除排除、按「审核人」关键字搜索;',
  '`PanelRegistry` 的字段跟随改为读同一份登记,以后新增副本面板只需登记一处。',
  '写入口不受影响(保存/审核/删除本来就发生在采购订单面板)。',
  '**验证**:`_v-delete-sync.cjs` **7/7**(造单 → 两边可见 → 写 `canceled=\'Y\'` 删除 → **两边都查不到** → 清理回基线)、',
  '`_v-doc-status-sync.cjs` **6/6**(两面板总条数 2244=2244、同一批单状态逐条相同、分布相同、',
  '不再清一色草稿、供应商范围仍 74 行)、`_ui-doc-status-visible.cjs` **5/5**(界面:采购订单 2244 张「已审核」/',
  '供应商打印 74 张同样「已审核」/ 管理员视角两面板均 2244)、面板界面 12/12、面板接口 19/19、',
  '同表同步 11/11、采购订单未受影响 10/10。⚠ 本行手写(理由同 v3.31) |',
].join('')

const out = []
for (const line of lines) {
  if (line.startsWith('| v3.61 |')) continue
  out.push(line)
}
const lastVer = out.map((l, i) => (l.startsWith('| v3.') ? i : -1)).filter((i) => i >= 0).pop()
out.splice(lastVer + 1, 0, ROW)
fs.writeFileSync(FILE, out.join('\n'), 'utf8')
console.log(`v3.61 已插入(位置 ${lastVer + 1});v3.61 行数 =`, out.filter((l) => l.startsWith('| v3.61 |')).length)
