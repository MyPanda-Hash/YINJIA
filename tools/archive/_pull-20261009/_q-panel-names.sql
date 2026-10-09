SET NOCOUNT ON;
PRINT N'库 = ' + DB_NAME();
PRINT N'-- 四单 yj_panel 现状';
SELECT panel_code, panel_name, ISNULL(panel_name_en, N'(NULL)') AS panel_name_en, module_group
  FROM yj_panel WHERE panel_code IN (N'QC_RECV', N'QC_INSP', N'QC_RETURN', N'PURCHASE_IN')
 ORDER BY panel_code;
PRINT N'-- 四单面板名译名(yj_translation scope=panel)';
SELECT ref_key, locale, text, source FROM yj_translation
 WHERE scope = 'panel' AND ref_key IN (N'送料暂收单', N'来料检验单', N'暂收退回单', N'暂收退料单', N'采购入库单')
 ORDER BY ref_key, locale;
PRINT N'-- 全库 panel_name_en 非空的面板数(看是不是普遍为空)';
SELECT COUNT(*) AS 面板总数, SUM(CASE WHEN ISNULL(panel_name_en, N'') <> N'' THEN 1 ELSE 0 END) AS 有英译名
  FROM yj_panel;
