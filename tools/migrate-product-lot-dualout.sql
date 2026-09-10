-- migrate-product-lot-dualout.sql — ①工单产品批号+打印产品二维码 ②切炭双出口自动直销入库
-- 依据: 流程图"成型报工→打印产品二维码"(取代流动标识卡) + 切炭双出口(已确认:合格品部分直销入成品仓,其余继续组装)
SET NOCOUNT ON;
BEGIN TRY
  IF COL_LENGTH('wo_order', '产品批号') IS NULL ALTER TABLE wo_order ADD [产品批号] nvarchar(30) NULL;
  IF COL_LENGTH('wo_report', '直销数量') IS NULL ALTER TABLE wo_report ADD [直销数量] decimal(18,4) NULL;
END TRY
BEGIN CATCH
  PRINT '加列跳过(无 DDL 权限)';
END CATCH
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'产品批号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'产品批号', N'产品批号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 105, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT' AND col_name=N'直销数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT', N'直销数量', N'直销数量(切炭)', N'小数', NULL, NULL, NULL, NULL, N'header', 55, 110, 1, 0, 0, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品批号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品批号', 'en', N'Product Lot No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'直销数量(切炭)' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'直销数量(切炭)', 'en', N'Direct-sale Qty (Cutting)', 'manual');
GO
PRINT N'migrate-product-lot-dualout 完成';
GO
