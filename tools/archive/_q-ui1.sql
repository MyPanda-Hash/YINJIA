SET NOCOUNT ON;
SELECT 单据编号, 需会签, 会签人, 产品编号, 申请人, 变更文件 FROM rd_change_head WHERE 单据编号 = N'CHG-2026-09-0017';
GO
SELECT 单据编号, 部门, ISNULL(变更后内容,N'') AS c FROM rd_change_detail WHERE 单据编号 = N'CHG-2026-09-0017' ORDER BY id;
GO
