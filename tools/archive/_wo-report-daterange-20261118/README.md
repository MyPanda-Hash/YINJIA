# 报工记录：日期段查询 + 报工数量合计（2026-11-18）

## 用户口径（截图 2 张）

1. 「报工记录，要可以选择某个日期段的」—— 查询区「单据日期」原来只有单日选择；
2. 「报工数量下面要有一个合计数量」—— 页脚合计行在「报工数量」列是空的。

## 改了什么

### 前端（`frontend/src/core/views/PanelxList.vue`）

- 报表**内联查询区**的「单据日期」在报工记录面板改用通用 `@core/ui/DateRangeQuery`
  （daterange + 今日/本周/本月/近7天/近30天/上月快捷档，与订单结转/生产工单同一控件）。
  范围只放开 `WO_REPORT_LIST`（`INLINE_DATE_RANGE_PANELS`），其它报表面板仍是原单日查询。
- 区间值只落 `condition.开始日期 / condition.结束日期` 两个控制键；选择过程中只有一端的中间值
  **不查库**，`change`（两端齐全/清空）时才写入并查询。
- 页脚合计：`sumMethod` 的数值判据补上 `数值`（`yj_field.data_type` 报工数量就是「数值」），
  并优先使用服务端 `sums`（整段查询合计），没有则落回原来的本页合计口径。

### 纯逻辑（`frontend/src/core/report/reportQuery.js`）

`normalizeDateRange` / `dateRangeToCondition` / `dateRangeFromCondition`：
只认 `YYYY-MM-DD`；反序自动交换；任一端缺失/非法 ⇒ `{}`（不按半截条件查）；
单测 12 条（`reportQuery.test.js`）。

### 后端（`backend/.../service/QueryService.java`）

1. **日期段过滤修正**（本次需求的硬前提，改前报工记录日期段直接 500）：
   - `rangeCol` 改为 `l2c.get(...)` 取**物理列名**。旧写法把 label「单据日期」当列名拼，
     只有列名恰好是中文的库存台账/汇总视图碰巧能用；`scjl` 的列是 `sc_date` ⇒
     `Invalid column name '单据日期'`。
   - 结束日改半开区间 `< DATEADD(day,1,CAST(? AS date))`：`scjl.sc_date` 1314 行里 1275 行带时分秒，
     旧的 `<= 'yyyy-MM-dd'` 会漏掉结束日当天 00:00 之后的报工。
2. **整段合计**（`reportQuantitySums`）：平表查询对 `dataType=数值` 的列按**同一条 WHERE** 求 SUM，
   随响应返回 `sums: {列label: 合计}`。原因：报表 50 行/页，el-table 页脚只拿得到当前页，
   按日期段汇总时数字会只有第 1 页的 50 行。`TRY_CAST(... AS decimal(38,6))` 防脏值/浮点尾差，
   异常只 WARN 并返回 null（合计是附加信息，不能把列表打挂）。
   范围只到「数值」列（全库 6 个数值字段，报表里就报工数量/完成数量），
   小数/整数列与库存三张整表重算视图维持原口径，不额外扫表。

## 验证证据（2026-11-18 实机）

数据库基准（`HSDZ_MES`，`asp_cancel<>'Y'`）：

| 范围 | 行数 | SUM(报工数量) |
|---|---|---|
| 全量 | 1189 | 2,990,968 |
| 2026-10-01 ~ 2026-10-31 | 320 | 647,737 |

- API（`/api/px/queryFormDataList`）：`condition={开始日期:'2026-10-01',结束日期:'2026-10-31'}`
  ⇒ `totalSize=320`，`sums.报工数量=647737`；第 7 页同样 `647737`（不是分页合计）。
- UI 5173（`round-18.png`）：单据日期显示 `2026-10-01 - 2026-10-31`，
  标题「报工记录 2026-10-01 - 2026-10-31」，右上「共 320 条」，列表全为 10 月记录。
- 页脚（`round-19-p7-footer.png` / `round-21-footer.png`）：合计行 `工单行号=74`（本页）、
  `报工数量=647737`（整段）。
- 清空日期段（`round-20-cleared.png`）：回到「共 1189 条」、合计 2,990,968、
  标题「当前业务数据」，两个日期输入框清空。
- 8090（jar 内前端，`round-23-8090.png`）：同一操作得到「共 320 条」、
  标题 `2026-10-01 - 2026-10-31`、页脚 `报工数量=647737`。
- 单测：`node --test src/core/report/reportQuery.test.js src/core/views/reportListDateRange.test.js`
  18/18 PASS（全量 `node --test` 2223 条里 5 条失败均为 `recordSheetConfigs.livedb.test.js`
  的环境问题：本机缺 `SQLCMD.EXE`，与本次改动无关）。

> 截图按仓库口径（`.gitignore` 的 `*.png`，2026-10-15 用户口径「截图不要入库」）**不入库**：
> 本地证据在 `C:/Users/vigna/ego/wo-report-daterange-20261118/*.png`
> （`tools/archive/_wo-report-daterange-20261118/shots/` 是同样的副本，同样不入库）。
> 入库的是可复跑的 `ego/round-*.mjs` 脚本与判定数值（见上）。

## 复跑

```bash
cd frontend
node --test src/core/report/reportQuery.test.js src/core/views/reportListDateRange.test.js
```

ego 脚本（`ego/round-*.mjs`）在 `C:/Users/vigna/ego/wo-report-daterange-20261118/` 现场生成，
用 `ego-browser nodejs -e "await import('file:///.../round-18.mjs')"` 复跑；
脚本会操作已登录的 5173 会话，直接点查询区的「单据日期」→「上月」即可复现。

## 注意

- 合计口径 = **整个查询结果**（日期段/筛选后全部行），不是当前页；
  「工单行号」仍是 el-table 的本页合计（历史行为，本次未动）。
- 列头筛选是**当前页前端筛选**（历史行为），不改变合计口径；要按工序/生产线汇总，
  请用查询区对应字段（走服务端 WHERE，`sums` 随之变化）。
- 本次只提交源码与证据。`backend/src/main/resources/static`（仓库跟踪的部署包前端）**未改**：
  当前工作区有另一个未提交任务（工艺清单归档→基础数据清单）的静态产物改动，
  同步会把两件事混进同一个提交；等该任务提交后再 `npm run build` + 同步即可。
- 8090 这次是用 `jar uf` 把新构建的 `dist` 直接写进现役 jar 的 `BOOT-INF/classes/static`
  （不动工作区 static），停→换→起后实测生效；下次任何人跑 `build-appjar.ps1` 会从源码重新
  构建并同步，自动包含本功能。

