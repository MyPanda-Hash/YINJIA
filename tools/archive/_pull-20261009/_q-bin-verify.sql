SET NOCOUNT ON;
PRINT N'库 = ' + DB_NAME();
PRINT N'-- 采购入库明细「仓位」登记';
SELECT place, seq, label, label_en, col_name, data_type, ref_panel, ref_field, display_field, ref_filter, editable, hidden, visible
  FROM yj_field WHERE panel_code = N'PURCHASE_IN' AND col_name = N'仓位编码' AND place LIKE N'%detail%';
PRINT N'-- WHLOC「是否默认」';
SELECT place, seq, label, data_type, hidden, visible FROM yj_field WHERE panel_code = N'WHLOC' AND col_name = N'是否默认';
PRINT N'-- INV「默认仓位」';
SELECT place, seq, label, label_en, data_type, ref_panel, ref_field, hidden, visible
  FROM yj_field WHERE panel_code = N'INV' AND col_name = N'默认仓位';
PRINT N'-- bs_wh_loc.是否默认 列 + 当前标了几个默认';
SELECT c.name AS 列名, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.bs_wh_loc') AND c.name = N'是否默认';
SELECT COUNT(*) AS 已标默认仓位数 FROM bs_wh_loc WHERE 是否默认 = 1;
PRINT N'-- 四单字段总数(应 329)+ 译名点数';
SELECT COUNT(*) AS 四单字段 FROM yj_field WHERE panel_code IN (N'QC_RECV', N'QC_INSP', N'QC_RETURN', N'PURCHASE_IN');
SELECT ref_key, COUNT(*) AS 语言数 FROM yj_translation WHERE scope='field' AND ref_key IN (N'仓位',N'仓位编码',N'默认仓位',N'是否默认') GROUP BY ref_key;
SELECT ref_key, locale, text FROM yj_translation WHERE scope='field' AND ref_key=N'仓位' AND locale='en';
