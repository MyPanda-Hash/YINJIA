SET NOCOUNT ON;
WITH need AS (
  SELECT l.lbl, v.locale FROM (VALUES (N'检验编号'),(N'执行标准'),(N'检验类型'),(N'报废数量'),(N'损耗'),(N'损耗率'),(N'条码'),(N'成品编号'),(N'生产日期')) l(lbl)
  CROSS JOIN (VALUES ('en'),('ja'),('ko'),('de'),('fr'),('es'),('ru'),('th'),('vi'),('zh-TW')) v(locale)
)
SELECT need.lbl, need.locale, '缺失' AS st FROM need
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=need.lbl AND t.locale=need.locale);
GO
