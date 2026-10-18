-- _cleanup-dc-probe.sql — 清理 E2E 探针在【正式账套】留下的数采流水/报警/状态日志 2026-10-18
-- 用法(tools 目录): java -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" yinjia env archive\_dc-platform\_cleanup-dc-probe.sql
-- 只针对探针设备 DZ-001(电子秤);采集点/规则/网关由 API 软删,这里清只增不改的流水类表 + 复位设备在线态。
SET NOCOUNT ON;
DECLARE @dev INT = (SELECT id FROM bs_dc_device WHERE code = N'DZ-001');
IF @dev IS NULL BEGIN PRINT N'[SKIP] bs_dc_device 无 DZ-001'; RETURN; END

DELETE FROM bs_dc_sample      WHERE device_id = @dev;
PRINT N'[DEL] bs_dc_sample      rows=' + CAST(@@ROWCOUNT AS nvarchar(20));
DELETE FROM bs_dc_alarm       WHERE device_id = @dev;
PRINT N'[DEL] bs_dc_alarm       rows=' + CAST(@@ROWCOUNT AS nvarchar(20));
DELETE FROM bs_dc_status_log  WHERE device_id = @dev;
PRINT N'[DEL] bs_dc_status_log  rows=' + CAST(@@ROWCOUNT AS nvarchar(20));

UPDATE bs_dc_device SET status = N'offline', last_seen_at = NULL, last_debug_at = NULL WHERE id = @dev;
PRINT N'[UPD] bs_dc_device      rows=' + CAST(@@ROWCOUNT AS nvarchar(20));

-- 自检:探针残留应为 0
SELECT N'sample'      AS tbl, COUNT(1) AS left_rows FROM bs_dc_sample      WHERE device_id = @dev
UNION ALL SELECT N'alarm',      COUNT(1) FROM bs_dc_alarm       WHERE device_id = @dev
UNION ALL SELECT N'status_log', COUNT(1) FROM bs_dc_status_log  WHERE device_id = @dev;
GO