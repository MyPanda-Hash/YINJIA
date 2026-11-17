SET NOCOUNT ON;
PRINT '--- A. 相关表行数 ---';
SELECT N'rd_asm_proc_head' AS 表, COUNT(*) AS 行数 FROM rd_asm_proc_head
UNION ALL SELECT N'rd_asm_proc_detail', COUNT(*) FROM rd_asm_proc_detail
UNION ALL SELECT N'bs_asm_bom', COUNT(*) FROM bs_asm_bom
UNION ALL SELECT N'mate', COUNT(*) FROM mate;
PRINT '--- B. 面板 -> 表 ---';
SELECT panel_code, panel_name, head_table, line_table FROM yj_panel
WHERE panel_code IN (N'ASM_BOM', N'RD_ASM_PROC', N'WLBOM', N'WO_MIXING_LIST', N'PROD_MOLD') ORDER BY panel_code;
