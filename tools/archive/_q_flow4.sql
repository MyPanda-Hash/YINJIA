SET NOCOUNT ON;
PRINT '=== 成本:出库成本非零 ===';
SELECT COUNT(*) AS outh_rows, SUM(CASE WHEN ISNULL(成本金额,0)<>0 THEN 1 ELSE 0 END) AS cost_nonzero, SUM(CASE WHEN ISNULL(成本单价,0)<>0 THEN 1 ELSE 0 END) AS price_nonzero FROM dbo.outh;
PRINT '=== 成本:库存金额 ===';
SELECT COUNT(*) AS kucun_rows, SUM(CASE WHEN ISNULL(total_je,0)<>0 THEN 1 ELSE 0 END) AS je_nonzero FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y';
PRINT '=== ERP推送留痕 ===';
SELECT COUNT(*) AS erp_push_rows FROM dbo.erp_push_log;
PRINT '=== 混料/装箱质检面板 ===';
SELECT panel_code, panel_name FROM dbo.yj_panel WHERE panel_name LIKE N'%混料%' OR panel_name LIKE N'%装箱%' OR panel_code LIKE N'%MIX%' OR panel_code LIKE N'%PACK%' ORDER BY panel_code;
