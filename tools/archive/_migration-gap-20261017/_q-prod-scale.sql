SET NOCOUNT ON;
SELECT t.name AS 表名, p.rows AS 正式库行数
FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
WHERE t.name IN ('mate','bd_so_order','bl_so_order','bs_emp','permission','s_sys','qkhl','dm_kh','dm_gf','inh','outh');

SELECT 'mate' AS 表, CASE WHEN OBJECT_ID('dbo.mate') IS NULL THEN '不存在' ELSE '存在' END AS 状态
UNION ALL SELECT 'mate_bak_20261013', CASE WHEN OBJECT_ID('dbo.mate_bak_20261013') IS NULL THEN '不存在' ELSE '存在' END
UNION ALL SELECT 'rd_dev_task', CASE WHEN OBJECT_ID('dbo.rd_dev_task') IS NULL THEN '不存在' ELSE '存在' END
UNION ALL SELECT 'rd_dev_task_bak_20261013', CASE WHEN OBJECT_ID('dbo.rd_dev_task_bak_20261013') IS NULL THEN '不存在' ELSE '存在' END;
