SET NOCOUNT ON;
SELECT TOP 3 单据编号, 产品编号, ISNULL(变更来源单号,N'(无)') AS 来源, CONVERT(nvarchar(19),asp_time1,120) AS t FROM rd_mold_proc_head WHERE 产品编号 LIKE N'PROBE-RMT-%' ORDER BY id DESC;
GO
SELECT TOP 5 单据编号, 产品编号, ISNULL(变更事由,N'-') AS 事由, ISNULL(变更文件,N'-') AS 文件 FROM rd_change_head WHERE 产品编号 LIKE N'PROBE-RMT-%' ORDER BY id DESC;
GO
SELECT TOP 3 单据编号, ISNULL(编号,N'-') AS 编号, ISNULL(变更来源单号,N'(无)') AS 来源 FROM rd_spec_doc_head WHERE 编号 LIKE N'PROBE-RMT-%' OR 变更来源单号 IS NOT NULL ORDER BY id DESC;
GO
