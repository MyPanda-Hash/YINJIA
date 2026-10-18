SET NOCOUNT ON;
SELECT 'PU_ORDER' 面板, COUNT(*) 单数, MIN(asp_time1) 最早创建, MAX(asp_time1) 最晚创建, MIN([单据日期]) 最早日期, MAX([单据日期]) 最晚日期 FROM bd_pu_order
UNION ALL SELECT 'SO_ORDER', COUNT(*), MIN(asp_time1), MAX(asp_time1), MIN([单据日期]), MAX([单据日期]) FROM bd_so_order;
PRINT '--- 制单人分布 ---';
SELECT 'PU' p, asp_user1, COUNT(*) n FROM bd_pu_order GROUP BY asp_user1
UNION ALL SELECT 'SO', asp_user1, COUNT(*) FROM bd_so_order GROUP BY asp_user1 ORDER BY p, n DESC;
