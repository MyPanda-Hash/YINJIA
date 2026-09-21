SET NOCOUNT ON;
SELECT 单据编号, 表区, ISNULL(物料名称,N'-') AS 物料, ISNULL(序号,N'-') AS 序号 FROM rd_mold_proc_detail
 WHERE 单据编号 LIKE N'MP-2026-09-0129' OR 单据编号 IN (SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'T-PFU-%')
 ORDER BY 单据编号, id;
GO
SELECT 单据编号, ISNULL(产品编号,N'-') AS 产品, ISNULL(asp_user1,'-') AS 制单 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'T-PFU-%';
GO
