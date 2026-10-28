/**
 * _doc-v359.cjs — 追加 v3.59:供应商采购打印与采购订单同表 + 字段定义跟随(2026-10-25)
 * 幂等:已有 v3.59 先删再追加;按行处理。
 */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', '..', 'docs', 'development', '数据库表清单.md')
const lines = fs.readFileSync(FILE, 'utf8').split('\n')

const ROW = [
  '| v3.59 | 2026-10-25 | **供应商采购打印与采购订单「同一张表 + 字段定义跟随」**(用户口径「供应商采购打印,',
  '应该和采购订单应该用同一个表,不然数据不同步」;本次**无数据库变更**,纯代码)。',
  '① **表**:两面板本来就绑同一张 `bd_pu_order` + `bl_pu_order`(`yj_panel.head_table/line_table` 逐字相同),',
  '数据天然同步 —— 实测:直接改 `bd_pu_order.[备注]` 后,采购订单端与供应商端**立刻**读到同一个新值',
  '(无需任何同步动作)。② 真正的隐患是**字段定义漂移**:供应商面板的 `yj_field` 是建面板时复制的副本,',
  '采购订单以后加/改/删字段它不会跟着变。故在 `PanelRegistry` 增加 `FIELD_FOLLOW`',
  '(`SUPPLIER_PU_ORDER` → `PU_ORDER`):**读取元数据时直接复用源面板的字段定义**(纯内存,不写库),',
  '采购订单改字段 ⇒ 供应商端下一次快照刷新(≤30s)自动就是新字段,零同步脚本。',
  '⚠ 副作用(已写进代码注释):`yj_field` 里供应商那份副本**不再是真源**,在面板配置界面改它不会生效;',
  '要改列请改采购订单面板。③ **验证**:`_v-same-table-sync.cjs` **11/11**',
  '(字段集逐列一致 / 同一单据头字段与明细行数相同 / 改备注两边立刻同值 / 范围过滤仍 74 行不外溢)、',
  '`_v-field-follow.cjs` **9/9**(只改采购订单的 label → 两端都显示新 label、而供应商那份副本一个字节没动 ⇒ ',
  '证明是"读取跟随"而非写库同步;还原后两端一起回旧值)。④ 同批修掉一个验证基建缺陷:',
  'UI 脚本用 `spawn(detached)` 起无头浏览器后靠 `process.kill(-pid)` 收尾,在 Windows 上杀不掉',
  '(负 pid 无进程组语义),实测一次会话泄漏 237 个 `msedge`,吃光内存后**把 8090 的 java 一起拖死**;',
  '新增 `tools/verify/lib/kill-tree.cjs`(`taskkill /T /F`)与 `browser-close.cjs`(CDP `Browser.close`),',
  '6 个 UI 脚本已改用 ⇒ 跑完 `msedge` 归零。⚠ 本行手写(理由同 v3.31) |',
].join('')

const out = []
for (const line of lines) {
  if (line.startsWith('| v3.59 |')) continue
  out.push(line)
}
const lastVer = out.map((l, i) => (l.startsWith('| v3.') ? i : -1)).filter((i) => i >= 0).pop()
out.splice(lastVer + 1, 0, ROW)
fs.writeFileSync(FILE, out.join('\n'), 'utf8')
console.log(`v3.59 已插入(位置 ${lastVer + 1});v3.59 行数 =`, out.filter((l) => l.startsWith('| v3.59 |')).length)
