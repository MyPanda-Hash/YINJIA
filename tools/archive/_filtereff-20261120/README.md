# 功能性滤效「样品列 ＋/－」只有取样前样品跟着加列 —— 根因与修复取证（2026-11-20）

## 1. 报障

数据记录表「功能性滤效」`RD_FILTER_EFF` 的「3.数据记录表」：点右上角「样品列 ＋/－」时，
**只有「取样前样品」组跟着增删列**，`出水含量（ug/L）` 与 `去除率%` 两组永远只剩「样品1」。用户连报两次。

## 2. 代码层先排除

`frontend/src/core/views/DataRecordSheet.vue` 三组都用 `v-for="n in sampleCount"`：
colgroup（`cp/co/cr`）、表头（`hp/ho/hr`）、表体（`dp/do/dr`）各一套；
组内每一列/格都带 `v-if="!dtHidden(key)"`，分组表头 `:colspan="dtGroupSpan(name)"`。
本地 vite（本地库）打开该面板点 ＋：三组表头都出现 样品1/2/3 ⇒ **代码渲染路径本身是同步的**。

## 3. 真实根因（库取证）

`dtHidden(key)` → `isColumnHidden(field)`；后端下发字段规格时 **`dataName = yj_field.label`**、
`visible=false` 才下发 `visible:false`（`PanelConfigService.fieldSpec`）。
于是 `yj_field` 里被置隐藏的动态样品列，前端就直接不渲染。

只读取证（`probe-field-visible.py`，生产库 `36.140.66.163/HSDZ_MES`，修复前）：

| id | label | hidden | visible |
| --- | --- | --- | --- |
| 3142 | 出水含量（ug/L）样品1 | 0 | 1 |
| **3143** | **出水含量（ug/L）样品2** | **1** | **0** |
| **4883** | **出水含量（ug/L）样品3** | **1** | **0** |
| **4884** | **出水含量（ug/L）样品4** | **1** | **0** |
| **4885** | **出水含量（ug/L）样品5** | **1** | **0** |
| **4886** | **出水含量（ug/L）样品6** | **1** | **0** |
| 3144 | 去除率%样品1 | 0 | 1 |
| **3145** | **去除率%样品2** | **1** | **0** |
| **4887** | **去除率%样品3** | **1** | **0** |
| **4888** | **去除率%样品4** | **1** | **0** |
| **4889** | **去除率%样品5** | **1** | **0** |
| **4890** | **去除率%样品6** | **1** | **0** |
| 3137..3138 / 4875..4878 | 压力（PSI)样品1..6 | 0 | 1 |
| 3139..3140 / 4879..4882 | 流速（L/min)样品1..6 | 0 | 1 |

- 生产：出水/去除率 样品2..6 **共 10 行 hidden=1/visible=0**；压力/流速 12 行全部 visible=1。
- ⇒ 点 ＋ 时 `sampleCount` 变大，但这两组每列都被 `v-if="!dtHidden"` 过滤，只剩样品1；
  压力组没被隐藏，所以「看起来只有取样前样品跟着加列」。

本地库对照（`127.0.0.1:1433/HSDZ_MES`，同一查询）这 10 行全部 `hidden=0/visible=1`
⇒ **本地复现不了**，不是「本地列宽/数据不同」，是**生产库该 10 行是脏偏好**。

来源：历史「表格调整 / 字段编辑」写入 `yj_field.hidden/visible`（2026-11-13 角色字段视图上线前的旧通道，
见 `PanelFieldViewService` 注释「历次表格调整已经在 yj_field 留下 1302 行隐藏」），不是 seed ——
`tools/migrate-rd-filter-eff.sql` 里这 10 行初始就是 `hidden=0/visible=1`。

## 4. 修复

1. **代码护栏**（前端）：`core/sheet/columnPrefs.isColumnHiddenFor(key, field)` ——
   `sampleCols.isDynamicSampleKey` 认定的动态样品列（`压力（PSI)样品N` / `流速（L/min)样品N` /
   `出水含量（ug/L）样品N` / `去除率%样品N`）**恒显示**，不受 `yj_field.visible`、角色字段视图等任何列偏好影响；
   `DataRecordSheet.dtHidden()` 只走它。字段编辑弹窗里这些行的显隐开关 `disabled` 且恒回显为显示，
   保存载荷不会再写 `visible=false`。
2. **库清理**：`tools/migrate-filter-eff-dyncols-visible-20261120.sql`（幂等 + before/after 行数 + 越界自检），
   已登记 `tools/db-migrations.txt`。生产 `HSDZ_MES` 实测：目标 29→29 行（未增删），
   目标 10 行 `hidden 1→0 / visible 0→1`，**其余行 0 变化**；重复执行 0 行。
   生产测试库 `HSDZ_MES_TEST` 同 10 行本来就是 visible=1 ⇒ 执行 0 行变更（幂等复核）。
   本地无 `HSDZ_MES_TEST`（登录失败：库不存在）；本地正式库已回归验证脚本对脏数据生效
   （事务内模拟 hidden=1 → 脚本归位 → 回滚，未留痕）。
3. 服务端元数据有 30s 缓存（`PanelRegistry` TTL），库改完 ≤30s 自动重载；即使缓存里仍是
   `visible=false`，前端护栏也已让它不生效。

## 5. 复验

```bash
# 只读取证（隐藏行数应为 0）
python3 probe-field-visible.py --host 36.140.66.163 --db HSDZ_MES \
  --config ../../../deploy/winrm/config.json
# 前端单测（护栏 + 三组列数恒等 + 组件接线）
cd frontend && node --test src/core/sheet/dynamicSampleCols.test.js
```

UI 复验（部署后）：打开一张该面板单据 → 点「样品列 ＋/－」→ 三组表头/数据格同步增删；
「出水含量（ug/L）」「去除率%」两组列数 = 样品数（2..6）。

## 6. 生产清理前后（2026-11-20，pymssql 直连 1433，只改数据）

```
HSDZ_MES      BEFORE: detail rows=29; target(10) rows=10 hidden=10
HSDZ_MES      AFTER : detail rows=29; target(10) rows=10 hidden=0   CHANGED rows=10
HSDZ_MES_TEST BEFORE: detail rows=29; target(10) rows=10 hidden=0
HSDZ_MES_TEST AFTER : detail rows=29; target(10) rows=10 hidden=0   CHANGED rows=0
```
