-- migrate-report-dialog-fields.sql — 报表查询弹窗字段调整
-- ① 删 开始日期/结束日期 两个查询字段(弹窗改为单个「单据日期」区间控件,前端内置,不走 yj_field)
-- ② 库存台账 仓库/存货 设必填(单一仓库+单一存货;对话框红星+校验)
SET NOCOUNT ON;

DELETE FROM yj_field WHERE panel_code IN ('STOCK_SUMMARY','STOCK_LEDGER') AND col_name IN (N'开始日期', N'结束日期');

UPDATE yj_field SET required = 1 WHERE panel_code='STOCK_LEDGER' AND col_name IN (N'仓库', N'存货');
UPDATE yj_field SET required = 0 WHERE panel_code='STOCK_SUMMARY' AND col_name IN (N'仓库', N'存货');

SELECT panel_code, col_name, data_type, ref_panel, required, place FROM yj_field
WHERE panel_code IN ('STOCK_SUMMARY','STOCK_LEDGER') AND place LIKE N'%query%' ORDER BY panel_code, seq;
PRINT N'报表弹窗字段调整完成';
