SET NOCOUNT ON;
SELECT ref_key, locale, text FROM yj_translation WHERE scope = 'panel' ORDER BY ref_key, locale;
