SET NOCOUNT ON;
-- 假想"分区档案"的粒度：按 (仓, 大区, 分区, 区码) 分组，看排/位/层的值域
-- 若这里行数远小于分区种类 ⇒ 真正的维护单元是"段"，不是"分区"
PRINT N'=== A. 按 (仓,大区,分区,区码) 分组的"段" ===';
SELECT w.仓库名称 AS 仓, ISNULL(l.大区,N'(不分区)') AS 大区, ISNULL(l.存储分区,N'(无)') AS 分区, l.区码,
       COUNT(*) AS 仓位数,
       MIN(l.排号) AS 排号小, MAX(l.排号) AS 排号大, COUNT(DISTINCT l.排号) AS 排数,
       COUNT(DISTINCT l.位号) AS 位数, COUNT(DISTINCT l.层号) AS 层数
FROM bs_wh_loc l JOIN bs_wh w ON w.仓库编码=l.仓库编码
WHERE ISNULL(l.asp_cancel,'N')<>'Y'
GROUP BY w.仓库名称, l.大区, l.存储分区, l.区码
ORDER BY w.仓库名称, l.大区, l.存储分区, l.区码;
GO

PRINT N'=== B. 粒度对比 ===';
SELECT (SELECT COUNT(DISTINCT 存储分区) FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(存储分区,N'')<>N'') AS 分区种类,
       (SELECT COUNT(DISTINCT CONCAT(仓库编码,'|',ISNULL(大区,''),'|',ISNULL(存储分区,''),'|',ISNULL(区码,''))) FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y') AS 段数,
       (SELECT COUNT(*) FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y') AS 仓位行数;
GO

PRINT N'=== C. 一个区码承载多个分区 / 一个分区跨多个区码 的实证 ===';
SELECT l.区码, COUNT(DISTINCT l.存储分区) AS 承载分区数, STRING_AGG(CAST(l.存储分区 AS nvarchar(60)), N'+') AS 分区们
FROM bs_wh_loc l WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(l.存储分区,N'')<>N''
GROUP BY l.区码 HAVING COUNT(DISTINCT l.存储分区)>1 ORDER BY l.区码;
GO
SELECT ISNULL(l.存储分区,N'(无)') AS 分区, COUNT(DISTINCT l.区码) AS 跨区码数, STRING_AGG(CAST(l.区码 AS nvarchar(20)), N'+') AS 区码们
FROM bs_wh_loc l WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(l.存储分区,N'')<>N''
GROUP BY l.存储分区 HAVING COUNT(DISTINCT l.区码)>1 ORDER BY 分区;
GO

PRINT N'=== D. 仓库分类 有没有字典(看"名称+编码"惯例是否真被字典支撑) ===';
SELECT f.label AS 字段, ISNULL(f.dict_sql,'') AS 字典SQL, ISNULL(f.ref_panel,'') AS 参照面板
FROM yj_field f WHERE f.panel_code=N'WH' AND f.label IN (N'仓库分类',N'仓库分类编码',N'分类id');
GO
SELECT COUNT(*) AS bs_dict行数, COUNT(DISTINCT 字典类别) AS 字典类别数 FROM bs_dict;
GO
SELECT TOP 8 字典类别, COUNT(*) AS 条目数 FROM bs_dict GROUP BY 字典类别 ORDER BY 字典类别;
GO
PRINT N'=== E. 分类档案表的形状(可作 分区档案 的模板) ===';
SELECT t.name AS 表, c.name AS 列, ty.name AS 类型
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN (N'bs_material_group',N'bs_region') ORDER BY t.name, c.column_id;
GO
