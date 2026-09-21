SET NOCOUNT ON;
SELECT 部门, ISNULL(变更后内容,N''), ISNULL(签字,N'') FROM rd_change_detail WHERE 单据编号 = N'DEMO-CHG-001' ORDER BY rd_change_detail.id;