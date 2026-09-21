SET NOCOUNT ON;
SELECT 单据编号, ISNULL(产品编号,N'-') AS p, ISNULL(变更事由,N'-') AS why, ISNULL(asp_user1,N'-') AS u, CONVERT(nvarchar(16), asp_time1, 120) AS t FROM rd_change_head ORDER BY id;
GO
