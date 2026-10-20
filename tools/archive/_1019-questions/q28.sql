SELECT ref_key, locale, text FROM yj_translation WHERE scope='field' AND ref_key LIKE N'附件%' ORDER BY ref_key
GO
SELECT COUNT(DISTINCT f.label) AS 缺en标签数 FROM yj_field f
WHERE ISNULL(f.visible,1)=1
  AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=f.label AND t.locale='en')
GO
SELECT f.panel_code, f.label FROM yj_field f WHERE f.panel_code='QC_TC_IN' AND f.label LIKE N'附件%'
