-- 只读核对:两个来料检验要求表的列数(供《数据库表清单》登记用)
SELECT t.name AS 表, COUNT(*) AS 列数
  FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
 WHERE t.name IN ('qc_insp_req', 'qc_insp_req_series')
 GROUP BY t.name ORDER BY t.name;
SELECT t.name AS 表, COUNT(*) AS 备用列数
  FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
 WHERE t.name IN ('qc_insp_req', 'qc_insp_req_series') AND c.name LIKE N'备用%'
 GROUP BY t.name ORDER BY t.name;
