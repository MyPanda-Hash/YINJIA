SET NOCOUNT ON;
SELECT N'CHG 单据' AS k, CAST(COUNT(*) AS nvarchar(10)) AS n FROM rd_change_head;
GO
SELECT N'探针字样残留' AS k, CAST(COUNT(*) AS nvarchar(10)) AS n FROM rd_change_head WHERE 变更事由 LIKE N'%探针%' OR 产品编号 LIKE N'PROBE%';
GO
