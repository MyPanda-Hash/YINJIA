# 增量部署包 pkg-incr-20260930(换 app.jar + 执行 22 条增量迁移,不动服务器业务数据)

> 解压到 **C:\yj-deploy**(ASCII 目录,别解压到 C:\yinjia 安装目录本身;旧包内容先清走)。
> 服务器:**管理员 cmd** 执行;长命令一律剪贴板粘贴(RDP 中文输入法会吃手敲的字母)。
> 本包对应仓库 dc7c337a(origin/main 当前 tip),jar 内嵌前端 index-ey868SYv。

## 与 09-28 v2 包的关系

v2 包已于 2026-09-28 在服务器执行(jar 哈希 index-Dt-Syrsh 实测在跑)。本包 = 其后全部累积:
**v2 manifest 324 → 当前 346 的精确差集,共 22 条,零旧脚本字节重跑**。
含 09-29 深夜合并的 10 条(库位仓库编码/领料行号/表定册清理等)+ 09-30 拉取的研发板块 12 条
(测试申请单三页签/受控文件/修改原因/审核人/文件负责人/样品编号表下架等)。

## 内容

| 文件 | 说明 |
|---|---|
| `app.jar`(约 99 MB) | 2026-09-30 构建,SHA256 见包内 `SHA256SUMS.txt`;内嵌最新前端 |
| `deploy-incremental.bat` | 一键脚本:CHECK 只读体检 / GO 全流程(停→备→迁→换→起→验)/ GO APP / GO DB |
| `apply-migrations.bat` | 只跑迁移不动 jar(备用) |
| `verify-package.ps1` | 包完整性校验(按 SHA256SUMS.txt 逐文件复核) |
| `probe-login.ps1` | 登录验收探针(默认 admin/123456,可用 -User -Pass 覆盖) |
| `tools/` | db-migrations.txt 清单(346 条)+ 全部迁移脚本 + DbSync.java + lib\mssql-jdbc.jar |
| `to-run-20260930.txt` | 强制执行清单:22 条(顺序=清单顺序) |
| `SHA256SUMS.txt` | 全包完整性清单 |

## 22 条迁移分组(了解用,GO 会自动按序执行)

| 组 | 脚本 | 说明 |
|---|---|---|
| 基础(10) | whloc-whcode / material-out-line-no / server-parity2 / **server-converge** / panel-runtime-cols / panel-page-size(-archive) / **drop-unused-tables** / spare-columns-biz / norm-debt | 09-29 合并批:对账收敛(服务器补 3 表 17 列)、清 244 张未用表、备用列池等 |
| 研发(12) | spare-desc-fix / rd-test-apply / rd-prodinfo-formlib / rd-specdoc-prodno / filter-eff-formula-cols / drop-sample-no-panel / rd-file-owner / rd-modify-reason / rd-file-controlled / rd-change-kind / rd-newfields-i18n / rd-datarec-reviewer | 09-30 拉取批:测试申请单三页签、受控文件两字段、修改原因、审核人、样品编号表下架等 |

⚠ `migrate-drop-unused-tables` 物理删除 244 张未用表——GO 第 3 步自动先打
pre-deploy 备份(C:\yinjia\backup\pre-deploy-<时间戳>.bak,失败硬停),该备份即回滚点。

## 服务器操作

```cmd
cd /d C:\yj-deploy
deploy-incremental.bat                 :: ① CHECK:只读体检,预期 RESULT: CHECK-OK
sqlcmd -S localhost -d HSDZ_MES -E -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM yj_schema_log"
deploy-incremental.bat GO              :: ② 确认 ① 无误后执行,预期 7 个 RESULT:
:: APP-STOPPED -> BACKUP-GATE-PASSED -> MIGRATIONS-OK -> NEW-JAR-IN-PLACE
:: -> APP-STARTED -> LOGIN-OK -> ALL-OK
```

- GO 自动顺序:**停应用 → 备份库 → 按包内 `to-run-20260930.txt` 强制执行 22 条 → baseline
  刷新旧哈希 → 裸 sync 复核 → 换 jar(旧 jar 自动归档)→ 起应用 → 登录探针**。
- ⚠ GO 期间应用停机约 5~15 分钟,挑没人用的时间窗;任何一步不过即打 `RESULT: FAIL-*` 并停止,
  详细输出在 `logs\deploy-<时间戳>.log`。
- 顺手补(09-27 A5 遗留):登录页「测试库」入口未关——编辑 `C:\yinjia\start.bat`,java 启动参数
  追加 `--yinjia.enable-test-ledger=false`,重启后 `GET /api/base/factory/list` 应只剩 1 条。

## 部署后复核

```cmd
cd /d C:\yj-deploy\tools
java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java
:: 预期: 执行 0, 失败 0(收敛铁证)
sqlcmd -S localhost -d HSDZ_MES -E -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.tables"
:: 预期 215 左右;rd_progress_detail 应含 预计完成日期;yj_doc_status 应含 modify_reason
certutil -hashfile C:\yinjia\app.jar SHA256
```

开发机终验:http://36.140.66.163:8090 登录 → 抽查 测试申请单(三页签)/ 产品文件列表(受控列)/
库位档案(仓库编码+二维码)/ 项目进度;回滚预案见《部署说明.md》§A5。
