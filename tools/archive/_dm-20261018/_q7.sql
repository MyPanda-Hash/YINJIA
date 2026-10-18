SET NOCOUNT ON;
SELECT 'PURCHASE_IN' AS 面板, COUNT(*) AS 单数, SUM(CASE WHEN asp_user1=N'金蝶拉取' THEN 1 ELSE 0 END) AS 金蝶 FROM bd_purchase_in
UNION ALL SELECT 'SALE_OUT', COUNT(*), SUM(CASE WHEN asp_user1=N'金蝶拉取' THEN 1 ELSE 0 END) FROM bd_sale_out
UNION ALL SELECT 'MATERIAL_OUT', COUNT(*), SUM(CASE WHEN asp_user1=N'金蝶拉取' THEN 1 ELSE 0 END) FROM bd_material_out
UNION ALL SELECT 'FINISH_IN', COUNT(*), SUM(CASE WHEN asp_user1=N'金蝶拉取' THEN 1 ELSE 0 END) FROM bd_finish_in
UNION ALL SELECT 'OTHER_IN', COUNT(*), SUM(CASE WHEN asp_user1=N'金蝶拉取' THEN 1 ELSE 0 END) FROM bd_other_in
UNION ALL SELECT 'OTHER_OUT', COUNT(*), SUM(CASE WHEN asp_user1=N'金蝶拉取' THEN 1 ELSE 0 END) FROM bd_other_out
UNION ALL SELECT 'PU_ORDER', COUNT(*), SUM(CASE WHEN asp_user1=N'金蝶拉取' THEN 1 ELSE 0 END) FROM bd_pu_order
UNION ALL SELECT 'SO_ORDER', COUNT(*), SUM(CASE WHEN asp_user1=N'金蝶拉取' THEN 1 ELSE 0 END) FROM bd_so_order;
PRINT '--- 制单人分布(入库单) ---';
SELECT TOP 10 asp_user1, COUNT(*) n FROM bd_purchase_in GROUP BY asp_user1 ORDER BY n DESC;
SELECT MIN([单据日期]) 最早, MAX([单据日期]) 最晚 FROM bd_purchase_in WHERE asp_user1=N'金蝶拉取';
