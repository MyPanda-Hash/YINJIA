SET NOCOUNT ON;
SELECT CONVERT(varchar(10),id)+N' | '+单据编号+N' | 产品整体规格='+ISNULL(产品整体规格,N'∅')+N' | asp_cancel='+ISNULL(asp_cancel,N'∅')+N' | 创建='+CONVERT(varchar(19),asp_time1,120) AS r FROM rd_sample_ext_detail ORDER BY id;
GO
SELECT CONVERT(varchar(10),id)+N' | '+单据编号+N' | 客户名称='+ISNULL(客户名称,N'∅')+N' | asp_cancel='+ISNULL(asp_cancel,N'∅') AS r FROM rd_sample_ext_head ORDER BY id;
GO
