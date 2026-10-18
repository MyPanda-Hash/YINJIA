SET NOCOUNT ON;
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bl_transfer') AND name LIKE N'%仓位%';
PRINT '=== 列总数 ===';
SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bl_transfer');
PRINT '=== 字段登记里有仓位吗 ===';
SELECT label, col_name FROM yj_field WHERE panel_code='TRANSFER' AND label LIKE N'%仓位%';
