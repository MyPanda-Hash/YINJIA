/* 工序流程追踪卡 验证取证:对象/行数快照(只读)。两账套各跑一次。 */
SET NOCOUNT ON;
PRINT N'==== @DB = ' + DB_NAME() + N' ====';

SELECT N'head: 表存在(1/0)' AS 项, CASE WHEN OBJECT_ID(N'dbo.wo_proc_card_head', N'U') IS NULL THEN 0 ELSE 1 END AS 值
UNION ALL SELECT N'detail: 表存在(1/0)', CASE WHEN OBJECT_ID(N'dbo.wo_proc_card_detail', N'U') IS NULL THEN 0 ELSE 1 END;
GO

IF OBJECT_ID(N'dbo.wo_proc_card_head', N'U') IS NOT NULL
    SELECT N'wo_proc_card_head 总行数' AS 项, COUNT(*) AS 值 FROM dbo.wo_proc_card_head
    UNION ALL SELECT N'wo_proc_card_head 有效行数(asp_cancel=N)', COUNT(*) FROM dbo.wo_proc_card_head WHERE asp_cancel = N'N'
    UNION ALL SELECT N'卡号重复组数', COUNT(*) FROM (SELECT [卡号] FROM dbo.wo_proc_card_head GROUP BY [卡号] HAVING COUNT(*) > 1) t
    UNION ALL SELECT N'工单行id重复组数(有效)', COUNT(*) FROM (SELECT [工单行id] FROM dbo.wo_proc_card_head WHERE asp_cancel = N'N' GROUP BY [工单行id] HAVING COUNT(*) > 1) t
    UNION ALL SELECT N'列数', COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.wo_proc_card_head')
    UNION ALL SELECT N'表注释数', COUNT(*) FROM sys.extended_properties WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_proc_card_head') AND minor_id = 0 AND name = N'MS_Description'
    UNION ALL SELECT N'列注释数', COUNT(*) FROM sys.extended_properties WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_proc_card_head') AND minor_id > 0 AND name = N'MS_Description'
    UNION ALL SELECT N'索引数(非堆)', COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.wo_proc_card_head') AND index_id > 0;
GO

IF OBJECT_ID(N'dbo.wo_proc_card_detail', N'U') IS NOT NULL
    SELECT N'wo_proc_card_detail 总行数' AS 项, COUNT(*) AS 值 FROM dbo.wo_proc_card_detail
    UNION ALL SELECT N'wo_proc_card_detail 有效行数', COUNT(*) FROM dbo.wo_proc_card_detail WHERE asp_cancel = N'N'
    UNION ALL SELECT N'列数', COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.wo_proc_card_detail')
    UNION ALL SELECT N'表注释数', COUNT(*) FROM sys.extended_properties WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_proc_card_detail') AND minor_id = 0 AND name = N'MS_Description'
    UNION ALL SELECT N'列注释数', COUNT(*) FROM sys.extended_properties WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_proc_card_detail') AND minor_id > 0 AND name = N'MS_Description'
    UNION ALL SELECT N'索引数(非堆)', COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.wo_proc_card_detail') AND index_id > 0;
GO

SELECT N'索引明细' AS 项, name AS 名, is_unique AS 唯一, filter_definition AS 过滤
  FROM sys.indexes
 WHERE object_id IN (OBJECT_ID(N'dbo.wo_proc_card_head'), OBJECT_ID(N'dbo.wo_proc_card_detail')) AND index_id > 0
 ORDER BY name;
GO

SELECT N'yj_role_panel' AS 表, COUNT(*) AS 行数, COUNT(DISTINCT role_id) AS 角色数
  FROM dbo.yj_role_panel WHERE panel_code = N'PROC_FLOW_CARD'
UNION ALL
SELECT N'yj_translation(panel 工序流程追踪卡)', COUNT(*), COUNT(DISTINCT locale)
  FROM dbo.yj_translation WHERE scope = N'panel' AND ref_key = N'工序流程追踪卡'
UNION ALL
SELECT N'yj_schema_log(proc-card 脚本)', COUNT(*), 0
  FROM dbo.yj_schema_log WHERE script_name LIKE N'%proc-card%';
GO

SELECT role_id, perms FROM dbo.yj_role_panel WHERE panel_code = N'PROC_FLOW_CARD' ORDER BY role_id;
GO

SELECT locale, text FROM dbo.yj_translation WHERE scope = N'panel' AND ref_key = N'工序流程追踪卡' ORDER BY locale;
GO

SELECT N'yj_attachment panel_code=PROC_FLOW_CARD 行数' AS 项, COUNT(*) AS 值
  FROM dbo.yj_attachment WHERE panel_code = N'PROC_FLOW_CARD';
GO
