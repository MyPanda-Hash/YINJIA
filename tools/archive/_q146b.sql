SET NOCOUNT ON;
UPDATE yj_field SET col_group = N'收入' WHERE panel_code='STOCK_LEDGER' AND col_name IN (N'收入数量',N'收入单价',N'收入金额');
UPDATE yj_field SET col_group = N'发出' WHERE panel_code='STOCK_LEDGER' AND col_name IN (N'发出数量',N'发出单价',N'发出金额');
UPDATE yj_field SET col_group = N'结存' WHERE panel_code='STOCK_LEDGER' AND col_name IN (N'结存数量',N'结存平均单价',N'结存金额');
UPDATE yj_field SET col_group = N'期初结存' WHERE panel_code='STOCK_SUMMARY' AND col_name IN (N'期初数量',N'期初平均单价',N'期初金额');
UPDATE yj_field SET col_group = N'本期入库' WHERE panel_code='STOCK_SUMMARY' AND col_name IN (N'本期入库数量',N'入库平均单价',N'本期入库金额');
UPDATE yj_field SET col_group = N'本期出库' WHERE panel_code='STOCK_SUMMARY' AND col_name IN (N'本期出库数量',N'出库平均单价',N'本期出库金额');
UPDATE yj_field SET col_group = N'期末结存' WHERE panel_code='STOCK_SUMMARY' AND col_name IN (N'期末结存数量',N'期末平均单价',N'期末结存金额');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'收入' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'收入', 'en', N'Receipt', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发出' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发出', 'en', N'Issue', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结存' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结存', 'en', N'Balance', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'期初结存' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'期初结存', 'en', N'Opening', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'本期入库' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'本期入库', 'en', N'Period In', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'本期出库' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'本期出库', 'en', N'Period Out', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'期末结存' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'期末结存', 'en', N'Closing', 'manual');
SELECT panel_code, col_group, COUNT(*) AS n FROM yj_field WHERE col_group IS NOT NULL GROUP BY panel_code, col_group ORDER BY panel_code, col_group;
