/* 证据造数清理(仅测试账套 HSDZ_MES_TEST) —— 删掉本轮为取证临时造的行,恢复原状 */
SET NOCOUNT ON;
GO
DECLARE @dbn sysname = DB_NAME();
IF @dbn <> N'HSDZ_MES_TEST'
BEGIN
  RAISERROR(N'[拒绝] 本脚本只允许在测试账套 HSDZ_MES_TEST 执行(当前 %s)', 16, 1, @dbn);
  RETURN;
END
GO
DELETE FROM dbo.rd_instr_use_detail WHERE [单据编号] = N'IU-2026-11-0001';
GO
DELETE FROM dbo.qc_insp_commission_detail WHERE [单据编号] = N'WT-2026-11-9010';
DELETE FROM dbo.qc_insp_commission_head   WHERE [单据编号] = N'WT-2026-11-9010';
GO
SELECT 'rd_instr_use_detail' t, COUNT(*) n FROM dbo.rd_instr_use_detail WHERE [单据编号] = N'IU-2026-11-0001'
UNION ALL SELECT 'qc_insp_9010_head', COUNT(*) FROM dbo.qc_insp_commission_head WHERE [单据编号] = N'WT-2026-11-9010'
UNION ALL SELECT 'qc_insp_9010_detail', COUNT(*) FROM dbo.qc_insp_commission_detail WHERE [单据编号] = N'WT-2026-11-9010'
UNION ALL SELECT 'qc_insp_total', COUNT(*) FROM dbo.qc_insp_commission_head;
GO
