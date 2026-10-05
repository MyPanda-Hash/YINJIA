SET NOCOUNT ON;
SELECT COUNT(*) AS 依赖行数_v_ledger FROM sys.sql_expression_dependencies WHERE referencing_id = OBJECT_ID('dbo.v_stock_ledger');
GO
SELECT COUNT(*) AS 依赖行数_v_movement FROM sys.sql_expression_dependencies WHERE referencing_id = OBJECT_ID('dbo.v_stock_movement');
GO
SELECT COUNT(*) AS 依赖行数_v_summary FROM sys.sql_expression_dependencies WHERE referencing_id = OBJECT_ID('dbo.v_stock_summary');
GO
SELECT COUNT(*) AS 依赖行数_v_balance FROM sys.sql_expression_dependencies WHERE referencing_id = OBJECT_ID('dbo.v_stock_balance');
GO
