-- fix-db-restore-tail.sql — 终态修复收尾:孤儿/过期字段清理 + 补登记两表
SET NOCOUNT ON;
-- 1) SO_ORDER:存货名称品牌列已更名「品牌」——删旧字段,补新字段(如缺)
DELETE FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'存货名称品牌';
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'品牌')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('SO_ORDER', N'品牌', N'品牌', N'文本', N'detail', 10, 140, 1, 0, 0, 1);
-- 2) DISPATCH_STATS:部门列不在终版视图中(过期字段)
DELETE FROM yj_field WHERE panel_code='DISPATCH_STATS' AND col_name=N'部门';
GO
PRINT N'fix-db-restore-tail 完成';
GO
