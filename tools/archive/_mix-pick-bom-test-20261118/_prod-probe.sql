SET NOCOUNT ON;
PRINT '--- A. 行数 ---';
SELECT N'rd_mold_proc_head' AS 表, COUNT(*) AS 行数 FROM rd_mold_proc_head
UNION ALL SELECT N'rd_mold_proc_detail', COUNT(*) FROM rd_mold_proc_detail
UNION ALL SELECT N'rd_x_sinter_head', COUNT(*) FROM rd_x_sinter_head
UNION ALL SELECT N'rd_x_sinter_detail', COUNT(*) FROM rd_x_sinter_detail
UNION ALL SELECT N'mate', COUNT(*) FROM mate
UNION ALL SELECT N'bs_asm_bom_半成品', COUNT(DISTINCT 产品编码) FROM bs_asm_bom WHERE UPPER(ISNULL(产品编码,N'')) LIKE N'%**TB' AND ISNULL(asp_cancel,N'') <> 'Y';
PRINT '--- B. rd_mold_proc_head 产品键样例 ---';
SELECT TOP 10 单据编号, 产品编号, 产品名称, 版本号, 工序 FROM rd_mold_proc_head;
PRINT '--- C. rd_mold_proc_detail 样例 ---';
SELECT TOP 10 单据编号, 表区, 序号, 物料种类, 物料编号, 物料名称, 实际添加比例, 单支物料含量, 设计添加量 FROM rd_mold_proc_detail;
PRINT '--- D. rd_x_sinter_head 产品键样例 ---';
SELECT TOP 10 单据编号, 产品编号, 炭棒编号, 产品名称, 版本号 FROM rd_x_sinter_head;
PRINT '--- E. mate 样例 ---';
SELECT TOP 5 * FROM mate;
