SET NOCOUNT ON;
SELECT ISNULL(需会签,N''), ISNULL(会签人,N''), ISNULL(变更文件,N''), ISNULL(产品编号,N'') FROM rd_change_head WHERE 单据编号 = N'DEMO-CHG-001';