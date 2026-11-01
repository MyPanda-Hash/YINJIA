/* _prod-pick-mig-20261025/recon1.sql — 只读取证:PROD_PICK_LIST 面板现役元数据(安全语句,无写操作)
   用途:遗失的链外注册脚本 migrate-prod-pick-outh-20261022.sql 重建取材。
   跑法(正式/测试各一遍):
     java -cp lib/mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=<库>;encrypt=false" yinjia env archive/_prod-pick-mig-20261025/recon1.sql */
SET NOCOUNT ON;

/* 0) 结构探底:两张表的真实列名(避免猜列名翻车) */
SELECT N'0-cols' AS tag, t.name AS tbl, c.column_id, c.name AS col, TYPE_NAME(c.user_type_id) AS typ
  FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
 WHERE t.name IN (N'yj_schema_log', N'yj_role')
 ORDER BY t.name, c.column_id;

/* 0b) 迁移链是否登记过 prod_pick(动态取含 script/name 的列做 LIKE,预期 0 行) */
DECLARE @c sysname = (SELECT TOP 1 c.name FROM sys.columns c
   JOIN sys.tables t ON t.object_id = c.object_id
  WHERE t.name = N'yj_schema_log' AND c.name LIKE N'%script%'
  ORDER BY c.column_id);
IF @c IS NULL SET @c = (SELECT TOP 1 c.name FROM sys.columns c
   JOIN sys.tables t ON t.object_id = c.object_id
  WHERE t.name = N'yj_schema_log' AND c.name LIKE N'%name%'
  ORDER BY c.column_id);
DECLARE @sql nvarchar(max) = N'SELECT N''0b-schema-log'' AS tag, * FROM dbo.yj_schema_log WHERE '
    + QUOTENAME(@c) + N' LIKE N''%prod_pick%''';
IF @c IS NOT NULL EXEC(@sql);

/* 1) 面板行(现役实况) */
SELECT N'1-yj_panel' AS tag, * FROM dbo.yj_panel WHERE panel_code = N'PROD_PICK_LIST';

/* 2) 字段行(现役实况,按 seq) */
SELECT N'2-yj_field' AS tag, * FROM dbo.yj_field WHERE panel_code = N'PROD_PICK_LIST' ORDER BY seq, id;

/* 3) 视图定义与视图列 */
SELECT N'3-view-def' AS tag, definition FROM sys.sql_modules WHERE object_id = OBJECT_ID(N'dbo.v_prod_pick_list');
SELECT N'3-view-cols' AS tag, c.column_id, c.name, TYPE_NAME(c.user_type_id) AS typ, c.max_length
  FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.v_prod_pick_list') ORDER BY c.column_id;
SELECT N'3-view-desc' AS tag, CAST(ep.value AS nvarchar(600)) AS descr
  FROM sys.extended_properties ep
 WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.v_prod_pick_list')
   AND ep.minor_id = 0 AND ep.name = N'MS_Description';

/* 4) 授权(现役实况) */
SELECT N'4-role-panel' AS tag, * FROM dbo.yj_role_panel WHERE panel_code = N'PROD_PICK_LIST' ORDER BY role_id;
SELECT N'4-roles' AS tag, * FROM dbo.yj_role WHERE id IN (SELECT role_id FROM dbo.yj_role_panel WHERE panel_code = N'PROD_PICK_LIST');

/* 5) 译名(面板名 + 本面板字段标签) */
SELECT N'5-trans' AS tag, * FROM dbo.yj_translation
 WHERE (scope = 'panel' AND ref_key = N'生产领料')
    OR (scope = 'field' AND ref_key IN (SELECT label FROM dbo.yj_field WHERE panel_code = N'PROD_PICK_LIST'))
 ORDER BY scope, ref_key, locale;
