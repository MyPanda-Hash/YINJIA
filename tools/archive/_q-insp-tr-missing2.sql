SET NOCOUNT ON;
WITH need AS (
  SELECT l.idx, l.lbl, v.locale FROM (VALUES (1,N'检验编号'),(2,N'执行标准'),(3,N'检验类型'),(4,N'报废数量'),(5,N'损耗'),(6,N'损耗率'),(7,N'条码'),(8,N'成品编号'),(9,N'生产日期')) l(idx,lbl)
  CROSS JOIN (VALUES ('en'),('ja'),('ko'),('de'),('fr'),('es'),('ru'),('th'),('vi'),('zh-TW')) v(locale)
)
SELECT need.idx AS label_seq, need.locale, 'MISSING' AS st FROM need
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=need.lbl AND t.locale=need.locale);
GO
