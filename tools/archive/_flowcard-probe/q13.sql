SET NOCOUNT ON;
SELECT scope, COUNT(*) n FROM yj_translation GROUP BY scope;
PRINT '--- samples for PROD_REPORT actions ---';
SELECT scope, ref_key, locale, text FROM yj_translation WHERE ref_key IN (N'工序报工',N'报工',N'可见',N'查询',N'生产领料',N'生成领料单') ORDER BY ref_key, locale;
PRINT '--- yj_locale ---';
SELECT * FROM yj_locale;
