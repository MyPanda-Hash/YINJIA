SET NOCOUNT ON;
SELECT TOP 5 * FROM dbo.inv_cost_ledger WHERE src = 6 AND rid IN (9,10,11);
SELECT N'--- 视图定义前 40 行 ---' AS x;
