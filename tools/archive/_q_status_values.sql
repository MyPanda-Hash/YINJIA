SET NOCOUNT ON;
PRINT '── 是否存在「生产中」状态的数据(派生状态里没有这一档) ──';
SELECT 'bd_manu_order' AS t, ISNULL(单据状态,N'(空)') AS 状态, COUNT(*) AS 单数 FROM bd_manu_order GROUP BY 单据状态
UNION ALL SELECT 'bd_pu_order', ISNULL(单据状态,N'(空)'), COUNT(*) FROM bd_pu_order GROUP BY 单据状态
UNION ALL SELECT 'bd_so_order', ISNULL(单据状态,N'(空)'), COUNT(*) FROM bd_so_order GROUP BY 单据状态;
GO
