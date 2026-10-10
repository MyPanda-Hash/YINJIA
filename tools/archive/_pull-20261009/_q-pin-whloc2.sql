SET NOCOUNT ON;
PRINT N'库 = ' + DB_NAME();
PRINT N'-- ④ bs_wh:是否启用仓位管理 + 厂区';
SELECT 仓库编码, 仓库名称, ISNULL(厂区, N'') AS 厂区,
       CASE WHEN 启用仓位管理 = 1 THEN N'是' ELSE N'否' END AS 启用仓位管理,
       ISNULL([状态], N'') AS 状态
  FROM bs_wh WHERE ISNULL(asp_cancel, N'N') <> N'Y' ORDER BY 仓库编码;

PRINT N'-- ⑤ bs_wh_loc:仓库列取值 + 每仓仓位数(看「仓库」存的是编码还是名称)';
SELECT TOP 3 仓库 AS 仓库列值, 仓库编码 AS 仓库编码列, 仓位编码, 仓位地址 FROM bs_wh_loc
 WHERE ISNULL(asp_cancel, N'N') <> N'Y' ORDER BY 仓位编码;
SELECT 仓库编码, COUNT(*) AS 仓位数 FROM bs_wh_loc WHERE ISNULL(asp_cancel, N'N') <> N'Y'
 GROUP BY 仓库编码 ORDER BY 仓库编码;

PRINT N'-- ⑥ bs_inv 有没有默认仓位/默认仓库类列';
SELECT c.name AS 列名 FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bs_inv')
   AND (c.name LIKE N'%仓位%' OR c.name LIKE N'%仓库%' OR c.name LIKE N'%库位%') ORDER BY c.column_id;

PRINT N'-- ⑦ 全库哪些面板明细有「仓位」字段(可借鉴口径)';
SELECT panel_code AS 面板, place, seq, label AS 字段, col_name AS 物理列, data_type AS 类型,
       ref_panel AS 参照面板, ref_field AS 参照字段, display_field AS 回填, hidden AS 隐藏, visible AS 可见
  FROM yj_field WHERE label = N'仓位' OR col_name = N'仓位'
 ORDER BY panel_code, place, seq;

PRINT N'-- ⑧ yj_field 有没有「参照过滤」列,非空的有哪些(联动机制现成案例)';
SELECT c.name AS 列名 FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.yj_field')
   AND (c.name LIKE N'%ref%' OR c.name LIKE N'%filter%' OR c.name LIKE N'%dict%') ORDER BY c.column_id;
SELECT panel_code AS 面板, place, label AS 字段, col_name AS 物理列, ref_panel AS 参照面板, ref_filter AS 参照过滤
  FROM yj_field WHERE ISNULL(ref_filter, N'') <> N'' ORDER BY panel_code, seq;
