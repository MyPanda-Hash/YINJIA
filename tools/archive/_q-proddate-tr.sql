SET NOCOUNT ON;
SELECT scope, ref_key, locale, LEFT(text,30) AS txt, source, DATALENGTH(ref_key) AS ref_bytes, DATALENGTH(locale) AS loc_bytes
  FROM yj_translation WHERE ref_key LIKE N'%生产日期%' OR ref_key LIKE N'%生產日期%';
GO
