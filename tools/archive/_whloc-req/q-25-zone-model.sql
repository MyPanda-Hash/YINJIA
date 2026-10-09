-- 分区/大区 当前的元数据形态 + 项目里既有的"档案/字典"惯例
SET NOCOUNT ON;
PRINT N'=== 1. WHLOC 字段登记(看 大区/存储分区 有没有字典/参照/选项) ===';
SELECT f.id, f.label AS 字段, f.col_name AS 物理列, f.data_type AS 类型, f.place,
       f.seq, f.visible, f.hidden,
       ISNULL(f.ref_panel,N'') AS 参照面板, ISNULL(f.ref_field,N'') AS 参照字段,
       ISNULL(f.options,N'') AS 选项, ISNULL(f.dict_code,N'') AS 字典
FROM yj_field f JOIN yj_panel p ON p.id=f.panel_id
WHERE p.panel_code=N'WHLOC' ORDER BY f.seq, f.id;
GO

PRINT N'=== 2. WH 字段登记(仓库分类/仓库分类编码 = 既有的"名称+编码"惯例) ===';
SELECT f.label AS 字段, f.col_name AS 物理列, f.place, f.seq, f.visible, f.hidden,
       ISNULL(f.ref_panel,N'') AS 参照面板, ISNULL(f.ref_field,N'') AS 参照字段, ISNULL(f.options,N'') AS 选项
FROM yj_field f JOIN yj_panel p ON p.id=f.panel_id
WHERE p.panel_code=N'WH' ORDER BY f.seq, f.id;
GO

PRINT N'=== 3. 项目里疑似"字典/分类/档案"的表(找可复用的机制) ===';
SELECT name AS 表名, (SELECT CAST(value AS nvarchar(200)) FROM sys.extended_properties
        WHERE major_id=OBJECT_ID(t.name) AND minor_id=0 AND name='MS_Description') AS 中文注明
FROM sys.tables t
WHERE name LIKE N'%dict%' OR name LIKE N'%字典%' OR name LIKE N'%categ%' OR name LIKE N'%class%'
   OR name LIKE N'%type%' OR name LIKE N'%zone%' OR name LIKE N'%area%' OR name LIKE N'%region%'
ORDER BY name;
GO

PRINT N'=== 4. 是否存在 数据字典 面板(前端有 dict-mode-test.cjs 的线索) ===';
SELECT panel_code AS 面板码, panel_name AS 面板名, panel_category AS 分类, table_name AS 表
FROM yj_panel WHERE panel_name LIKE N'%字典%' OR panel_name LIKE N'%分类%' OR panel_code LIKE N'%DICT%'
   OR panel_name LIKE N'%分区%' OR panel_name LIKE N'%区域%' OR panel_name LIKE N'%地区%'
ORDER BY panel_code;
GO

PRINT N'=== 5. 仓位表里 大区/存储分区 的实际取值分布(靠 DISTINCT,没有枚举源) ===';
SELECT ISNULL(大区,N'(空)') AS 大区, ISNULL(存储分区,N'(空)') AS 存储分区, COUNT(*) AS 仓位数
FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'
GROUP BY 大区, 存储分区 ORDER BY 大区, 存储分区;
GO

PRINT N'=== 6. 分区名在库里被"重复存"了多少次(改名成本) ===';
SELECT COUNT(DISTINCT 存储分区) AS 分区种类, COUNT(*) AS 总行数,
       COUNT(*)/NULLIF(COUNT(DISTINCT 存储分区),0) AS 平均每分区重复行数
FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(存储分区,N'')<>N'';
GO
