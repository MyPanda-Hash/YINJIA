SET NOCOUNT ON;
-- _q-usage.sql — 「样品管理 / 经典单据」两组菜单 5 张面板的使用度取证(全只读)
-- 面板:SAMPLE_REQ 样品申请单 / DISPATCH 工序派工单 / OUTSOURCE_ORDER 委外加工单
--       DISPATCH_DETAIL 工序派工单明细表 / DISPATCH_STATS 工序派工单统计表
-- 口径同 docs/development/面板老化盘点-品质管理与智能供应链.md §1:元数据行数 + 业务数据行数
--       + 操作留痕(yj_usage_log,只有 panel_name 没有 panel_code) + 授权行数 + 依赖
-- 输出:UTF-8 重定向到 _out-usage-prod.txt(控制台直接看会乱码)

PRINT N'=== 1 面板元数据与授权 ===';
SELECT p.panel_code, p.panel_name, p.category, p.mode, p.line_table, p.head_table, p.module_group,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code) AS fld,
       (SELECT COUNT(*) FROM yj_role_panel rp WHERE rp.panel_code = p.panel_code) AS grant_rows,
       (SELECT COUNT(*) FROM yj_doc_status ds WHERE ds.panel_code = p.panel_code) AS doc_status_rows
FROM yj_panel p
WHERE p.panel_code IN ('SAMPLE_REQ','DISPATCH','OUTSOURCE_ORDER','DISPATCH_DETAIL','DISPATCH_STATS')
ORDER BY p.panel_code;
GO

PRINT N'=== 2 业务表/视图行数 ===';
SELECT N'sample_req'          AS obj, CAST(COUNT(*) AS nvarchar(20)) AS n FROM dbo.sample_req
UNION ALL SELECT N'sample_req_detail',   CAST(COUNT(*) AS nvarchar(20)) FROM dbo.sample_req_detail
UNION ALL SELECT N'bd_dispatch',         CAST(COUNT(*) AS nvarchar(20)) FROM dbo.bd_dispatch
UNION ALL SELECT N'bl_dispatch',         CAST(COUNT(*) AS nvarchar(20)) FROM dbo.bl_dispatch
UNION ALL SELECT N'bd_outsource_order',  CAST(COUNT(*) AS nvarchar(20)) FROM dbo.bd_outsource_order
UNION ALL SELECT N'bl_outsource_order',  CAST(COUNT(*) AS nvarchar(20)) FROM dbo.bl_outsource_order
UNION ALL SELECT N'v_dispatch_detail',   CAST(COUNT(*) AS nvarchar(20)) FROM dbo.v_dispatch_detail
UNION ALL SELECT N'v_dispatch_stats',    CAST(COUNT(*) AS nvarchar(20)) FROM dbo.v_dispatch_stats;
GO

PRINT N'=== 2b 单据头表台账时间(判断是否曾真实录单) ===';
SELECT N'sample_req' AS t, MIN(asp_time1) AS tmin, MAX(asp_time1) AS tmax, MIN(asp_user1) AS maker FROM dbo.sample_req
UNION ALL SELECT N'bd_dispatch', MIN(asp_time1), MAX(asp_time1), MIN(asp_user1) FROM dbo.bd_dispatch
UNION ALL SELECT N'bd_outsource_order', MIN(asp_time1), MAX(asp_time1), MIN(asp_user1) FROM dbo.bd_outsource_order;
GO

PRINT N'=== 3 操作留痕 yj_usage_log ===';
SELECT ISNULL(panel_name, N'(null)') AS panel_name, event_type, action_name,
       COUNT(*) AS n, MIN(created_at) AS tmin, MAX(created_at) AS tmax
FROM yj_usage_log
WHERE panel_name IN (N'样品申请单', N'工序派工单', N'委外加工单', N'工序派工单明细表', N'工序派工单统计表')
GROUP BY panel_name, event_type, action_name
ORDER BY n DESC;
GO
SELECT N'yj_usage_log_total' AS k, CAST(COUNT(*) AS nvarchar(20)) AS v FROM yj_usage_log;
GO

PRINT N'=== 4 别的面板是否参照这几张面板(ref_panel) ===';
SELECT f.panel_code AS host_panel, f.label, f.ref_panel
FROM yj_field f
WHERE f.ref_panel IN ('SAMPLE_REQ','DISPATCH','OUTSOURCE_ORDER','DISPATCH_DETAIL','DISPATCH_STATS')
ORDER BY f.panel_code, f.label;
GO

PRINT N'=== 5 附件 / 审批 / 单据批次 / 报表列设置 痕迹 ===';
SELECT N'yj_attachment' AS t, COUNT(*) AS n FROM yj_attachment
 WHERE panel_code IN ('SAMPLE_REQ','DISPATCH','OUTSOURCE_ORDER','DISPATCH_DETAIL','DISPATCH_STATS')
UNION ALL SELECT N'yj_form_approval', COUNT(*) FROM yj_form_approval
 WHERE panel_code IN ('SAMPLE_REQ','DISPATCH','OUTSOURCE_ORDER','DISPATCH_DETAIL','DISPATCH_STATS')
UNION ALL SELECT N'report_column_settings', COUNT(*) FROM report_column_settings
 WHERE panel_code IN ('SAMPLE_REQ','DISPATCH','OUTSOURCE_ORDER','DISPATCH_DETAIL','DISPATCH_STATS')
UNION ALL SELECT N'yj_doc_batch(source)', COUNT(*) FROM yj_doc_batch
 WHERE source_panel_code IN ('SAMPLE_REQ','DISPATCH','OUTSOURCE_ORDER','DISPATCH_DETAIL','DISPATCH_STATS')
UNION ALL SELECT N'yj_doc_batch(target)', COUNT(*) FROM yj_doc_batch
 WHERE target_panel_code IN ('SAMPLE_REQ','DISPATCH','OUTSOURCE_ORDER','DISPATCH_DETAIL','DISPATCH_STATS');
GO

PRINT N'=== 6 DB 侧依赖:谁引用了这些表/视图 ===';
SELECT DISTINCT
       OBJECT_NAME(d.referencing_id) AS referrer,
       ISNULL(o.type_desc, N'?')     AS referrer_type,
       d.referenced_entity_name      AS referenced
FROM sys.sql_expression_dependencies d
LEFT JOIN sys.objects o ON o.object_id = d.referencing_id
WHERE d.referenced_entity_name IN
      ('sample_req','sample_req_detail','bd_dispatch','bl_dispatch',
       'bd_outsource_order','bl_outsource_order','v_dispatch_detail','v_dispatch_stats')
ORDER BY referenced, referrer;
GO

PRINT N'=== 6b 这 8 个对象的类型与建立/修改时间 ===';
SELECT o.name, o.type_desc, o.create_date, o.modify_date
FROM sys.objects o
WHERE o.name IN ('sample_req','sample_req_detail','bd_dispatch','bl_dispatch',
                 'bd_outsource_order','bl_outsource_order','v_dispatch_detail','v_dispatch_stats')
ORDER BY o.name;
GO

PRINT N'=== 7 单号台账 s_allno 发号情况(类别 SP/DP/WW/…) ===';
SELECT lb, COUNT(*) AS n, MIN(asp_time1) AS tmin, MAX(asp_time1) AS tmax
FROM s_allno WHERE lb IN (N'SP', N'DP', N'WO', N'WW', N'PG')
GROUP BY lb;
GO

PRINT N'=== 8 出入库流水 inh/outh 里有没有「委外/派工」列(实测:没有 ⇒ 无外协回写) ===';
SELECT t.name AS tbl, c.name AS col
FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
WHERE t.name IN ('inh', 'outh') AND (c.name LIKE N'%委外%' OR c.name LIKE N'%派工%' OR c.name LIKE N'%外协%');
GO
