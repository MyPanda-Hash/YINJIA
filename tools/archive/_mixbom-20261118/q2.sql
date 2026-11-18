SELECT c.name, t.name AS typ, c.max_length FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE c.object_id=OBJECT_ID('yj_panel') ORDER BY c.column_id;
SELECT TOP 3 * FROM yj_panel;
SELECT panel_code, COUNT(*) n, MIN(place) FROM yj_field WHERE panel_code IN ('RD_ASM_PROC','RD_MOLD_PROC','RD_X_SINTER') GROUP BY panel_code;
SELECT 状态, COUNT(*) n FROM bs_asm_bom GROUP BY 状态;
SELECT COUNT(*) FROM bs_asm_bom
