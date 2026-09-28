SET NOCOUNT ON;
PRINT '===== A) 远端(HEAD)版 qc_catalog_detail:13 列 vs 12 值 =====';
BEGIN TRAN;
BEGIN TRY
    INSERT INTO qc_catalog_detail (单据编号, 检测物料类别, 物料名称, 物料编码, 批次号, 数量, 计量单位,
        检验状态, 是否合格, 检验单号, 检验数据记录单号, asp_user1, asp_time1)
    VALUES (N'ZZ-PROOF', N'cat', N'name', N'code', N'batch', N'1件', N'件', NULL, N'insp', N'rec', N'admin', GETDATE());
    PRINT '  -> 竟然成功(不符合预期)';
END TRY
BEGIN CATCH
    PRINT '  -> 失败:' + ERROR_MESSAGE();
END CATCH
ROLLBACK;
GO
PRINT '===== B) 本地版 qc_catalog_detail:13 列 vs 13 值 =====';
BEGIN TRAN;
BEGIN TRY
    INSERT INTO qc_catalog_detail (单据编号, 检测物料类别, 物料名称, 物料编码, 批次号, 数量, 计量单位,
        检验状态, 是否合格, 检验单号, 检验数据记录单号, asp_user1, asp_time1)
    VALUES (N'ZZ-PROOF', N'cat', N'name', N'code', N'batch', N'1件', N'件', N'ST_DOING', NULL, N'insp', N'rec', N'admin', GETDATE());
    PRINT '  -> 成功(写入正常)';
END TRY
BEGIN CATCH
    PRINT '  -> 失败:' + ERROR_MESSAGE();
END CATCH
ROLLBACK;
GO
PRINT '===== C) 远端(HEAD)版 qc_insp_rec:14 列 vs 13 值 =====';
BEGIN TRAN;
BEGIN TRY
    INSERT INTO qc_insp_rec (单据编号, 单据日期, 物料名称, 物料编码, 物料批次, 检验日期, 来料数量, 计量单位,
        文件编码, 检验依据, 检验人, 表单审核人, asp_user1, asp_time1)
    VALUES (N'ZZ-PROOF', '2026-09-24', N'name', N'code', NULL, '2026-09-24', N'1件', N'件',
        N'REC-DOC', N'BASIS', N'user', N'reviewer', GETDATE());
    PRINT '  -> 竟然成功(不符合预期)';
END TRY
BEGIN CATCH
    PRINT '  -> 失败:' + ERROR_MESSAGE();
END CATCH
ROLLBACK;
GO
PRINT '===== D) 本地版 qc_insp_rec:14 列 vs 14 值 =====';
BEGIN TRAN;
BEGIN TRY
    INSERT INTO qc_insp_rec (单据编号, 单据日期, 物料名称, 物料编码, 物料批次, 检验日期, 来料数量, 计量单位,
        文件编码, 检验依据, 检验人, 表单审核人, asp_user1, asp_time1)
    VALUES (N'ZZ-PROOF', '2026-09-24', N'name', N'code', NULL, '2026-09-24', N'1件', N'件',
        N'REC-DOC', N'BASIS', N'user', N'reviewer', N'admin', GETDATE());
    PRINT '  -> 成功(写入正常)';
END TRY
BEGIN CATCH
    PRINT '  -> 失败:' + ERROR_MESSAGE();
END CATCH
ROLLBACK;
GO
PRINT '===== 事务已回滚,核对无残留 =====';
SELECT COUNT(*) AS 残留行 FROM qc_catalog_detail WHERE 单据编号 = N'ZZ-PROOF';
