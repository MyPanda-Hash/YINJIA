SET NOCOUNT ON;
PRINT N'=== 1. WHLOC 字段登记(dict_sql / ref 有没有用来管 大区·存储分区) ===';
SELECT f.seq, f.label AS 字段, f.col_name AS 物理列, f.data_type AS 类型, f.place,
       f.visible, f.hidden, f.editable,
       ISNULL(f.ref_panel,'') AS 参照面板, ISNULL(f.ref_field,'') AS 参照字段,
       ISNULL(f.ref_filter,'') AS 参照过滤,
       ISNULL(f.dict_sql,'') AS 字典SQL
FROM yj_field f WHERE f.panel_code=N'WHLOC' ORDER BY f.seq, f.id;
GO

PRINT N'=== 2. 全库有多少字段用了 dict_sql(看这是不是主流机制) ===';
SELECT COUNT(*) AS 用字典SQL的字段数, COUNT(DISTINCT panel_code) AS 涉及面板数 FROM yj_field WHERE ISNULL(dict_sql,'')<>'';
GO
SELECT TOP 12 panel_code AS 面板, label AS 字段, LEFT(dict_sql,110) AS 字典SQL片段
FROM yj_field WHERE ISNULL(dict_sql,'')<>'' ORDER BY panel_code, seq;
GO

PRINT N'=== 3. 参照(ref_panel)机制在用的例子 —— 上游档案型枚举 ===';
SELECT TOP 12 panel_code AS 面板, label AS 字段, ref_panel AS 参照面板, ref_field AS 参照字段, ISNULL(ref_filter,'') AS 过滤
FROM yj_field WHERE ISNULL(ref_panel,'')<>'' ORDER BY panel_code, seq;
GO

PRINT N'=== 4. WH 字段(仓库分类/仓库分类编码 = 既有"名称+编码"惯例) ===';
SELECT f.seq, f.label AS 字段, f.col_name AS 物理列, f.place, f.visible, f.hidden,
       ISNULL(f.ref_panel,'') AS 参照面板, ISNULL(f.ref_field,'') AS 参照字段, ISNULL(f.dict_sql,'') AS 字典SQL
FROM yj_field f WHERE f.panel_code=N'WH' ORDER BY f.seq, f.id;
GO

PRINT N'=== 5. 疑似"字典/分类/区域"表与面板(找可复用机制) ===';
SELECT t.name AS 表名, (SELECT CAST(value AS nvarchar(160)) FROM sys.extended_properties
        WHERE major_id=OBJECT_ID(t.name) AND minor_id=0 AND name='MS_Description') AS 中文注明
FROM sys.tables t
WHERE t.name LIKE N'%dict%' OR t.name LIKE N'%categ%' OR t.name LIKE N'%class%'
   OR t.name LIKE N'%zone%' OR t.name LIKE N'%area%' OR t.name LIKE N'%region%'
ORDER BY t.name;
GO
SELECT panel_code AS 面板码, panel_name AS 面板名, category AS 分类, mode, line_table AS 表
FROM yj_panel WHERE panel_name LIKE N'%字典%' OR panel_name LIKE N'%分类%' OR panel_name LIKE N'%分区%'
   OR panel_name LIKE N'%区域%' OR panel_name LIKE N'%地区%' ORDER BY panel_code;
GO

PRINT N'=== 6. 分区名在库里重复存了多少次(=改名成本) ===';
SELECT COUNT(DISTINCT 存储分区) AS 分区种类, COUNT(*) AS 总行数,
       COUNT(*)/NULLIF(COUNT(DISTINCT 存储分区),0) AS 平均重复行数
FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(存储分区,N'')<>N'';
GO

PRINT N'=== 7. 分区/大区 目前是纯文本列(无长度约束之外的任何约束) ===';
SELECT c.name AS 列, ty.name AS 类型, c.max_length/2 AS 字符数, c.is_nullable AS 可空,
       (SELECT CAST(value AS nvarchar(200)) FROM sys.extended_properties
         WHERE major_id=c.object_id AND minor_id=c.column_id AND name='MS_Description') AS 注明
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.bs_wh_loc') AND c.name IN (N'大区',N'存储分区',N'区码',N'排号',N'位号',N'层号',N'仓位编码');
GO
