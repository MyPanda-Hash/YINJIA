SET NOCOUNT ON;
PRINT N'=== 1. bs_wh 全部行(不过滤),看 asp_cancel ===';
SELECT id, 仓库编码, 仓库名称, ISNULL(asp_cancel,'(null)') AS asp_cancel, 停用 FROM dbo.bs_wh ORDER BY 仓库编码, id;
GO
PRINT N'=== 2. yj_locale 列结构 ===';
SELECT c.name AS 列, ty.name AS 类型 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.yj_locale') ORDER BY c.column_id;
GO
PRINT N'=== 3. yj_locale 现有语言 ===';
SELECT * FROM dbo.yj_locale;
GO
PRINT N'=== 4. WHLOC 字段 seq 现状(与 q-10 对比: 曾为 10/15/20/30/40/50) ===';
SELECT id, col_name, label, place, seq, asp_user2, CONVERT(varchar(19), asp_time2, 120) AS 改时间
FROM yj_field WHERE panel_code='WHLOC' ORDER BY seq, id;
GO
PRINT N'=== 5. 谁动过?查审计/修改记录 ===';
SELECT TOP 10 panel_code, doc_no, user_name, CONVERT(varchar(19), saved_at, 120) AS 时间, change_meta
FROM yj_archive_change_log WHERE panel_code='WHLOC' ORDER BY id DESC;
GO
