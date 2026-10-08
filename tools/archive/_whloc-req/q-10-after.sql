SET NOCOUNT ON;
PRINT N'=== 剩余含「库位」的 MS_Description(逐条) ===';
SELECT OBJECT_NAME(ep.major_id) AS 对象,
       CASE WHEN ep.minor_id = 0 THEN N'(表)' ELSE COL_NAME(ep.major_id, ep.minor_id) END AS 列,
       CAST(ep.value AS nvarchar(400)) AS 注明
FROM sys.extended_properties ep
WHERE ep.class = 1 AND ep.name = 'MS_Description' AND CAST(ep.value AS nvarchar(400)) LIKE N'%库位%'
ORDER BY OBJECT_NAME(ep.major_id), ep.minor_id;
GO
PRINT N'=== 改名后仓位档案三列的类型/长度(核对上一版预期写错的字节数) ===';
SELECT c.name AS 列, ty.name AS 类型, c.max_length AS 字节, c.max_length/2 AS 字符数
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.bs_wh_loc') AND c.name IN (N'仓位编码', N'仓位地址', N'仓库编码');
SELECT c.name AS 列, ty.name AS 类型, c.max_length AS 字节, c.max_length/2 AS 字符数
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.bs_wh') AND c.name = N'仓位';
GO
PRINT N'=== 改名后 WHLOC 面板 + 字段(终态) ===';
SELECT p.panel_code, p.panel_name, p.mode, p.line_table FROM yj_panel p WHERE p.panel_code = 'WHLOC';
SELECT id, col_name, label, data_type, ref_panel, place, seq, hidden, visible FROM yj_field WHERE panel_code='WHLOC' ORDER BY seq, id;
SELECT panel_code, col_name, label FROM yj_field WHERE panel_code='WH' AND (col_name LIKE N'%仓位%' OR label LIKE N'%仓位%');
GO
PRINT N'=== 译名终态(panel/仓位, field/仓位编码, field/仓位地址, field/仓位) ===';
SELECT scope, ref_key, COUNT(*) AS 语言数, MIN(text) AS 样例 FROM yj_translation
WHERE (scope='panel' AND ref_key=N'仓位') OR (scope='field' AND ref_key IN (N'仓位',N'仓位编码',N'仓位地址'))
GROUP BY scope, ref_key ORDER BY scope, ref_key;
GO
