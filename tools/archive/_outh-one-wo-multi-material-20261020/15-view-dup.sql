SET NOCOUNT ON;
SELECT TOP 10 src, rid, COUNT(*) AS 行数, MIN(存货编码) AS 物料1, MAX(存货编码) AS 物料2, MIN(批号) AS 批号1, MAX(批号) AS 批号2
  FROM dbo.v_stock_movement GROUP BY src, rid HAVING COUNT(*) > 1 ORDER BY 行数 DESC;
SELECT N'--- v_stock_movement 是否带作废行 ---' AS x;
SELECT COUNT(*) AS 作废行数 FROM dbo.v_stock_movement WHERE asp_cancel = 'Y';
SELECT N'--- 该单在视图里的行 ---' AS x;
SELECT src, rid, 存货编码, 批号, 收入数量, 发出数量 FROM dbo.v_stock_movement WHERE src = 6 AND rid BETWEEN 9 AND 14;
