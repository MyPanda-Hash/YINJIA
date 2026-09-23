SET NOCOUNT ON;
PRINT N'=== 1. 四级 全部译名(任意 scope/table) ===';
SELECT scope, ref_key, locale, text, source FROM (SELECT scope, ref_key, locale, text, source FROM yj_translation WHERE ref_key LIKE N'%四级%') x;
GO
PRINT N'=== 2. panel scope 译名: 每面板语言数(研发 vs 其它模块) ===';
SELECT p.module_group, AVG(CAST(x.n AS FLOAT)) AS avg_locales, MIN(x.n) AS min_n, MAX(x.n) AS max_n, COUNT(*) AS panels
FROM yj_panel p
LEFT JOIN (SELECT ref_key, COUNT(DISTINCT locale) AS n FROM yj_translation WHERE scope='panel' GROUP BY ref_key) x ON x.ref_key=p.panel_name
GROUP BY p.module_group;
GO
PRINT N'=== 3. field scope 译名语言数分布(研发面板标签) ===';
SELECT f.label, x.n AS locales FROM (SELECT DISTINCT label FROM yj_field WHERE panel_code LIKE 'RD[_]%') f
LEFT JOIN (SELECT ref_key, COUNT(DISTINCT locale) AS n FROM yj_translation WHERE scope='field' GROUP BY ref_key) x ON x.ref_key=f.label
WHERE x.n IS NULL OR x.n<2 ORDER BY x.n, f.label;
GO
PRINT N'=== 4. 字典值译名覆盖: 项目定级/项目层级 选项 ===';
SELECT v AS 选项, (SELECT COUNT(DISTINCT locale) FROM yj_translation t WHERE t.scope='field' AND t.ref_key=v) AS field_locales,
       (SELECT COUNT(DISTINCT locale) FROM yj_translation t WHERE t.scope='ui' AND t.ref_key=v) AS ui_locales
FROM (VALUES (N'一二级'),(N'二级'),(N'三级'),(N'四级')) AS t(v);
