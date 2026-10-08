# 增量部署包 pkg-incr-20261008(换 app.jar + 执行 11 条强制迁移,不动服务器业务数据)

> 解压到 **C:\yj-deploy**(先清走旧包内容,避免两套 to-run/manifest 混放)。
> 服务器:**管理员 cmd** 执行;所有命令可整段复制粘贴(RDP 中文输入法会吃手敲的字母)。
> 本包 jar 取自源码状态 `0080ba31`(合并后的 HEAD;其后只有 tools/ 下的脚本修复与文档改动,
> 不含 Java/前端变更 ⇒ 不影响 jar);jar 内嵌前端 `index-CtZ3s6Hm`,manifest **429 条**。

## 与前一个包(10-07,419 条)的关系

10-07 包已上线并验收 ALL-OK(7 个 RESULT 全绿、执行 0/失败 0)。本包 = 其后全部累积 **11 条**,
**零旧脚本字节重跑** —— 已逐条按 DbSync 同一哈希口径(原始字节 SHA-256)核验:429 条里 428 条与台账一致,
唯一一条 `migrate-fourdoc-baseline-restore`(执行后字节又有改动)重跑实测为 **0 行空操作**,包内版本已收敛。

退场 1 条:`migrate-inv-inspection-default-no.sql` 已移出清单并归档(其目标口径已被表结构本身满足,
留着会在迁移链上失速 —— 详见该脚本头部注释)。服务器侧无需动作。

## 内容

| 文件 | 说明 |
|---|---|
| `app.jar`(约 90.4 MB) | 按 `c7bc4bbc` 由 `mvn clean package -DskipTests` 完整构建(A7 教训#2:结构级变更禁用热补丁 jar);SHA256 见包内 `SHA256SUMS.txt` |
| `deploy-incremental.bat` | 一键脚本:CHECK 只读体检 / GO 全流程(停→备→迁→换→起→验)/ GO APP / GO DB |
| `apply-migrations.bat` | 只跑迁移不动 jar(备用) |
| `verify-package.ps1` | 包完整性校验(按 SHA256SUMS.txt 逐文件复核) |
| `probe-login.ps1` | 登录验收探针(默认 admin/123456,可用 -User -Pass 覆盖) |
| `tools/` | db-migrations.txt 清单(429 条)+ **仅清单内**迁移脚本(429)+ DbSync.java + lib\mssql-jdbc.jar |
| `tools/verify/` | **本次新增入包**:`FourDocAudit.java`(四单字段漂移回归闸)+ `DbNormAudit.java`(数据库规范 13 项体检),配套数据 `fourdoc-baseline.tsv` / `db-legacy-whitelist.txt` / `archive\_dump-out\_head-fields-HSDZ_MES.md` |
| `tools/archive/_registry-audit-20261008/` | 一次性清理脚本(链外,不会被 GO 执行):`_cleanup-stray-whloc-cols-test.sql`。仅用于「重试后复查发现 bs_wh_loc 列数 40」这一种情况的补救,见文末「已知事项」 |
| `to-run-20261008.txt` | 强制执行清单:11 条(顺序=清单顺序,见下) |
| `SHA256SUMS.txt` | 全包完整性清单 |

## 本次 11 条概览

**采购链四单基线回正(3 条,顺序不可换)**

| 序 | 脚本 | 作用 |
|---|---|---|
| 1 | `migrate-fourdoc-bloodline-cols-20261008.sql` | 补回文档登记、本机表已无的 5 个物理列(QC_RETURN 头 退货原因/经手人、明细 单位、PURCHASE_IN 明细 仓位名称/换算率2),纯 NULL 空列 + 列级中文注明 |
| 2 | `migrate-fourdoc-missing-cols-20261008.sql` | 按文档补齐仍缺的 4 列:`qc_return_detail.退货数量`(sp_rename,数据不动,顺带修「退货回冲」静默失效)、`qc_return_detail.批号`、`bd_purchase_in.审核时间2/审核人2` |
| 3 | `migrate-fourdoc-baseline-restore-20261008.sql` | 把四单 `yj_field` 逐字段回正到 2026-10-03 基线 dump(329 行);幂等:差异 0 的面板跳过,有差异则整面板重建 + 复核,非 0 回滚 |

> ⚠ **1/2 必须跑在 3 之前**:回正脚本会为基线档登记、而物理列尚不存在的字段插 `yj_field` 行,
> 先补列再回正才不会留下「字段指向不存在的列」的中间态(面板打开即 Invalid column name)。
> 本包 to-run 顺序已按此排列 —— 这也是本轮修正的一处登记缺陷(原清单把回正脚本排在前),
> 勿手改顺序。

**仓位体系(8 条,顺序不可换)**

| 序 | 脚本 | 作用 |
|---|---|---|
| 4 | `migrate-whloc-rename-bin-20261008.sql` | 「库位」→「仓位」术语统一(物理列 3 + 面板名 + 字段 3 + 译名 36 + 注明 3),对齐金蝶 sp_id/sp_name/sp_number |
| 5 | `migrate-whloc-area-a-raw-20261008.sql` | 原材料区(A仓)落地:新建仓库 `CK-A` + 加 5 个层次列 + 156 个仓位 |
| 6 | `migrate-whloc-clean-coord-20261008.sql` | 坐标列与用途分区解耦(`库区`→`存储分区`,加 `区码`),从编码原文重算层次列,软删试录垃圾行 |
| 7 | `migrate-whloc-rest-20261008.sql` | 剩余仓位 523 个(成品B仓 180 挂现有 `CP-02` / 成品C仓 72 / 辅料及配件区A仓 103 / 新厂区成品D仓 168) |
| 8 | `migrate-whloc-zone-logic-20261008.sql` | 层次重构:`bs_wh` 加 **厂区** 并把四仓正名 **A仓 / CP-02→B仓 / C仓 / D仓**;`bs_wh_loc` 加 **大区** 并移除 `厂区`(厂区归仓库表) |
| 9 | `migrate-whloc-newplant-20261008.sql` | 新厂区 D仓 原料区/辅料及配件区 622 个(该批随后被第 10 条撤销,此处保留链上原样) |
| 10 | `migrate-whloc-newplant-drop-20261008.sql` | **撤销第 9 条那批 622 个**(编码规则应为三段式 `<区>-<排>-<位>`);D仓 成品 168 个不动 |
| 11 | `migrate-whloc-zonepick-20261008.sql` | `大区`/`存储分区` 两字段 `data_type` 改为**分区选择**(候选由仓位数据派生,不落任何存储) |

> 结果态:仓位 **679** 个(A仓 原料区 156 + 辅料及配件区 103 / B仓 180 / C仓 72 / D仓 成品仓区 168)。

## ⚠ 部署日特别动作(仓位体系批会改「仓库档案」,先看一眼服务器)

第 4~8 条不只是加数据,还会**改仓库档案**:新建 `CK-A`/`CK-C`/`CK-D`、把现有 `CP-02` 的**名称**改成「B仓」、
把 `CK-A2` 并入 `CK-A` 后**停用**。这些脚本都是幂等的按编码守卫,但**假定服务器 `bs_wh` 的形态与开发机一致**。

```cmd
:: 先看服务器现有的仓库档案(只读)
sqlcmd -S localhost -d HSDZ_MES -E -W -Q "SET NOCOUNT ON; SELECT 仓库编码, 仓库名称 FROM bs_wh ORDER BY 仓库编码"
```

- 若与开发机同源(有 `CP-02` 成品仓、无自建 A/B/C/D 仓)→ 直接 `GO`,与本地演练一致。
- 若服务器上已被改过(仓库名称/编码不同源)→ **别整包 GO**:先只跑前 3 条四单
  (`apply-migrations.bat` 只认包内 to-run 清单;可把它临时裁到前 3 行再跑),仓位批另行评估。
- 另:本次**不含**任何库存数量/单据业务数据的改动(仓位是档案数据),库存三表口径不变。

## 服务器操作

```cmd
cd /d C:\yj-deploy
deploy-incremental.bat                 :: ① CHECK:只读体检,预期 RESULT: CHECK-OK
sqlcmd -S localhost -d HSDZ_MES -E -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM yj_schema_log"
deploy-incremental.bat GO              :: ② 确认 ① 无误后执行,预期 7 个 RESULT:
:: APP-STOPPED -> BACKUP-GATE-PASSED -> MIGRATIONS-OK -> NEW-JAR-IN-PLACE
:: -> APP-STARTED -> LOGIN-OK -> ALL-OK
```

- GO 自动顺序:**停应用 → 备份库(C:\yinjia\backup\pre-deploy-<时间戳>.bak,失败硬停)→ 按包内
  `to-run-20261008.txt` 强制执行 11 条 → baseline 刷新旧哈希 → 裸 sync 复核 → 换 jar(旧 jar
  自动归档)→ 起应用 → 登录探针**。
- ⚠ GO 期间应用停机约 1~3 分钟(本包 11 条都是档案/元数据改动,数据量小);挑没人用的时间窗。
- 任何一步不过即打 `RESULT: FAIL-*` 并停止,详细输出在 `logs\deploy-<时间戳>.log`。

## 部署后复核

```cmd
cd /d C:\yj-deploy\tools
java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java
:: 预期: 执行 0, 失败 0, 跳过 429(收敛铁证)

java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar verify\FourDocAudit.java HSDZ_MES
:: 预期: [PASS] 四单 yj_field 与基线一致
::   QC_RECV 70 / QC_INSP 54 / QC_RETURN 34 / PURCHASE_IN 171,四项差异全 0;越界污染 0;
::   末行另有物理列对账(文档认定列缺失 0;库内多出若干列属 rebuild 血统、未登记即不显示,不判 FAIL)

java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar verify\DbNormAudit.java
:: 需先设口令: set YINJIA_SQL_PASS=<口令>
:: 预期: FAIL 3 / WARN 1(三项均为存量债,详见文末「已知事项」,**非本次引入**,不必当成本包问题)

sqlcmd -S localhost -d HSDZ_MES -E -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM bs_wh_loc WHERE ISNULL(asp_cancel,'')<>'Y'"
:: 预期 679(仓位体系批的结果态)

sqlcmd -S localhost -d HSDZ_MES -E -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.tables"
:: 预期 225 左右(与开发机一致)

certutil -hashfile C:\yinjia\app.jar SHA256
:: 应等于包内 SHA256SUMS.txt 里 app.jar 的那一行
```

开发机终验:http://36.140.66.163:8090 登录 → 抽查 **仓位档案**(679 条、列含 大区/存储分区/区码/排号/位号/层号,
点「大区」「存储分区」单元格应弹出「仓位分区」弹窗)与 **桌面·生产页签的「产能对比」**(日/周/月/年切换,
竖向双柱);四单(送料暂收单/来料检验单/暂收退回单/采购入库单)列头与顺序照旧。

回滚预案:GO 第 3 步的 `pre-deploy-<时间戳>.bak` 即回滚点(库);旧 jar 归档为
`C:\yinjia\backup\app-<时间戳>.jar`,换回后重启即可。

## 本包相对开发机的功能增量(jar 内)

- **产能对比看板**(远端批):桌面·生产页签,日/周/月/年切换 + 按产线竖向双柱(实际 vs 上限),
  后端新端点 `GET /api/dashboard/capacity?period=day|week|month|year`;旧 `capacityToday` 键已移除。
- **加标水配置记录表丢值修复**(远端批):17 个变体列 key 与活库 label 分叉(填了就丢值),已对齐。
- **仓位体系**(本地批):库位→仓位 术语统一、679 个仓位、分区选择弹窗(点格开窗,候选由仓位派生)。
- 其他:退场阻塞迁移链的旧脚本、vite/esbuild 构建修复(开发机侧,不影响服务器)。

## 已知事项(不阻塞,勿误判为本次引入)

- **本包已含一处脚本修复**:`migrate-whloc-rest-20261008.sql` 原本「重跑必炸」(§3 地址公式对
  `存储分区` 不是 NULL 安全;INSERT/报表引用了 zone-logic 之后已被 DROP 的 `厂区`)。
  首次应用不受影响 —— 该缺陷只在重跑路径触发;修好后该脚本可安全重跑(两账套各实测一遍)。
  详见该脚本头部与提交 `db: 修 migrate-whloc-rest 的两处「重跑必炸」…`。
- ⚠ `migrate-whloc-area-a-raw-20261008.sql` 仍不可安全重跑:它的自愈守卫是裸
  `IF COL_LENGTH(旧列) IS NULL THEN ADD`,重跑会把 `库区`(clean-coord 已改名 存储分区)与
  `厂区`(zone-logic 已 DROP)复活成两个**空死列**(实测 38→40 列)。首次应用不受影响;
  根治需改动态 SQL(其数据源是表变量),属独立任务。若 GO 重试后复查发现列数 40,清掉即可:
  ```cmd
  cd /d C:\yj-deploy\tools
  java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run archive\_registry-audit-20261008\_cleanup-stray-whloc-cols-test.sql
  ```
  (包内已带该一次性清理脚本,幂等;它不在清单里,不会被 GO 自动执行。)
- 开发机 `DbNormAudit` 当前 **FAIL-3 / WARN-1**,三项均为**存量债**、与本包无关:
  ① 03 `bd_sale_out` 10 个英文字段无中文注明(出自 10-07 `migrate-server-converge-20261007.sql` 的结构收敛);
  ② 07 `PURCHASE_IN` 6 行完全重复的字段登记(2026-10-03 基线快照自带,`dupkey:` 未登记);
  ③ 09 缺 en 译名 297 处(25 个面板 + 272 个字段标签,全属遗留 HSDZ 面板:日报/点检/投料/造粒/封箱等)。
- 登记层已核查为**零缺漏**(实库 225 表 / 106 视图 ↔ 在册台账 ↔ 表清单 六向一致;清单 429 条 ↔ tools\*.sql 一一对应)。
- 转ERP 凭证(`C:\yinjia\deploy\push\config.json`)与部署包无关(凭证 gitignore 不入包);10-07 已就地改为动态授权口径。
