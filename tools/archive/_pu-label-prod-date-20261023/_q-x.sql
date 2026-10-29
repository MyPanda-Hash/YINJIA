SELECT TOP 1 单据编号 AS d, 批次号 AS b, CONVERT(varchar(10), 生产日期, 120) AS prod FROM bd_pu_label ORDER BY id DESC;
