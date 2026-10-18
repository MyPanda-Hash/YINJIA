SET NOCOUNT ON;
SELECT COUNT(*) 总数, SUM(CASE WHEN asp_user1 IN (N'金蝶拉取',N'jdy-sync') THEN 1 ELSE 0 END) 金蝶, SUM(CASE WHEN asp_user1=N'试运行' THEN 1 ELSE 0 END) 试运行, SUM(CASE WHEN asp_user1=N'migration' THEN 1 ELSE 0 END) 迁移 FROM bd_pu_order;
SELECT COUNT(*) 总数, SUM(CASE WHEN asp_user1 IN (N'金蝶拉取',N'jdy-sync') THEN 1 ELSE 0 END) 金蝶, SUM(CASE WHEN asp_user1=N'试运行' THEN 1 ELSE 0 END) 试运行 FROM bd_so_order;
SELECT COUNT(*) 数 FROM sys.objects WHERE type='U' AND name LIKE 'bc_%';
