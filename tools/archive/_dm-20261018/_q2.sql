SET NOCOUNT ON;
PRINT '=== 数据字典 bs_dict ===';
SELECT COUNT(*) AS 行数 FROM bs_dict;
SELECT TOP 3 * FROM bs_dict;
PRINT '=== 字典类别去重 ===';
SELECT 字典类别, COUNT(*) AS n FROM bs_dict GROUP BY 字典类别 ORDER BY n DESC;
PRINT '=== dm_gx 类别 ===';
SELECT COUNT(*) AS 行数 FROM dm_gx;
SELECT DISTINCT lb FROM dm_gx;
