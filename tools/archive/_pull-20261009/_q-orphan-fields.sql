SET NOCOUNT ON;
PRINT N'库 = ' + DB_NAME();
PRINT N'-- ① yj_field 里「面板已不存在」的孤儿行(按面板分组)';
SELECT f.panel_code AS 面板, COUNT(*) AS 孤儿字段行,
       CASE WHEN p.panel_code IS NULL THEN N'面板已下架' ELSE N'面板在册' END AS 面板状态
  FROM yj_field f LEFT JOIN yj_panel p ON p.panel_code = f.panel_code
 WHERE p.panel_code IS NULL
 GROUP BY f.panel_code, p.panel_code ORDER BY COUNT(*) DESC;

PRINT N'-- ② 孤儿行 id 分布(与全局 id 区间比,判断是不是新灌回来的)';
SELECT MIN(id) AS 孤儿最小id, MAX(id) AS 孤儿最大id, COUNT(*) AS 行数
  FROM yj_field f WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = f.panel_code);
SELECT MAX(id) AS yj_field最大id, COUNT(*) AS 总行数 FROM yj_field;

PRINT N'-- ③ 本地下架面板清单是否还有 yj_field 残留';
SELECT panel_code AS 面板, COUNT(*) AS 残留字段行 FROM yj_field
 WHERE panel_code IN ('PU_REQ','OTHER_IN_DETAIL','OTHER_OUT_DETAIL','OUTSOURCE_IN_DETAIL','OUTSOURCE_ISSUE_DETAIL',
                      'QC_OP','QC_RECORD','QC_DISPOSAL','ROD_RETURN','LOT_TRACE')
 GROUP BY panel_code ORDER BY panel_code;

PRINT N'-- ④ 这些面板的 yj_panel 行是否还在(应为 0)';
SELECT COUNT(*) AS 下架面板仍在册 FROM yj_panel
 WHERE panel_code IN ('PU_REQ','OTHER_IN_DETAIL','OTHER_OUT_DETAIL','OUTSOURCE_IN_DETAIL','OUTSOURCE_ISSUE_DETAIL',
                      'QC_OP','QC_RECORD','QC_DISPOSAL','ROD_RETURN','LOT_TRACE');
