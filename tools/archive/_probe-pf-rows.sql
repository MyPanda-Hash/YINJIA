SET NOCOUNT ON;
SELECT CAST(id AS nvarchar(20)), 部门, ISNULL(变更后内容,N''), ISNULL(签字,N'') FROM rd_change_detail
 WHERE 单据编号 = N'CHG-2026-09-0029' AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY rd_change_detail.id;