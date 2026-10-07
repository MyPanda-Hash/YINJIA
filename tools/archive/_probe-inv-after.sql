SET NOCOUNT ON;
SELECT DB_NAME() AS 库, COUNT(*) AS 总行数,
       SUM(CASE WHEN ISNULL(asp_cancel,'N')<>'Y' THEN 1 ELSE 0 END) AS 存活行数,
       SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 作废行数
FROM dbo.bs_inv;
GO
SELECT TOP 3 id, [存货编码], [存货名称], asp_cancel FROM dbo.bs_inv WHERE id IN (6886,6887,6888);
GO
