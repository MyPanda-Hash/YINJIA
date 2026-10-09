SET NOCOUNT ON;
PRINT N'库 = ' + DB_NAME();
PRINT N'-- ① PURCHASE_IN 面板里所有「仓位/仓库」相关字段登记(含明细)';
SELECT place, seq, label AS 字段, col_name AS 物理列, data_type AS 类型,
       ref_panel AS 参照面板, ref_field AS 参照字段, display_field AS 回填,
       ISNULL(ref_filter, N'') AS 参照过滤, editable AS 可编辑, hidden AS 隐藏, visible AS 可见
  FROM yj_field
 WHERE panel_code = N'PURCHASE_IN' AND (label LIKE N'%仓位%' OR col_name LIKE N'%仓位%'
        OR label LIKE N'%仓库%' OR col_name LIKE N'%仓库%')
 ORDER BY CASE WHEN place LIKE N'%detail%' THEN 0 ELSE 1 END, seq;

PRINT N'-- ② bl_purchase_in 里仓位相关物理列';
SELECT c.name AS 列名, t.name AS 类型, c.max_length AS 长度, c.is_nullable AS 可空,
       ISNULL(CAST(ep.value AS nvarchar(200)), N'(无注明)') AS 中文注明
  FROM sys.columns c
  JOIN sys.types t ON t.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = N'MS_Description'
 WHERE c.object_id = OBJECT_ID('dbo.bl_purchase_in') AND (c.name LIKE N'%仓位%' OR c.name LIKE N'%仓库%')
 ORDER BY c.column_id;

PRINT N'-- ③ bs_wh_loc(仓位档案)列 + 数量';
SELECT c.name AS 列名 FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bs_wh_loc') ORDER BY c.column_id;
SELECT COUNT(*) AS 仓位总数, COUNT(DISTINCT 仓库编码) AS 涉及仓库数 FROM bs_wh_loc WHERE ISNULL(asp_cancel,N'N') <> N'Y';

PRINT N'-- ④ bs_wh 是否启用仓位管理 + 有哪些仓';
SELECT 仓库编码, 仓库名称, ISNULL(厂区, N'') AS 厂区, ISNULL(启用仓位管理, N'(NULL)') AS 启用仓位管理, ISNULL(状态, N'') AS 状态
  FROM bs_wh WHERE ISNULL(asp_cancel, N'N') <> N'Y' ORDER BY 仓库编码;

PRINT N'-- ⑤ bs_inv 有没有「默认仓位」列';
SELECT c.name AS 列名 FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bs_inv')
   AND (c.name LIKE N'%仓位%' OR c.name LIKE N'%仓库%' OR c.name LIKE N'%库位%') ORDER BY c.column_id;

PRINT N'-- ⑥ 其它单据明细有没有「仓位」字段(看可借鉴口径)';
SELECT panel_code AS 面板, place, seq, label AS 字段, col_name AS 物理列, data_type AS 类型, ref_panel AS 参照面板
  FROM yj_field WHERE (label = N'仓位' OR col_name = N'仓位')
 ORDER BY panel_code, place, seq;
