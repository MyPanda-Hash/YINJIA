SELECT c.name, t.name typ, c.max_length, c.is_nullable FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE c.object_id=OBJECT_ID('yj_role_panel') ORDER BY c.column_id;
SELECT * FROM yj_role_panel WHERE panel_code='ASM_BOM';
SELECT * FROM yj_role_panel WHERE panel_code='WLBOM';
SELECT role_id, COUNT(*) FROM yj_role_panel GROUP BY role_id;
SELECT c.name, t.name typ, c.max_length FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE c.object_id=OBJECT_ID('bs_asm_bom') AND c.name IN ('单ser','id');
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bs_asm_bom' ORDER BY ORDINAL_POSITION
