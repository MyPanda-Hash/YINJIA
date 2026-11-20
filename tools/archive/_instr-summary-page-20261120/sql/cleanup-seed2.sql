/* 第二轮造数清理(仅测试账套) */
SET NOCOUNT ON;
GO
DECLARE @dbn sysname = DB_NAME();
IF @dbn <> N'HSDZ_MES_TEST'
BEGIN
  RAISERROR(N'[拒绝] 本脚本只允许在测试账套 HSDZ_MES_TEST 执行(当前 %s)', 16, 1, @dbn);
  RETURN;
END
GO
DELETE FROM dbo.qc_insp_commission_detail WHERE [单据编号] IN (N'WT-2026-11-9010', N'WT-2026-11-9011');
DELETE FROM dbo.qc_insp_commission_head   WHERE [单据编号] IN (N'WT-2026-11-9010', N'WT-2026-11-9011');
GO
SELECT 'qc_insp_total' t, COUNT(*) n FROM dbo.qc_insp_commission_head
UNION ALL SELECT 'seed_left', COUNT(*) FROM dbo.qc_insp_commission_head WHERE [单据编号] IN (N'WT-2026-11-9010',N'WT-2026-11-9011');
GO
