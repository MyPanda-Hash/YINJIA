SET NOCOUNT ON;
SELECT 单据编号+N' | 客户名='+ISNULL(客户名,N'∅')+N' | 文档编号='+ISNULL(文档编号,N'∅')+N' | 单据日期='+ISNULL(单据日期,N'∅')+N' | asp_user1='+ISNULL(asp_user1,N'∅')+N' | 创建='+CONVERT(varchar(19),asp_time1,120) AS r FROM rd_approval ORDER BY id;
GO
