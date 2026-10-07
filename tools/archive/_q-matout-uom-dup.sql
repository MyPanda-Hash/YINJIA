SET NOCOUNT ON;
SELECT 计量单位名称, COUNT(*) AS 重名行数, MIN(计量单位编码) AS 编码举例 FROM bs_uom WHERE ISNULL(asp_cancel,'N')<>'Y'
GROUP BY 计量单位名称 HAVING COUNT(*) > 1 ORDER BY 重名行数 DESC;
GO
SELECT 计量单位编码, 计量单位名称, 停用, ISNULL(asp_cancel,'N') AS 作废 FROM bs_uom ORDER BY id;
GO
