SET NOCOUNT ON;
SELECT TOP 5 单据编号, 文档编号, 客户名, 客户编号, 申请立项人, 单据日期 FROM rd_approval WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
GO
SELECT TOP 5 单据编号, 客户名, 申请, 审核, 确认, 单据日期 FROM rd_sample_ext_head WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
GO
