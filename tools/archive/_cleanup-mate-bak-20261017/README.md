# 清理 mate_bak_20261013(2026-10-17,一次性)

## 为什么
数据库规范体检 **10 项**(备份/临时表,棘轮基线 0)点名 `mate_bak_20261013`。
它是 `mate`(WLBOM 物料清单)的时点副本,建于 2026-10-13 16:11,**两个账套各 35,578 行**。
不在 AGENTS.md 的保留项里(保留的是 `rd_dev_task_bak_*`,已登记 `table:` 豁免),按规范必须清零。

## 用户授权
2026-10-17 用户口径:「给你权限删掉」—— 之前一轮已在报告里给出路径与命令并说明影响,
本次由 agent 直接执行,两账套都删。

## 执行(2026-10-17 22:18,两账套各一次)
```sql
SET NOCOUNT ON;
IF OBJECT_ID('dbo.mate_bak_20261013','U') IS NULL
    PRINT N'[skip] ' + DB_NAME() + N': mate_bak_20261013 不存在';
ELSE
BEGIN
    DECLARE @rows int = (SELECT SUM(rows) FROM sys.partitions
                          WHERE object_id = OBJECT_ID('dbo.mate_bak_20261013') AND index_id IN (0,1));
    RAISERROR(N'[删除前] %s: mate_bak_20261013 = %d 行', 10, 1, DB_NAME(), @rows);
    DROP TABLE dbo.mate_bak_20261013;
END
```

执行方式(口令走 SQLCMDPASSWORD,不回显):
```powershell
cd C:\INCER\YINJIA-MES\tools
foreach ($db in 'HSDZ_MES','HSDZ_MES_TEST') { sqlcmd -S 127.0.0.1 -U yinjia -d $db -h -1 -W -f 65001 -i <本目录 SQL> }
```

## 结果
| 账套 | 删除前 | 删除后 sys.tables 里 %bak% |
|---|---|---|
| HSDZ_MES | 35,578 行 | 只剩 `rd_dev_task_bak_20261013`(白名单保留) |
| HSDZ_MES_TEST | 35,578 行 | 同上 |

体检复核(两账套一致):**FAIL 0 / WARN 1 → RESULT: PASS**
(WARN 1 = 08 项「同一列多标签 40 处」,已登记 88 组,不阻断。)

## 回退
表已删,无脚本级回退。若日后确需该快照:
- 同源数据仍在 `mate`(WLBOM,现役物料清单);
- 2026-10-13 之后的改动不在该副本里,重建副本请用当次全库备份,不要"猜"。
