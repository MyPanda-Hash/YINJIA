SET NOCOUNT ON;
PRINT N'== ① v_stock_movement 里 src/rid/单据编号 的产出方式 ==';
SELECT SUBSTRING(m.definition, CHARINDEX(N'races', m.definition)+1, 2600) AS 片段 FROM sys.sql_modules m WHERE m.object_id = OBJECT_ID('dbo.v_stock_movement');
