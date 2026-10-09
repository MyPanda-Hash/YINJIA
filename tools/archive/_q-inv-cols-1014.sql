SET NOCOUNT ON;
SELECT N'--- bs_inv 列 ---' AS s;
SELECT c.name AS col FROM sys.columns c WHERE c.object_id = OBJECT_ID('bs_inv') ORDER BY c.column_id;
