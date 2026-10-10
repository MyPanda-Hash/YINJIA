SET NOCOUNT ON;
PRINT N'库 = ' + DB_NAME();
PRINT N'-- ① bs_inv 默认仓位/默认仓库 有没有数据';
SELECT COUNT(*) AS 商品总数,
       SUM(CASE WHEN ISNULL(默认仓位, N'') <> N'' THEN 1 ELSE 0 END) AS 默认仓位非空,
       SUM(CASE WHEN ISNULL(默认仓库, N'') <> N'' THEN 1 ELSE 0 END) AS 默认仓库非空,
       SUM(CASE WHEN ISNULL(默认仓库编码, N'') <> N'' THEN 1 ELSE 0 END) AS 默认仓库编码非空
  FROM bs_inv;

PRINT N'-- ② WHLOC(仓位档案)面板的字段(看仓库列怎么登记、能不能被参照过滤)';
SELECT place, seq, label AS 字段, col_name AS 物理列, data_type AS 类型,
       ISNULL(ref_panel, N'') AS 参照面板, ISNULL(ref_field, N'') AS 参照字段, hidden AS 隐藏
  FROM yj_field WHERE panel_code = N'WHLOC' ORDER BY place, seq;

PRINT N'-- ③ bs_wh_loc 有没有「默认」类列(没有就得新加)';
SELECT c.name AS 列名 FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bs_wh_loc')
   AND (c.name LIKE N'%默认%' OR c.name LIKE N'%是否%') ORDER BY c.column_id;
PRINT N'(空 = 没有默认标记列)';

PRINT N'-- ④ 仓位档案里「仓库」「仓库编码」两列的取值形态(参照过滤要按哪一列)';
SELECT TOP 5 仓库 AS 仓库列, 仓库编码 AS 仓库编码列, 大区, 存储分区, 仓位编码 FROM bs_wh_loc
 WHERE ISNULL(asp_cancel, N'N') <> N'Y' AND 仓库编码 = N'CK-A' ORDER BY 仓位编码;
