/* ============================================================
   dump-server-views.sql — 导出目标库里所有视图的完整定义(只读)
   ------------------------------------------------------------
   用途:本机库缺了一批报表视图(v_manu_order_detail / v_sale_out_stats ...),
        而服务器上这些视图是好的。把定义导出来,可用于补齐本机库。
   输出:可直接执行的 SQL(每个视图一段 + GO 分隔),配 sqlcmd -y 0 防止长行被截断。
   执行:sqlcmd -S localhost -d HSDZ_MES -E -f i:65001,o:65001 -y 0 -h -1 -i dump-server-views.sql -o views.sql
   ============================================================ */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

SELECT N'--- VIEW: ' + v.name + N' ---'
     + CHAR(13) + CHAR(10)
     + N'IF OBJECT_ID(N''' + v.name + N''') IS NOT NULL DROP VIEW [' + v.name + N'];'
     + CHAR(13) + CHAR(10)
     + m.definition
     + CHAR(13) + CHAR(10) + N'GO'
  FROM sys.views v
  JOIN sys.sql_modules m ON m.object_id = v.object_id
 ORDER BY v.name;
GO

SELECT N'--- COLUMNS: bl_dispatch ---' + CHAR(13) + CHAR(10) + STUFF((
        SELECT CHAR(13) + CHAR(10) + c.name + N' ' + t.name
          FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
         WHERE c.object_id = OBJECT_ID('bl_dispatch')
         ORDER BY c.column_id FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '');
GO

SELECT N'--- COLUMNS: bd_dispatch ---' + CHAR(13) + CHAR(10) + STUFF((
        SELECT CHAR(13) + CHAR(10) + c.name + N' ' + t.name
          FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
         WHERE c.object_id = OBJECT_ID('bd_dispatch')
         ORDER BY c.column_id FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '');
GO

PRINT N'===== VIEWS-DUMP-END =====';
GO
