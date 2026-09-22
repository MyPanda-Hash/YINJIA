SET NOCOUNT ON;
SELECT 'A.视图定义长度' AS k, v.name, LEN(CONVERT(nvarchar(max), m.definition)) AS def_len
  FROM sys.views v JOIN sys.sql_modules m ON m.object_id = v.object_id
 WHERE v.name IN ('v_stock_balance','v_stock_movement','v_stock_ledger');
SELECT 'B.v_stock_balance 依赖' AS k, referenced_entity_name FROM sys.sql_expression_dependencies WHERE referencing_id = OBJECT_ID('v_stock_balance');
SELECT 'C.inv_cost_ledger 索引' AS k, i.name, i.type_desc FROM sys.indexes i WHERE i.object_id = OBJECT_ID('inv_cost_ledger');
SELECT 'D.kucun 索引' AS k, i.name, i.type_desc FROM sys.indexes i WHERE i.object_id = OBJECT_ID('kucun');
SELECT 'E.兼容级别' AS k, name, compatibility_level FROM sys.databases WHERE name = DB_NAME();
GO
