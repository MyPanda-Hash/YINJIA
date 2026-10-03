# 增量部署包 pkg-incr-20261004(换 app.jar + 执行 27 条增量迁移,不动服务器业务数据)

> 解压到 **C:\yj-deploy**(ASCII 目录,别解压到 C:\yinjia 安装目录本身;若旧包已占用该目录,
> 先把旧内容清走或删掉,避免两套 to-run/manifest 混放)。
> 服务器:**管理员 cmd** 执行;所有命令可整段复制粘贴(RDP 中文输入法会吃手敲的字母)。
> 本包对应仓库 origin/main=15877b2a(2026-10-04),jar 内嵌前端 index-ey868SYv。

## 与 09-28 v2 包的关系

v2 包(324 条 manifest)已于 2026-09-28 在服务器执行。本包 = 其后全部累积 **27 条**(零旧脚本字节重跑):
09-29/30 的表定册、库位/领料、服务器对账收敛、研发板块 12 条、库存三表(inh/outh)重建 5 条。

## 内容

| 文件 | 说明 |
|---|---|
| `app.jar`(约 99.7 MB) | 2026-10-04 构建,SHA256 见包内 `SHA256SUMS.txt`;内嵌最新前端 |
| `deploy-incremental.bat` | 一键脚本:CHECK 只读体检 / GO 全流程(停→备→迁→换→起→验)/ GO APP / GO DB |
| `apply-migrations.bat` | 只跑迁移不动 jar(备用) |
| `verify-package.ps1` | 包完整性校验(按 SHA256SUMS.txt 逐文件复核) |
| `probe-login.ps1` | 登录验收探针(默认 admin/123456,可用 -User -Pass 覆盖) |
| `tools/` | db-migrations.txt 清单(351 条)+ 全部迁移脚本 + DbSync.java + lib\mssql-jdbc.jar |
| `to-run-20261004.txt` | 强制执行清单:27 条(顺序=清单顺序) |
| `SHA256SUMS.txt` | 全包完整性清单 |

## 本次 27 条概览(了解用,GO 会自动按序执行)

- 库位/领料(2):bs_wh_loc 仓库编码列;材料出库单明细行号
- 服务器对账(2):parity2(工单行号入链,服务器本有 no-op);**converge 补齐 3 表 17 列**(对账欠账)
- 表定册(3+6):drop-unused-tables(**物理删 244 张未用表**,GO 第 3 步自动 pre-deploy 备份门禁)、
  spare-columns-biz(45 表备用列池)、norm-debt、panel-runtime-cols、panel-page-size(-archive)
- 研发板块(12):rd-test-apply / prodinfo-formlib / specdoc-prodno / filter-eff-formula-cols /
  drop-sample-no-panel / file-owner / modify-reason / file-controlled / change-kind / newfields-i18n /
  datarec-reviewer / spare-desc-fix
- **库存三表(5):inh/outh 重建为 MES 库存流水表**(入库/出库),老数据备份至 *_bak_20260930,
  期初建账落 INIT 流水、过账同事务写流水、v_stock_movement 改读新表(报表 65s 超时根治)

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
  `to-run-20261004.txt` 强制执行 27 条迁移 → baseline 刷新旧哈希 → 裸 sync 复核 → 换 jar(旧 jar
  自动归档)→ 起应用 → 登录探针**。
- ⚠ GO 期间应用停机约 5~15 分钟,挑没人用的时间窗;任何一步不过即打 `RESULT: FAIL-*` 并停止,
  详细输出在 `logs\deploy-<时间戳>.log`。
- 顺手补(09-27 A5 遗留):登录页「测试库」入口未关——编辑 `C:\yinjia\start.bat`,在 java 启动参数
  后追加 `--yinjia.enable-test-ledger=false`,重启应用后 `GET /api/base/factory/list` 应只剩 1 条。

## 部署后复核

```cmd
cd /d C:\yj-deploy\tools
java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java
:: 预期: 执行 0, 失败 0(收敛铁证)
sqlcmd -S localhost -d HSDZ_MES -E -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.tables"
:: 预期 215 左右(244 张未用表已清);inh/outh 应为新流水表结构,库存台账/报表可用
certutil -hashfile C:\yinjia\app.jar SHA256
```

开发机终验:http://36.140.66.163:8090 登录 → 抽查 库位档案(仓库编码列+二维码)/ 库存台账与出入库
报表(应明显变快)/ 研发各面板;回滚预案见《部署说明.md》§A5(GO 第 3 步的 pre-deploy bak 即回滚点)。
