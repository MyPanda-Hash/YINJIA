# 增量部署包 pkg-incr-20261109(换 app.jar + 4 条迁移;基线 = 服务器现役 jar ec0f11f58)

> 解压到 **C:\yj-deploy**;若目录里还有旧包(`pkg-incr-20261106` 等),**先清空**再解压,避免两套 to-run/tools 混放。
> 服务器:**管理员 cmd**;命令块可直接整段复制(块内无注释)。
> jar 内嵌前端 **`index-B1itg9k5.js`**;manifest **729 条**;to-run **4 条**。

## 0. 部署前先核对服务器现状(三条,应当全对)

| 指纹 | 期望值 |
|---|---|
| 现役 jar 内前端入口 | `assets/index-e3iBleUE.js` |
| `C:\yinjia\app.jar` SHA256 | `5af36959f0581a17c8b4462ad4c017402b723c92e45fcd309645e6a8082623d3` |
| `yj_schema_log` 行数 | **761** |

```cmd
certutil -hashfile C:\yinjia\app.jar SHA256
sqlcmd -S localhost -E -h -1 -W -Q "SET NOCOUNT ON; SELECT 'LEDGER=' + CAST(COUNT(*) AS varchar(10)) FROM HSDZ_MES.dbo.yj_schema_log; SELECT 'BAK=' + CAST(COUNT(*) AS varchar(10)) FROM HSDZ_MES.sys.tables WHERE CHARINDEX('bak', name) > 0 OR CHARINDEX('RENAME_', name) > 0 OR CHARINDEX('tmp_', name) > 0"
```

> 期望 `LEDGER=761 BAK=0`。若 ledger 已是 762+,说明之后又有人跑过脚本 —— 先停手核对再 GO。

## 1. CHECK(只读)

```cmd
cd /d C:\yj-deploy
deploy-incremental.bat
```

判据:末行 `RESULT: CHECK-OK`。

## 2. GO(换库 + 换 jar)

```cmd
cd /d C:\yj-deploy
deploy-incremental.bat GO
```

期望依次:`APP-STOPPED` → `BACKUP-GATE-PASSED` → `MIGRATIONS-OK` → `NEW-JAR-IN-PLACE` → `APP-STARTED` → `LOGIN-OK` → **`RESULT: ALL-OK`**。
任一 `RESULT: FAIL-*` 即停手,把 `logs\deploy-*.log` 尾部发回来。

## 3. 本包内容

### 3.1 代码

合并了 **两个方向各 7 个提交**:

- 远端(11-07,服务器已上):内部样品单改回 Excel 纸面版式 + 底部「新增样品」行 → 再改为「数据记录表」
  (行级归属 / 改他人行 / 纸面 20 行分页 / 申请人保存后锁定);
- 本地(11-08/09,本次首次上服务器):制程检验单改名「**出货检验单功能**」、检验方案弹窗隐藏不合格应对措施、
  生产工单/工单排产/快速排产隐藏「余量」列、**报工记录增产品编码/产品规格显示列 + 三个查询条件**、
  工单排产冻结三列、订单结转允许超订单数量(备品)。

### 3.2 to-run 4 条(顺序即执行顺序)

| # | 脚本 | 作用 |
|---|---|---|
| 1 | `migrate-sample-int-row-owner-20261106.sql` | **修复版**:给 RD_SAMPLE_INT 的「改他人行」授权由**写死 role_id(1,3,4)** 改成按 `can_approve='Y'` 判角色。生产库角色 id 是 1/1025/1026,旧版口径只对上管理员 ⇒ 必须用新版跑一遍(实测生产三角色已有该词,本步为口径对齐,幂等) |
| 2 | `migrate-wo-report-list-product-cols-20261108.sql` | 报工记录:产品编码/产品规格 显示列 + 产品编码/客户编码/产品规格 查询条件(追加 3 行 `yj_field` + 9 语种译名) |
| 3 | `migrate-qc-proc-insp-rename-20261109.sql` | 制程检验单 → **出货检验单功能**(面板名/字段/译名/报表口径) |
| 4 | `migrate-qc-proc-insp-tpl-20261109.sql` | 出货检验单报表模板随改名同步(库内 `yj_report_template`) |

四条均幂等;两账套均执行过(本机 rehearsal 4/4 通过)。

### 3.3 `[4b] baseline` 会刷 120 条历史脚本哈希(只更新、不执行)

服务器台账里有 120 条脚本的 `content_hash` 与包内字节不一致(历史修订 + 行尾口径)。
`[4b] baseline` 只更新哈希,让 `[4c]` 裸 `DbSync` 变成「执行 0」;不这么做,下次谁跑裸 sync 都会重放这 120 条。
**判据 = `[4c]` 打印 `执行 0`**;台账行数不变。

## 4. 部署后验收

```cmd
sqlcmd -S localhost -E -h -1 -W -Q "SET NOCOUNT ON; SELECT 'LEDGER=' + CAST(COUNT(*) AS varchar(10)) FROM HSDZ_MES.dbo.yj_schema_log; SELECT 'FIELDS=' + CAST(COUNT(*) AS varchar(10)) FROM HSDZ_MES.dbo.yj_field; SELECT 'BAK=' + CAST(COUNT(*) AS varchar(10)) FROM HSDZ_MES.sys.tables WHERE CHARINDEX('bak', name) > 0"
```

```cmd
set YINJIA_SQL_PASS=Yinjia@2026
cd /d C:\yj-deploy\tools
java -cp lib\mssql-jdbc.jar verify\FourDocAudit.java
```

| # | 判据 | 期望 |
|---|---|---|
| 1 | `LEDGER` | **764**(761 + 3) |
| 2 | `FIELDS` | **4898**(4895 + 3 条报工记录字段;改名不改行数) |
| 3 | `BAK` | **0**(上次清零保持) |
| 4 | `FourDocAudit` | `[PASS]`(四单 70/54/38/165) |
| 5 | 外网首页 chunk | `index-B1itg9k5.js` |
| 6 | 界面:报工记录 | 列表多出「产品编码/产品规格」两列;查询区可按 产品编码/客户编码/产品规格 过滤 |
| 7 | 界面:出货检验单功能 | 菜单/面板名已改为「出货检验单功能」(原「制程检验单」);检验方案弹窗无「不合格应对措施」 |
| 8 | 界面:生产工单/工单排产/快速排产 | 「余量」列已隐藏 |
| 9 | 界面:内部样品申请单 | 数据记录表:行级归属(只看/改自己行)、纸面 20 行分页、保存后锁定 |

## 5. 回滚

- 只回滚 jar:`copy /y C:\yinjia\backup\app-<TS>.jar C:\yinjia\app.jar` + `schtasks /run /tn YINJIA-MES`。
- 回滚库:需 RDP 用 `sqlcmd -E`(服务器 `yinjia` 非 sysadmin):
  `RESTORE DATABASE [HSDZ_MES] FROM DISK = N'C:\yinjia\backup\pre-deploy-<TS>.bak' WITH REPLACE`。
- 库回滚后 `yj_schema_log` 随之回退,否则下次 sync 会以为脚本已应用。

## 6. 部署完记账

`deploy/部署台账.md` 追加 **第 25 行** + 一节:三指纹(新 jar `bd574fd3…` / 入口 `index-B1itg9k5.js` /
`yj_schema_log` 764)、迁移 3 条、**120 条字节漂移走 baseline 未执行**、界面九项验收证据、
回滚点(`backup\pre-deploy-<TS>.bak` + `app-<TS>.jar`)。

> ⚠ 台账现有 **两行都编号 23**(11-06 23:45 的 pkg-incr-20261106 与 11-07 00:54 的 deploy_src),
> 记账时请把本行编为 25 并在备注里点一句,避免后续倒推错位。
