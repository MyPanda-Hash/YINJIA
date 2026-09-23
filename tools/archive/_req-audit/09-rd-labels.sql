SET NOCOUNT ON;
SELECT compatibility_level, name FROM sys.databases WHERE name = DB_NAME();
GO
PRINT '=== RD_PROD_INFO 产品信息表 ===';
SELECT TOP 30 label, data_type, dict_sql FROM yj_field WHERE panel_code='RD_PROD_INFO' ORDER BY seq, id;
GO
PRINT '=== RD_SPEC_DOC 规格书 ===';
SELECT TOP 40 label, data_type, dict_sql FROM yj_field WHERE panel_code='RD_SPEC_DOC' ORDER BY seq, id;
GO
PRINT '=== RD_ASM_PROC 组装工艺清单 ===';
SELECT TOP 30 label, data_type, dict_sql FROM yj_field WHERE panel_code='RD_ASM_PROC' ORDER BY seq, id;
GO
PRINT '=== RD_INSP_PLAN 出货检验计划表 ===';
SELECT TOP 30 label, data_type, dict_sql FROM yj_field WHERE panel_code='RD_INSP_PLAN' ORDER BY seq, id;
GO
PRINT '=== RD_ASM_BOM 组装BOM表 ===';
SELECT TOP 25 label, data_type, dict_sql FROM yj_field WHERE panel_code='RD_ASM_BOM' ORDER BY seq, id;
GO
PRINT '=== RD_APPROVAL 立项申请 ===';
SELECT TOP 20 label, data_type, dict_sql FROM yj_field WHERE panel_code='RD_APPROVAL' ORDER BY seq, id;
