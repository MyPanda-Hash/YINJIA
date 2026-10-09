SET NOCOUNT ON;
PRINT N'库 = ' + DB_NAME();
DECLARE @codes TABLE (c varchar(40) PRIMARY KEY);
INSERT INTO @codes VALUES ('OTHER_IN_DETAIL'),('OTHER_IN_STATS'),('OTHER_OUT'),('OTHER_OUT_DETAIL'),('OTHER_OUT_STATS'),
 ('OUTSOURCE_IN_DETAIL'),('OUTSOURCE_IN_STATS'),('OUTSOURCE_ISSUE_DETAIL'),('OUTSOURCE_ISSUE_STATS'),('LOT_TRACE');
PRINT N'-- ① yj_field 孤儿行';
SELECT COUNT(*) AS yj_field孤儿 FROM yj_field f JOIN @codes c ON c.c = f.panel_code;
PRINT N'-- ② yj_role_panel 残留';
SELECT COUNT(*) AS yj_role_panel残留 FROM yj_role_panel r JOIN @codes c ON c.c = r.panel_code;
PRINT N'-- ③ yj_translation 里这些面板名的译名(面板名键)';
SELECT ref_key AS 面板名, COUNT(*) AS 译名行数 FROM yj_translation
 WHERE scope = 'panel' AND ref_key IN (N'其他入库单明细表', N'其他入库单统计表', N'其他出库单', N'批号追溯')
 GROUP BY ref_key;
PRINT N'-- ④ 这些码在别的元数据表里还有没有引用';
SELECT N'yj_attachment' AS 表, COUNT(*) AS 行数 FROM yj_attachment WHERE panel_code IN (SELECT c FROM @codes)
UNION ALL SELECT N'yj_panelx_list', COUNT(*) FROM yj_panelx_list WHERE panel_code IN (SELECT c FROM @codes)
UNION ALL SELECT N'yj_doc_status', COUNT(*) FROM yj_doc_status WHERE panel_code IN (SELECT c FROM @codes)
UNION ALL SELECT N'yj_usage_log', COUNT(*) FROM yj_usage_log WHERE panel_code IN (SELECT c FROM @codes);
