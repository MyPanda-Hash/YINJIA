-- r-05:按钮/工具组元数据表 + 附件相关表
SET NOCOUNT ON;
GO
PRINT '=== [1] 含 button / btn / action 的表 ===';
SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%button%' OR TABLE_NAME LIKE '%btn%' OR TABLE_NAME LIKE '%action%'
ORDER BY TABLE_NAME;
GO
PRINT '=== [2] 含 attachment/attach/file/upload 的表 ===';
SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%attach%' OR TABLE_NAME LIKE '%file%' OR TABLE_NAME LIKE '%upload%'
   OR TABLE_NAME LIKE '%share%' OR TABLE_NAME LIKE '%doc%'
ORDER BY TABLE_NAME;
GO
PRINT '=== [3] 含 print/打印 列的表(全库扫描) ===';
SELECT OBJECT_NAME(c.object_id) AS tbl, c.name AS col, t.name AS type
FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.name LIKE N'%打印%' OR c.name LIKE N'%print%'
ORDER BY tbl, col;
GO
PRINT '=== [4] 含 二维码/标签/qrcode 列的表(全库扫描) ===';
SELECT OBJECT_NAME(c.object_id) AS tbl, c.name AS col, t.name AS type
FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.name LIKE N'%二维码%' OR c.name LIKE N'%标签%' OR c.name LIKE N'%qr%'
   OR c.name LIKE N'%条码%' OR c.name LIKE N'%barcode%'
ORDER BY tbl, col;
GO
