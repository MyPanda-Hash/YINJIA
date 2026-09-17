SET NOCOUNT ON;
UPDATE bd_purchase_in SET 是否已转ERP = N'是' WHERE ISNULL(ERP单号,'') <> '' AND ISNULL(是否已转ERP,'') = '';
UPDATE bd_sale_out SET 是否已转ERP = N'是' WHERE ISNULL(ERP单号,'') <> '' AND ISNULL(是否已转ERP,'') = '';
UPDATE bd_purchase_in SET 是否已转ERP = N'否' WHERE ISNULL(是否已转ERP,'') = '';
UPDATE bd_sale_out SET 是否已转ERP = N'否' WHERE ISNULL(是否已转ERP,'') = '';
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'是否已转ERP')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PURCHASE_IN', N'是否已转ERP', N'是否已转ERP', N'文本', N'header', 203, 80, 0, 0, 0, 1);
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'是否已转ERP')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('SALE_OUT', N'是否已转ERP', N'是否已转ERP', N'文本', N'header', 203, 80, 0, 0, 0, 1);
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否已转ERP' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否已转ERP', 'en', 'Pushed to ERP', 'manual');
SELECT 单据编号, 是否已转ERP, ERP单号 FROM bd_purchase_in;
