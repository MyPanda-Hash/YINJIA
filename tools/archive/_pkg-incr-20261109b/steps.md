# 增量部署包 pkg-incr-20261109b(换 app.jar + 5 条迁移;含**工单进度看板**在途实现)

> ⚠ **这是"含在途实现"的包**(用户 2026-11-09 口径):除已提交的两侧 14 个提交外,还包含主工作区
> **当时未提交**的「工单进度看板」整套代码(4 个 Java 类 + 3 个 Vue + 路由/菜单/10 语种 + 1 条迁移)。
> 为了可追溯,该状态已在本地提交为 `b970f7844`(分支 `merge-20261109`),不是"凭空打出来的脏包"。
>
> 解压到 **C:\yj-deploy**;**先清空旧包**(`pkg-incr-20261106` / `pkg-incr-20261109` 等)再解压。
> 服务器:**管理员 cmd**;命令块可整段复制(块内无注释)。
> jar 内嵌前端 **`index-B9tdg78R.js`**;manifest **730 条**;to-run **5 条**。

## 0. 部署前核对(应全对)

| 指纹 | 期望值 |
|---|---|
| 现役 jar 内前端入口 | `assets/index-e3iBleUE.js` |
| `C:\yinjia\app.jar` SHA256 | `5af36959f0581a17c8b4462ad4c017402b723c92e45fcd309645e6a8082623d3` |
| `yj_schema_log` / 备份表 | **761** / **0** |

```cmd
certutil -hashfile C:\yinjia\app.jar SHA256
sqlcmd -S localhost -E -h -1 -W -Q "SET NOCOUNT ON; SELECT 'LEDGER=' + CAST(COUNT(*) AS varchar(10)) FROM HSDZ_MES.dbo.yj_schema_log; SELECT 'BAK=' + CAST(COUNT(*) AS varchar(10)) FROM HSDZ_MES.sys.tables WHERE CHARINDEX('bak', name) > 0 OR CHARINDEX('RENAME_', name) > 0 OR CHARINDEX('tmp_', name) > 0"
```

## 1. CHECK(只读)

```cmd
cd /d C:\yj-deploy
deploy-incremental.bat
```

## 2. GO

```cmd
cd /d C:\yj-deploy
deploy-incremental.bat GO
```

期望:`APP-STOPPED → BACKUP-GATE-PASSED → MIGRATIONS-OK → NEW-JAR-IN-PLACE → APP-STARTED → LOGIN-OK → RESULT: ALL-OK`。

## 3. 本包内容

### 3.1 代码(三层叠加)

| 层 | 内容 |
|---|---|
| 远端 11-07(服务器已上) | 内部样品单:Excel 纸面 → 数据记录表(行级归属 / 改他人行 / 20 行分页 / 保存后锁定) |
| 本地 11-08/09(本次首上) | 制程检验单改名「**出货检验单功能**」、检验方案弹窗隐藏不合格应对措施、生产工单/排产隐藏「余量」列、报工记录加产品编码/产品规格列与三个查询条件、工单排产冻结三列、订单结转允许超单(备品) |
| **在途(本包新增)** | **生产工序进度看板** `/prod/plan/workOrderProgress`:大屏 + 列表双视图、按工单行看各工序进度、点订单行转跳工单;后端 `WorkOrderProgressController/Service` + `WorkOrderInspectionService` + `PlangRowOccupancy` |

### 3.2 to-run 5 条(顺序即执行顺序)

| # | 脚本 | 作用 |
|---|---|---|
| 1 | `migrate-sample-int-row-owner-20261106.sql` | **修复版**:「改他人行」授权由写死 `role_id(1,3,4)` 改为按 `can_approve='Y'`(生产库角色是 1/1025/1026) |
| 2 | `migrate-work-order-progress-panel-20261108.sql` | 进度看板页面级权限:给已授 `WORK_ORDER_LIST` 可见的角色 + 管理员补 `WORK_ORDER_PROGRESS` 的 `view,query`;补面板名译名 |
| 3 | `migrate-wo-report-list-product-cols-20261108.sql` | 报工记录:产品编码/产品规格 显示列 + 产品编码/客户编码/产品规格 查询条件(3 行 `yj_field` + 9 语种译名) |
| 4 | `migrate-qc-proc-insp-rename-20261109.sql` | 制程检验单 → **出货检验单功能**(面板名/字段/译名/报表口径) |
| 5 | `migrate-qc-proc-insp-tpl-20261109.sql` | 出货检验单报表模板随改名同步(`yj_report_template`) |

五条均幂等;两账套强制重跑演练 **5/5 通过**(`REHEARSAL-OK`)。

### 3.3 `[4b] baseline` 会刷 120 条历史脚本哈希(只更新、不执行)

让 `[4c]` 裸 `DbSync` 变成「执行 0」;不做这一步,下次谁跑裸 sync 都会重放那 120 条。判据 = `[4c]` 打印 `执行 0`。

## 4. 部署后验收

```cmd
sqlcmd -S localhost -E -h -1 -W -Q "SET NOCOUNT ON; SELECT 'LEDGER=' + CAST(COUNT(*) AS varchar(10)) FROM HSDZ_MES.dbo.yj_schema_log; SELECT 'FIELDS=' + CAST(COUNT(*) AS varchar(10)) FROM HSDZ_MES.dbo.yj_field; SELECT 'PANELS=' + CAST(COUNT(*) AS varchar(10)) FROM HSDZ_MES.dbo.yj_panel; SELECT 'BAK=' + CAST(COUNT(*) AS varchar(10)) FROM HSDZ_MES.sys.tables WHERE CHARINDEX('bak', name) > 0"
```

```cmd
set YINJIA_SQL_PASS=Yinjia@2026
cd /d C:\yj-deploy\tools
java -cp lib\mssql-jdbc.jar verify\FourDocAudit.java
java -cp lib\mssql-jdbc.jar verify\DbNormAudit.java
```

| # | 判据 | 期望 |
|---|---|---|
| 1 | `LEDGER` | **765**(761 + 4 条新增;`row-owner` 是更新不增行) |
| 2 | `FIELDS` / `PANELS` | **4898** / **152**(看板是页面级虚拟面板,不占 `yj_panel`) |
| 3 | `BAK` | **0** |
| 4 | `FourDocAudit` | `[PASS]`(本包已带 dump,物理列对账会真跑) |
| 5 | `DbNormAudit` | 第 10 项 PASS(0);`FAIL-2` 为存量(02 `rd_sample_int_detail` / 09 缺 en 217) |
| 6 | 外网首页 chunk | `index-B9tdg78R.js` |
| 7 | 界面 · 进度看板 | 「生产计划 → 生产工序进度(看板)」可打开;大屏/列表切换;点订单行能跳到工单 |
| 8 | 界面 · 报工记录 | 多出「产品编码/产品规格」列;可按 产品编码/客户编码/产品规格 查 |
| 9 | 界面 · 出货检验单功能 | 菜单/面板已改名(原「制程检验单」);方案弹窗无「不合格应对措施」 |
| 10 | 界面 · 工单/排产 | 生产工单、工单排产、快速排产无「余量」列 |
| 11 | 界面 · 内部样品申请单 | 数据记录表:只看/改自己行、20 行分页、保存后锁定 |

## 5. 回滚

- 只回滚 jar:`copy /y C:\yinjia\backup\app-<TS>.jar C:\yinjia\app.jar` + `schtasks /run /tn YINJIA-MES`。
- 回滚库:`RESTORE DATABASE [HSDZ_MES] FROM DISK = N'C:\yinjia\backup\pre-deploy-<TS>.bak' WITH REPLACE`(需 `sqlcmd -E`)。
- 库回滚后 `yj_schema_log` 随之回退。

## 6. 记账

`deploy/部署台账.md` 追加**第 25 行** + 一节:三指纹(新 jar `0d992f94…` / 入口 `index-B9tdg78R.js` / ledger **765**)、
迁移 5 条、**120 条字节漂移走 baseline 未执行**、界面 11 项验收证据、回滚点。
并注明本包**含在途实现**(本地提交 `b970f7844`,分支 `merge-20261109`),`main` 尚未 ff 过去。
