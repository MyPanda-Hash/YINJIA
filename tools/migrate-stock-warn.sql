-- migrate-stock-warn.sql — 库存状况完善:预警数量字段(kucun 列 + STOCK_STATUS 明细字段,现存量之后)
-- 预警口径:yl < ISNULL(NULLIF(预警数量,0), 100) —— 行级预警数量优先,未设回退全局阈值 100
SET NOCOUNT ON;
GO
IF COL_LENGTH('kucun', '预警数量') IS NULL
    ALTER TABLE kucun ADD [预警数量] decimal(18, 4) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'STOCK_STATUS' AND col_name = N'预警数量' AND place LIKE '%detail%')
BEGIN
    UPDATE yj_field SET seq = seq + 1
     WHERE panel_code = 'STOCK_STATUS' AND place LIKE '%detail%' AND seq >= 9;
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden)
    VALUES ('STOCK_STATUS', N'预警数量', N'预警数量', N'小数', 'detail', 9, 100, 1, 0, 0);
END
GO
PRINT N'预警数量字段迁移完成';
GO
