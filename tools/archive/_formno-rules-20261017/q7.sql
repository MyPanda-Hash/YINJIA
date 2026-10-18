SET NOCOUNT ON;
PRINT '== yj_panel 前缀重复 ==';
SELECT ISNULL(prefix,'(null)') AS prefix, COUNT(*) AS panels,
       STRING_AGG(panel_code + N'/' + panel_name, N', ') AS who
FROM yj_panel WHERE ISNULL(prefix,'') <> ''
GROUP BY prefix HAVING COUNT(*) > 1;
PRINT '== s_allno.lb 是否有面板使用 ==';
SELECT a.lb, COUNT(*) AS pool_rows,
       ISNULL((SELECT STRING_AGG(p.panel_code + N'/' + p.panel_name, N', ') FROM yj_panel p WHERE p.prefix = a.lb), N'(无面板使用)') AS panels
FROM s_allno a GROUP BY a.lb ORDER BY a.lb;
