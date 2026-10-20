SELECT h.供应商, COUNT(*) AS 单据数 FROM qc_return h GROUP BY h.供应商 ORDER BY 单据数 DESC;
GO
SELECT TOP 15 dm, mc FROM dm_gf WHERE dm LIKE N'GYS%' OR mc LIKE N'%验证%' ORDER BY dm;
GO
SELECT COUNT(*) AS dm_gf_行数 FROM dm_gf;
GO
SELECT TOP 10 单据编号, 仓库, 批次号, 供应商, 单据状态 FROM qc_return ORDER BY 单据编号 DESC;
GO
SELECT d.计量单位, COUNT(*) FROM qc_return_detail d GROUP BY d.计量单位;
GO
