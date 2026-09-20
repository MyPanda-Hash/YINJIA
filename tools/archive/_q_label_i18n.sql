-- _q_label_i18n.sql — 待新增字段标签的译名基线(采购订单号/采购订单行号/行号)
SET NOCOUNT ON;
PRINT '── yj_translation:三标签现有译名 ──';
SELECT ref_key, scope, locale, text FROM yj_translation
WHERE ref_key IN (N'采购订单号', N'采购订单行号', N'行号') ORDER BY ref_key, scope, locale;
GO
PRINT '── 已有 行号 字段的面板(看是否已有该标签约定) ──';
SELECT panel_code, col_name, label, place FROM yj_field WHERE label=N'行号' ORDER BY panel_code;
GO
PRINT '── sl_recv / qc_insp 头行物理列全清单(设计补列位) ──';
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('sl_recv','sl_recv_detail','qc_insp','qc_insp_detail') ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO
