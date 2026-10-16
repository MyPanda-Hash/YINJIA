/* _cleanup-absorb-probe.sql — 清掉吸收验证造的数据(仅测试库;库名守卫) */
SET NOCOUNT ON;
DECLARE @db sysname = DB_NAME();
IF @db NOT LIKE N'%_TEST'
BEGIN
    RAISERROR(N'[ABORT] 只允许在测试库执行,当前库=%s', 16, 1, @db);
    RETURN;
END
DELETE FROM dbo.scjl WHERE gldh = N'GD-TEST-ABSORB-01';
DELETE FROM dbo.wo_process_line WHERE 工单号 = N'GD-TEST-ABSORB-01';
DELETE FROM dbo.wo_transfer_log WHERE pl_no = N'GD-TEST-ABSORB-01';
DELETE FROM dbo.plang_pc WHERE pl_no = N'GD-TEST-ABSORB-01';
DELETE FROM dbo.plang WHERE pl_no = N'GD-TEST-ABSORB-01';
SELECT N'[OK] 探针数据已清理(plang/plang_pc/scjl/wo_process_line/wo_transfer_log)' AS msg;
