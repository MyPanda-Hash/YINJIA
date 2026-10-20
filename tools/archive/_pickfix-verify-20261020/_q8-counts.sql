SET NOCOUNT ON;
SELECT 'bd_material_out(材料出库单头)' AS 对象, COUNT(*) AS 行数 FROM dbo.bd_material_out
UNION ALL SELECT 'bl_material_out(材料出库单行)', COUNT(*) FROM dbo.bl_material_out
UNION ALL SELECT 'kucun', COUNT(*) FROM dbo.kucun
UNION ALL SELECT 'v_stock_balance(库存状况表)', COUNT(*) FROM dbo.v_stock_balance
UNION ALL SELECT 'v_stock_kucun(库存明细)', COUNT(*) FROM dbo.v_stock_kucun
UNION ALL SELECT 'v_stock_ledger(库存台账)', COUNT(*) FROM dbo.v_stock_ledger
UNION ALL SELECT 'v_stock_pick(库存选货)', COUNT(*) FROM dbo.v_stock_pick
UNION ALL SELECT 'v_stock_movement', COUNT(*) FROM dbo.v_stock_movement
UNION ALL SELECT 'outh', COUNT(*) FROM dbo.outh
UNION ALL SELECT 'inh', COUNT(*) FROM dbo.inh
UNION ALL SELECT 'bl_manu_order', COUNT(*) FROM dbo.bl_manu_order;
