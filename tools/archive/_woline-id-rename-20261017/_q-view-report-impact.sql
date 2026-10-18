SET NOCOUNT ON;
/* 影响面取证:谁在读 inh/outh,是否出现 SELECT *(加列/改名会踩),有无报表模板/视图引用追溯列。 */
DECLARE @db sysname = DB_NAME();

/* ① 引用 inh/outh 的视图/过程:定义长度、是否含 SELECT *、是否提到追溯列关键词 */
SELECT @db AS 库, o.name AS 对象, o.type_desc AS 种类,
       CASE WHEN m.definition LIKE N'%SELECT *%' OR m.definition LIKE N'%select *%' THEN N'★含 SELECT *' ELSE N'' END AS 星号风险,
       CASE WHEN m.definition LIKE N'%工单项次%' OR m.definition LIKE N'%工单ID%' OR m.definition LIKE N'%工单号%'
            THEN N'★提追溯列' ELSE N'' END AS 追溯列
FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE N'%inh%' OR m.definition LIKE N'%outh%'
ORDER BY o.name;

/* ② 视图 v_stock_* 的列数(视图中是否用显式列:加列/改名不影响) */
SELECT @db AS 库, v.name AS 视图, COUNT(c.column_id) AS 列数
FROM sys.views v JOIN sys.columns c ON c.object_id = v.object_id
WHERE v.name IN (N'v_stock_movement', N'v_stock_ledger', N'v_stock_summary', N'v_stock_balance')
GROUP BY v.name ORDER BY v.name;

/* ③ yj_report_template 的列清单 */
IF OBJECT_ID(N'dbo.yj_report_template') IS NOT NULL
  SELECT @db AS 库, N'yj_report_template' AS 表, c.name AS 列, ty.name AS 类型
  FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  WHERE c.object_id = OBJECT_ID(N'dbo.yj_report_template') ORDER BY c.column_id;

/* ④ yj_panel 的列清单(确认有没有绑表的列) */
IF OBJECT_ID(N'dbo.yj_panel') IS NOT NULL
  SELECT @db AS 库, N'yj_panel' AS 表, c.name AS 列, ty.name AS 类型
  FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  WHERE c.object_id = OBJECT_ID(N'dbo.yj_panel') ORDER BY c.column_id;
