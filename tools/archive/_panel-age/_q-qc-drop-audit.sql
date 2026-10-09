SET NOCOUNT ON;
-- _q-qc-drop-audit.sql — 待下架 5 张品质面板的前置审计(只读)
-- QC_OP / QC_RECORD / QC_DISPOSAL / ROD_RETURN / LOT_TRACE
IF OBJECT_ID('tempdb..#p') IS NOT NULL DROP TABLE #p;
CREATE TABLE #p (code varchar(40) PRIMARY KEY);
INSERT INTO #p(code) VALUES ('QC_OP'),('QC_RECORD'),('QC_DISPOSAL'),('ROD_RETURN'),('LOT_TRACE');
GO
-- ① 面板元数据规模(迁移脚本自检基线)
SELECT p.panel_code, p.panel_name, p.category, p.mode,
       RTRIM(ISNULL(p.head_table,'')) AS head_table, RTRIM(ISNULL(p.line_table,'')) AS line_table,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code) AS 字段行,
       (SELECT COUNT(*) FROM yj_role_panel r WHERE r.panel_code = p.panel_code) AS 授权行,
       (SELECT COUNT(*) FROM yj_doc_status s WHERE s.panel_code = p.panel_code) AS 状态行
FROM yj_panel p JOIN #p x ON x.code = p.panel_code ORDER BY p.panel_code;
GO
-- ② 物理对象存在性 + 行数
DECLARE @t TABLE (name sysname);
INSERT INTO @t(name) VALUES ('qc_op'),('qc_op_detail'),('qc_record'),('qc_record_detail'),
 ('qc_disposal'),('rod_return'),('rod_return_detail'),('v_lot_trace');
CREATE TABLE #r (name sysname, typ nvarchar(60), n int);
DECLARE @nm sysname, @sql nvarchar(300), @n int;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM @t;
OPEN cur; FETCH NEXT FROM cur INTO @nm;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(@nm) IS NULL INSERT INTO #r VALUES (@nm, N'(不存在)', NULL);
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
-- ③ 谁引用了这些对象(定义文本级搜索,比 sys.sql_expression_dependencies 可靠)
SELECT o.type_desc AS 类型, o.name AS 对象名
FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE N'%qc_op%' OR m.definition LIKE N'%qc_record%' OR m.definition LIKE N'%qc_disposal%'
   OR m.definition LIKE N'%rod_return%' OR m.definition LIKE N'%v_lot_trace%'
ORDER BY o.type_desc, o.name;
GO
-- ④ 外键
SELECT OBJECT_NAME(fk.parent_object_id) AS 子表, fk.name AS 外键, OBJECT_NAME(fk.referenced_object_id) AS 父表
FROM sys.foreign_keys fk
WHERE OBJECT_NAME(fk.parent_object_id) IN ('qc_op','qc_op_detail','qc_record','qc_record_detail','qc_disposal','rod_return','rod_return_detail')
   OR OBJECT_NAME(fk.referenced_object_id) IN ('qc_op','qc_op_detail','qc_record','qc_record_detail','qc_disposal','rod_return','rod_return_detail');
GO
-- ⑤ 其它引用面:参照字段 / 生单链路 / 附件 / 审批 / 列设置 / 批号表 / 单据状态
SELECT N'字段参照(ref_panel)' AS 项, CAST(COUNT(*) AS varchar(10)) AS n FROM yj_field f JOIN #p x ON x.code = f.ref_panel
UNION ALL SELECT N'生单链路 form_flow_link', CAST(COUNT(*) AS varchar(10)) FROM form_flow_link
        WHERE source_panel_code IN (SELECT code FROM #p) OR target_panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'附件 yj_attachment', CAST(COUNT(*) AS varchar(10)) FROM yj_attachment WHERE panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'审批 yj_form_approval', CAST(COUNT(*) AS varchar(10)) FROM yj_form_approval WHERE panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'列设置 report_column_settings', CAST(COUNT(*) AS varchar(10)) FROM report_column_settings WHERE panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'批号表 yj_doc_batch', CAST(COUNT(*) AS varchar(10)) FROM yj_doc_batch
        WHERE source_panel_code IN (SELECT code FROM #p) OR target_panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'修改日志 yj_doc_modify_log', CAST(COUNT(*) AS varchar(10)) FROM yj_doc_modify_log WHERE panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'归档日志 yj_archive_change_log', CAST(COUNT(*) AS varchar(10)) FROM yj_archive_change_log WHERE panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'使用日志 yj_usage_log(按面板名)', CAST(COUNT(*) AS varchar(10)) FROM yj_usage_log
        WHERE panel_name IN (SELECT panel_name FROM yj_panel WHERE panel_code IN (SELECT code FROM #p));
GO
-- ⑥ 面板名译名与同名面板
SELECT p.panel_code, p.panel_name,
       (SELECT COUNT(*) FROM yj_translation t WHERE t.scope='panel' AND t.ref_key = p.panel_name) AS 译名条数,
       (SELECT COUNT(*) FROM yj_panel q WHERE q.panel_name = p.panel_name AND q.panel_code <> p.panel_code) AS 同名其它面板
FROM yj_panel p JOIN #p x ON x.code = p.panel_code ORDER BY p.panel_code;
