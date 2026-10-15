# _stock-report-dup-fields — 库存报表字段重复(2026-10-15 用户报障)取证与收尾产物

**用户原话**:「库存状况表出现字段重复的情况修复一下,顺便检查别的库存报表会不会这样」

## 结论

| 面板 | 修复前列表列 | 修复后 | 说明 |
|---|---|---|---|
| 库存状况表 `STOCK_BALANCE` | 13 列(仓库编码/仓库/存货编码/存货 **各两遍**) | **9 列** | 用户看到的重复 |
| 库存台账 `STOCK_LEDGER` | 33 列(仓库/存货 各两遍 + 多出 开始日期/结束日期) | **29 列** | 同类问题 |
| 收发存汇总表 `STOCK_SUMMARY` | 23 列(同上) | **19 列** | 同类问题 |
| 库存明细 `STOCK_DETAIL` | 9 列 | 9 列 | 本来就干净 |

根因:`migrate-server-converge-20261007.sql`(链上 2481 行)补缺 `yj_field` 的守卫按
`(panel_code, col_name, place)` **三元组**判存在,而这三张报表的原始字段 `place` 是合并值 `'query,detail'`,
收敛快照里带的却是 `'detail'` ⇒ 判「不存在」→ 同一字段又插一遍(id 变大、宽度 130、丢掉参照绑定)。
flat 面板的列表列 = `def.fields()` 全量(`PanelConfigService.buildGridColumns` 只按 `visible` 过滤、不做同名去重),
于是同名两列都下发;而 `QueryService.rowToLabels` 按 label 收敛成一个键 ⇒ 界面上两列内容完全一样。
同批被收敛脚本复活的还有 `开始日期/结束日期` —— 它们早被链上更靠前的 `migrate-report-dialog-fields.sql`
显式删掉(弹窗日期段改为前端内置控件),属「删了又被插回来」。

修复:`tools/migrate-stock-report-dup-fields-20261015.sql`(登记在 `db-migrations.txt` **链尾**)。
回归闸:`tools/verify/StockReportFieldAudit.java`。

同类问题(本次**未处置**,用 `StockReportFieldAudit.java --all` 可复现):
生产排产 `MANU_SCHEDULE` 29 组同名重复 + 23 个字段在视图里不存在;排单计划 `WO_SCHEDULE` 17 组同名重复。

## 产物

| 文件 | 用途 |
|---|---|
| `q1-fields.sql` / `q1.out` | 库存报表组字段清单(暴露重复) |
| `q2-state.sql` / `q2.out` | 五面板字段数 / `yj_field` 列结构 / `yj_panel` 定义 |
| `q3-flat-dup.sql` / `q3.out`·`q3-test.out` | **全部 flat 面板**体检:同名 label、同名列、列在底层对象里不存在(两账套) |
| `q4-view-cols.sql` / `q4.out` | 三张视图的真实列(证实 `开始日期/结束日期` 是视图派生列、不是幽灵列) |
| `q5-would-delete.sql` / `q5-*.out` | 删除规则**干跑**(规则 A 命中 8 行、规则 B 命中 4 行,并证明不会误伤别的 place 组合) |
| `q8-srv.sql` / `q8-*.out` | `127.0.0.1:1433` 与 `localhost:1433` 是同一实例(排除「改错库」) |
| `cfg-before.txt`·`cfg-after2.txt` / `dump-cfg.ps1` | 走真接口(`/api/px/getPanelConfig`)抓修复前/后的列表列 |
| `verify-list.ps1` | 修复后取数回归(四面板 totalSize + 台账弹窗「仓库/存货/日期段」期初期末合成行) |
| `idem-*.out` | 迁移幂等复跑证据(第二次 A=0 行、B=0 行,自检 PASS) |
| `audit-all.out` | 回归闸 `--all` 全平表扫描输出(含未处置的 MANU_SCHEDULE/WO_SCHEDULE) |
| `_shot-stock-reports-1015.mjs` / `*.png` / `ui-columns-after.txt` | CDP 实拍四张报表的列表列(⚠ PNG 按仓库口径**不入库**,只留本地) |

复跑:

```
cd tools
set YINJIA_SQL_PASS=Yinjia@2026
java -cp lib\mssql-jdbc.jar verify\StockReportFieldAudit.java                 :: 库存报表组回归闸
java -cp lib\mssql-jdbc.jar verify\StockReportFieldAudit.java HSDZ_MES --all  :: 全平表扫描
node archive\_stock-report-dup-fields\_shot-stock-reports-1015.mjs            :: 重新截图(需 8090 在跑)
```
