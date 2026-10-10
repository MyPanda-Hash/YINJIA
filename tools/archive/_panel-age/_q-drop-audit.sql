SET NOCOUNT ON;
-- _q-drop-audit.sql — 待下架 16 面板的前置审计(只读)
-- 面板：PU_REQ / OTHER_IN(+DETAIL/STATS) / OTHER_OUT(…) / OUTSOURCE_IN(…) / OUTSOURCE_ISSUE(…) / FINISH_IN(…)
IF OBJECT_ID('tempdb..#p') IS NOT NULL DROP TABLE #p;
CREATE TABLE #p (code varchar(40) PRIMARY KEY);
INSERT INTO #p(code) VALUES
 ('PU_REQ'),
 ('OTHER_IN'),('OTHER_IN_DETAIL'),('OTHER_IN_STATS'),
 ('OTHER_OUT'),('OTHER_OUT_DETAIL'),('OTHER_OUT_STATS'),
 ('OUTSOURCE_IN'),('OUTSOURCE_IN_DETAIL'),('OUTSOURCE_IN_STATS'),
 ('OUTSOURCE_ISSUE'),('OUTSOURCE_ISSUE_DETAIL'),('OUTSOURCE_ISSUE_STATS'),
 ('FINISH_IN'),('FINISH_IN_DETAIL'),('FINISH_IN_STATS');
GO
-- ① 面板元数据规模(迁移脚本的自检基线)
SELECT p.panel_code, p.panel_name, p.category, p.mode,
       RTRIM(ISNULL(p.head_table,'')) AS head_table, RTRIM(ISNULL(p.line_table,'')) AS line_table,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code) AS 字段行,
       (SELECT COUNT(*) FROM yj_role_panel r WHERE r.panel_code = p.panel_code) AS 授权行,
       (SELECT COUNT(*) FROM yj_doc_status s WHERE s.panel_code = p.panel_code) AS 状态行
FROM yj_panel p JOIN #p x ON x.code = p.panel_code
ORDER BY p.panel_code;
GO
-- ② 物理对象:表/视图是否存在 + 行数
DECLARE @t TABLE (name sysname);
INSERT INTO @t(name) VALUES
 ('bd_pu_req'),('bl_pu_req'),('v_pu_req_detail'),
 ('bd_other_in'),('bl_other_in'),('v_other_in_detail'),('v_other_in_stats'),
 ('bd_other_out'),('bl_other_out'),('v_other_out_detail'),('v_other_out_stats'),
 ('bd_outsource_in'),('bl_outsource_in'),('v_outsource_in_detail'),('v_outsource_in_stats'),
 ('bd_outsource_issue'),('bl_outsource_issue'),('v_outsource_issue_detail'),('v_outsource_issue_stats'),
 ('bd_finish_in'),('bl_finish_in'),('v_finish_in_detail'),('v_finish_in_stats');
CREATE TABLE #r (name sysname, typ nvarchar(60), n int);
DECLARE @nm sysname, @sql nvarchar(300), @n int;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM @t;
OPEN cur; FETCH NEXT FROM cur INTO @nm;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(@nm) IS NULL
    INSERT INTO #r VALUES (@nm, N'(不存在)', NULL);
  ELSE BEGIN
    SET @sql = N'SELECT @x = COUNT(*) FROM ' + QUOTENAME(@nm);
    EXEC sp_executesql @sql, N'@x int OUTPUT', @n OUTPUT;
    INSERT INTO #r VALUES (@nm, (SELECT type_desc FROM sys.objects WHERE object_id = OBJECT_ID(@nm)), @n);
  END
  FETCH NEXT FROM cur INTO @nm;
END
CLOSE cur; DEALLOCATE cur;
GO
SELECT name, typ, n FROM #r ORDER BY name;
GO
-- ③ 待删面板名的译名条数与其它面板是否共用该中文名(共用则不能删译名)
SELECT p.panel_code, p.panel_name,
       (SELECT COUNT(*) FROM yj_translation t WHERE t.scope='panel' AND t.ref_key = p.panel_name) AS 该面板名译名条数,
       (SELECT COUNT(*) FROM yj_panel q WHERE q.panel_name = p.panel_name AND q.panel_code <> p.panel_code) AS 同名其它面板
FROM yj_panel p JOIN #p x ON x.code = p.panel_code ORDER BY p.panel_code;
GO
-- ④ 生单链路里涉及的记录(需要清理/关注)
SELECT source_panel_code, target_panel_code, link_status, COUNT(*) AS n
FROM dbo.form_flow_link
WHERE source_panel_code IN (SELECT code FROM #p) OR target_panel_code IN (SELECT code FROM #p)
GROUP BY source_panel_code, target_panel_code, link_status
ORDER BY source_panel_code, target_panel_code;
GO
-- ⑤ 产成品入库单的那 1 张单(真实数据?要备份)
SELECT TOP 20 * FROM dbo.bd_finish_in;
