# 增量部署包 pkg-incr-20260928(换 app.jar + 执行 84 条增量迁移,不动服务器业务数据)

> 解压到 **C:\yj-deploy**(ASCII 目录,别解压到 C:\yinjia 安装目录本身)。
> 服务器:**管理员 cmd** 执行;所有命令可整段复制粘贴(RDP 中文输入法会吃手敲的字母)。

## 内容

| 文件 | 说明 |
|---|---|
| `app.jar`(108.4 MB) | 2026-09-28 构建,SHA256 见包内 `SHA256SUMS.txt` 与交付说明;内嵌最新前端 |
| `deploy-incremental.bat` | 一键脚本:CHECK 只读体检 / GO 全流程(停→备→迁→换→起→验)/ GO APP / GO DB |
| `apply-migrations.bat` | 只跑迁移不动 jar(备用) |
| `verify-package.ps1` | 包完整性校验(按 SHA256SUMS.txt 逐文件复核) |
| `probe-login.ps1` | 登录验收探针(默认 admin/123456,可用 -User -Pass 覆盖) |
| `tools/` | db-migrations.txt 清单(310 条)+ 全部迁移脚本 + DbSync.java + JDBC 驱动 |
| `SHA256SUMS.txt` | 全包完整性清单 |

## 服务器操作

```cmd
cd /d C:\yj-deploy
deploy-incremental.bat                 :: ① CHECK:只读体检,预期 RESULT: CHECK-OK
deploy-incremental.bat GO              :: ② 确认 ① 无误后执行,预期 7 个 RESULT:
:: APP-STOPPED -> BACKUP-GATE-PASSED -> MIGRATIONS-OK -> NEW-JAR-IN-PLACE
:: -> APP-STARTED -> LOGIN-OK -> ALL-OK
```

- GO 自动顺序:**停应用 → 备份库(C:\yinjia\backup\pre-deploy-<时间戳>.bak,失败硬停)→ DbSync 跑增量迁移(预期执行 84、重跑 ≤1)→ 换 jar(旧 jar 自动归档)→ 起应用 → 登录探针**。
- GO 期间应用停机约 5~15 分钟,挑没人用的时间窗。
- 任何一步不过就打 `RESULT: FAIL-*` 并停止;详细输出在 `logs\deploy-<时间戳>.log`。

## 部署后复核

```cmd
cd /d C:\yj-deploy\tools
java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java
:: 预期第二遍: 执行 0,失败 0(收敛铁证)

certutil -hashfile C:\yinjia\app.jar SHA256
:: 预期 = 交付说明里登记的新 jar hash
```

浏览器登录 http://36.140.66.163:8090(或 localhost:8090)抽查:排产看板、生产工单、报工页面;
重点确认服务器上已录入的业务数据完整、显示正常。

## 回滚(都在服务器本地)

```cmd
:: 只回代码:
schtasks /end /tn YINJIA-MES
taskkill /f /im java.exe
copy /y C:\yinjia\backup\app-<部署时时间戳>.jar C:\yinjia\app.jar
schtasks /run /tn YINJIA-MES

:: 连库回滚(先停应用):
sqlcmd -S localhost -E -Q "ALTER DATABASE [HSDZ_MES] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE [HSDZ_MES] FROM DISK = N'C:\yinjia\backup\pre-deploy-<部署时时间戳>.bak' WITH RECOVERY, REPLACE; ALTER DATABASE [HSDZ_MES] SET MULTI_USER;"
schtasks /run /tn YINJIA-MES
```
