SET NOCOUNT ON;
PRINT N'=== 回滚:撤销上一版过宽清理(把标记为 migration 的软删全部还原) ===';
UPDATE qc_insp_rec SET asp_cancel = 'N', asp_user2 = NULL, asp_time2 = NULL WHERE asp_cancel = 'Y' AND asp_user2 = N'migration';
PRINT N'[回滚] 检验数据记录还原 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
UPDATE qc_insp_rec_detail SET asp_cancel = 'N', asp_user2 = NULL, asp_time2 = NULL WHERE asp_cancel = 'Y' AND asp_user2 = N'migration';
PRINT N'[回滚] 明细行还原 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
UPDATE qc_catalog_detail SET asp_cancel = 'N', asp_user2 = NULL, asp_time2 = NULL WHERE asp_cancel = 'Y' AND asp_user2 = N'migration';
PRINT N'[回滚] 目录行还原 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
SELECT COUNT(*) AS 还原后存活记录 FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y';
