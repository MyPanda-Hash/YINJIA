SET NOCOUNT ON;
PRINT N'=== A. 视图/存储过程/函数/触发器 是否引用 bs_wh_loc ===';
SELECT o.name AS 对象, o.type_desc AS 类型
FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE N'%bs_wh_loc%';
GO
PRINT N'=== A2. 同上,搜 bs_wh(仓库表) —— 作对照 ===';
SELECT COUNT(*) AS 引用bs_wh的对象数
FROM sys.sql_modules m WHERE m.definition LIKE N'%bs_wh%';
GO

PRINT N'=== B. 外键:bs_wh_loc / bs_wh 有没有父子关系 ===';
SELECT fk.name AS 外键, OBJECT_NAME(fk.parent_object_id) AS 子表, OBJECT_NAME(fk.referenced_object_id) AS 父表
FROM sys.foreign_keys fk
WHERE OBJECT_NAME(fk.parent_object_id) IN (N'bs_wh_loc', N'bs_wh')
   OR OBJECT_NAME(fk.referenced_object_id) IN (N'bs_wh_loc', N'bs_wh');
GO

PRINT N'=== C. 面板元数据 ===';
SELECT panel_code AS 面板, panel_name AS 面板名, mode, ISNULL(line_table,N'') AS 行表
FROM yj_panel WHERE line_table = N'bs_wh_loc' OR panel_code = N'WHLOC';
SELECT COUNT(*) AS 参照WHLOC的字段数 FROM yj_field WHERE ref_panel = N'WHLOC';
GO

PRINT N'=== D. 单据侧那些「仓位*」字段的参照源(空=未挂参照) ===';
SELECT panel_code AS 面板, label AS 字段, ISNULL(ref_panel,N'(无参照)') AS 参照面板
FROM yj_field WHERE label LIKE N'%仓位%' AND label NOT LIKE N'%启用仓位管理%'
ORDER BY panel_code, seq;
GO

PRINT N'=== E. bs_wh_loc 数据现状 ===';
SELECT N'总行数' AS 项, CAST(COUNT(*) AS nvarchar(20)) AS 值 FROM bs_wh_loc
UNION ALL SELECT N'有效行数', CAST(COUNT(*) AS nvarchar(20)) FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'非migration写入行', CAST(COUNT(*) AS nvarchar(20)) FROM bs_wh_loc WHERE ISNULL(asp_user1,'') NOT IN (N'migration',N'admin')
UNION ALL SELECT N'最近修改时间', ISNULL(CONVERT(nvarchar(30), MAX(asp_time2), 120), N'(无)') FROM bs_wh_loc;
GO

PRINT N'=== F. 库存/流水表里的「仓位/库位」列 ===';
SELECT t.name AS 表, c.name AS 列
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
WHERE c.name LIKE N'%仓位%' OR c.name LIKE N'%库位%'
ORDER BY t.name, c.column_id;
GO

PRINT N'=== G. 这些「仓位」列有没有真实数据(与 bs_wh_loc 是否能对上) ===';
SELECT N'bs_inv.默认仓位 非空' AS 项, CAST(COUNT(*) AS nvarchar(20)) AS 值 FROM bs_inv WHERE ISNULL(默认仓位,N'')<>N''
UNION ALL SELECT N'bl_purchase_in.仓位编码 非空', CAST(COUNT(*) AS nvarchar(20)) FROM bl_purchase_in WHERE ISNULL(仓位编码,N'')<>N''
UNION ALL SELECT N'bl_sale_out.仓位编码 非空', CAST(COUNT(*) AS nvarchar(20)) FROM bl_sale_out WHERE ISNULL(仓位编码,N'')<>N''
UNION ALL SELECT N'bd_purchase_in.仓位编码 非空', CAST(COUNT(*) AS nvarchar(20)) FROM bd_purchase_in WHERE ISNULL(仓位编码,N'')<>N''
UNION ALL SELECT N'—— 参照 bs_wh 的字段数(作对照) ——', CAST(COUNT(*) AS nvarchar(20)) FROM yj_field WHERE ref_panel = N'WH';
GO

PRINT N'=== H. 有没有「仓位库存」表 ===';
SELECT name AS 表 FROM sys.tables WHERE name LIKE N'%wh_loc%' OR name LIKE N'%仓位%';
GO
