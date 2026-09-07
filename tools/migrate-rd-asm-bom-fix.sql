-- migrate-rd-asm-bom-fix.sql — 组装BOM表走查修复:修订记录补「备注」列(源 docx 有,线上缺失)
SET NOCOUNT ON;
GO
BEGIN TRY
IF COL_LENGTH('rd_asm_bom_detail', '备注') IS NULL ALTER TABLE rd_asm_bom_detail ADD [备注] nvarchar(200) NULL;
END TRY
BEGIN CATCH
  PRINT 'rd_asm_bom_detail 加列跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_BOM' AND col_name=N'备注' AND place=N'detail') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_ASM_BOM', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 55, 120, 1, 0, 0, 1);
GO
PRINT N'组装BOM表走查修复完成';
GO
