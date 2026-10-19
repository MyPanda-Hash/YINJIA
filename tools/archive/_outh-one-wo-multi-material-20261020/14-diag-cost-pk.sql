SET NOCOUNT ON;
SELECT o.id, o.rid, o.单据编号, o.物料编码, o.批号, o.数量, o.asp_cancel AS 作废, o.asp_user1 AS 人
  FROM dbo.outh o WHERE o.src = 6 AND o.rid BETWEEN 7 AND 14 ORDER BY o.rid, o.id;
SELECT N'--- inv_cost_ledger 主键 ---' AS x;
SELECT i.name AS 索引, i.is_primary_key AS 主键,
       STUFF((SELECT ',' + c.name FROM sys.index_columns ic JOIN sys.columns c
                ON c.object_id = ic.object_id AND c.column_id = ic.column_id
               WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
               ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 1, '') AS 键列
  FROM sys.indexes i WHERE i.object_id = OBJECT_ID('dbo.inv_cost_ledger');
SELECT N'--- 该单当前状态 ---' AS x;
SELECT 单据编号, 单据状态 FROM dbo.bd_material_out WHERE 单据编号 = N'SCLL-20261014-00009';
