SET NOCOUNT ON;
-- _q-impact.sql — 下架候选(请购单 + 4 类零单据出入库单)的数据库侧影响面(只读)
-- 候选表：bd/bl_pu_req、bd/bl_other_in、bd/bl_other_out、bd/bl_outsource_in、bd/bl_outsource_issue
IF OBJECT_ID('tempdb..#objs') IS NOT NULL DROP TABLE #objs;
CREATE TABLE #objs (name sysname PRIMARY KEY);
INSERT INTO #objs(name) VALUES
 ('bd_pu_req'),('bl_pu_req'),('bd_other_in'),('bl_other_in'),('bd_other_out'),('bl_other_out'),
 ('bd_outsource_in'),('bl_outsource_in'),('bd_outsource_issue'),('bl_outsource_issue'),
 ('v_other_in_detail'),('v_other_in_stats'),('v_other_out_detail'),('v_other_out_stats'),
 ('v_outsource_in_detail'),('v_outsource_in_stats'),('v_outsource_issue_detail'),('v_outsource_issue_stats'),
 ('v_purchase_in_detail'),('v_stock_balance'),('v_stock_summary'),('v_stock_ledger'),('v_stock_movement');

-- ① 谁引用了这些对象(视图/存储过程/函数)
SELECT o.name AS 对象,
       ISNULL(STRING_AGG(CAST(OBJECT_NAME(d.referencing_id) AS nvarchar(400)), N', '), N'(无人引用)') AS 被谁引用
FROM #objs o
LEFT JOIN sys.sql_expression_dependencies d ON d.referenced_id = OBJECT_ID(o.name)
GROUP BY o.name
ORDER BY o.name;
GO
-- ② 哪些面板绑定到这些表(含明细/统计报表)
SELECT p.panel_code, p.panel_name, p.module_group, RTRIM(ISNULL(p.head_table,'')) AS head_table, RTRIM(ISNULL(p.line_table,'')) AS line_table
FROM yj_panel p
WHERE RTRIM(ISNULL(p.head_table,'')) IN (SELECT name FROM #objs) OR RTRIM(ISNULL(p.line_table,'')) IN (SELECT name FROM #objs)
ORDER BY p.module_group, p.panel_code;
GO
-- ③ 单据/状态/授权/字段规模
DECLARE @p TABLE (code varchar(40) PRIMARY KEY);
INSERT INTO @p(code) VALUES ('PU_REQ'),('PU_ORDER'),('OTHER_IN'),('OTHER_IN_DETAIL'),('OTHER_IN_STATS'),
 ('OTHER_OUT'),('OTHER_OUT_DETAIL'),('OTHER_OUT_STATS'),('OUTSOURCE_IN'),('OUTSOURCE_IN_DETAIL'),('OUTSOURCE_IN_STATS'),
 ('OUTSOURCE_ISSUE'),('OUTSOURCE_ISSUE_DETAIL'),('OUTSOURCE_ISSUE_STATS'),
 ('PURCHASE_IN'),('FINISH_IN'),('SALE_OUT'),('MATERIAL_OUT'),('QC_RECV'),('QC_RETURN');
SELECT x.code AS 面板,
       (SELECT COUNT(*) FROM yj_doc_status s WHERE s.panel_code = x.code) AS 状态行,
       (SELECT COUNT(*) FROM yj_role_panel r WHERE r.panel_code = x.code) AS 授权行,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = x.code) AS 字段行,
       (SELECT COUNT(*) FROM yj_translation t WHERE t.scope='panel' AND t.ref_key = (SELECT p.panel_name FROM yj_panel p WHERE p.panel_code = x.code)) AS 面板译名
FROM @p x ORDER BY x.code;
GO
-- ④ 生单链路(form_flow_link)里与这些面板有关的行
IF OBJECT_ID('dbo.form_flow_link') IS NOT NULL
  SELECT * FROM dbo.form_flow_link
   WHERE panel_code IN ('PU_REQ','PU_ORDER','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE','PURCHASE_IN','MATERIAL_OUT','QC_INSP','QC_RECV')
      OR ISNULL(src_panel,'') IN ('PU_REQ','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE','PURCHASE_IN')
   ORDER BY panel_code;
ELSE
  PRINT N'(表单里没有 form_flow_link 表)';
GO
-- ⑤ 哪些视图/过程的定义文本里提到候选表(视图定义级搜索,防止动态 SQL 漏检)
SELECT o.name AS 视图或过程
FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE o.name LIKE 'v[_]%'
  AND (m.definition LIKE N'%bd_other_in%' OR m.definition LIKE N'%bl_other_in%'
    OR m.definition LIKE N'%bd_other_out%' OR m.definition LIKE N'%bl_other_out%'
    OR m.definition LIKE N'%bd_outsource_in%' OR m.definition LIKE N'%bl_outsource_in%'
    OR m.definition LIKE N'%bd_outsource_issue%' OR m.definition LIKE N'%bl_outsource_issue%'
    OR m.definition LIKE N'%pu_req%')
ORDER BY o.name;
