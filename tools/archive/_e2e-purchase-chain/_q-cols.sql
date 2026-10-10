SET NOCOUNT ON;
PRINT N'-- bl_purchase_in 全部列';
SELECT c.name AS 列名, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.bl_purchase_in') ORDER BY c.column_id;
PRINT N'-- QC 链明细表列(找仓库列真名)';
SELECT c.name AS 列名 FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.qc_insp_detail') ORDER BY c.column_id;
PRINT N'-- bs_wh 列 + 数据';
SELECT c.name AS 列名 FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bs_wh') ORDER BY c.column_id;
SELECT * FROM bs_wh;
