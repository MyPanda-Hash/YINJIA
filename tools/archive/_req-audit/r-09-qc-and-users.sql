-- r-09:特采/退回/暂收字段 + 用户类型(供应商账号)现状
SET NOCOUNT ON;
GO
PRINT '=== [1] QC_TC 特采申请单 字段 ===';
SELECT col_name, label, data_type, place, visible FROM yj_field
WHERE panel_code='QC_TC' ORDER BY place, seq;
GO
PRINT '=== [2] QC_RETURN 暂收退回单 字段 ===';
SELECT col_name, label, data_type, place, visible FROM yj_field
WHERE panel_code='QC_RETURN' ORDER BY place, seq;
GO
PRINT '=== [3] QC_RECV 送料暂收单 字段 ===';
SELECT col_name, label, data_type, place, visible FROM yj_field
WHERE panel_code='QC_RECV' ORDER BY place, seq;
GO
PRINT '=== [4] yj_user 列结构(是否存在用户类型/供应商账号) ===';
SELECT c.column_id, c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('yj_user') ORDER BY c.column_id;
GO
PRINT '=== [5] yj_role 清单 ===';
SELECT * FROM yj_role;
GO
PRINT '=== [6] 全库扫描:列名/表名含 供应商 且与账号权限相关的对象 ===';
SELECT OBJECT_NAME(c.object_id) AS obj, c.name AS col FROM sys.columns c
WHERE c.name LIKE N'%供应商%' AND OBJECT_NAME(c.object_id) LIKE 'yj%'
ORDER BY obj, col;
GO
