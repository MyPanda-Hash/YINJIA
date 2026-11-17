SET NOCOUNT ON;
PRINT '--- A. 服务器快照里的关键表行数 ---';
SELECT N'mate' AS 表, COUNT(*) AS 行数 FROM mate
UNION ALL SELECT N'bs_asm_bom', COUNT(*) FROM bs_asm_bom
UNION ALL SELECT N'bs_asm_bom_半成品产品数', COUNT(DISTINCT 产品编码) FROM bs_asm_bom WHERE UPPER(ISNULL(产品编码,N'')) LIKE N'%**TB' AND ISNULL(asp_cancel,N'') <> 'Y'
UNION ALL SELECT N'rd_mold_proc_detail', COUNT(*) FROM rd_mold_proc_detail
UNION ALL SELECT N'rd_x_sinter_detail', COUNT(*) FROM rd_x_sinter_detail
UNION ALL SELECT N'wo_mixing_detail', COUNT(*) FROM wo_mixing_detail
UNION ALL SELECT N'mix_record', COUNT(*) FROM mix_record;
PRINT '--- B. mate 前 10 行 ---';
SELECT TOP 10 * FROM mate;
PRINT '--- C. mate 覆盖的产品数 ---';
SELECT COUNT(DISTINCT m_no) AS 产品数 FROM mate WHERE ISNULL(asp_cancel,'N') <> 'Y';
PRINT '--- D. bs_asm_bom 里有自己清单的半成品 ---';
SELECT DISTINCT 产品编码, 产品名称, 单据编号 FROM bs_asm_bom
WHERE UPPER(ISNULL(产品编码,N'')) LIKE N'%**TB' AND ISNULL(asp_cancel,'N') <> 'Y';
