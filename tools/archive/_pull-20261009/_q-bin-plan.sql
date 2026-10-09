SET NOCOUNT ON;
PRINT N'库 = ' + DB_NAME();
PRINT N'-- ① INV(商品档案)有没有登记 默认仓位/默认仓库 字段';
SELECT place, seq, label AS 字段, col_name AS 物理列, data_type AS 类型,
       ISNULL(ref_panel, N'') AS 参照面板, ISNULL(ref_field, N'') AS 参照字段, hidden AS 隐藏, editable AS 可编辑
  FROM yj_field WHERE panel_code = N'INV'
   AND (label LIKE N'%默认%' OR col_name LIKE N'%默认%' OR label LIKE N'%仓位%' OR col_name LIKE N'%仓位%')
 ORDER BY place, seq;
PRINT N'(空 = 没登记,界面上填不了)';

PRINT N'-- ② WH(仓库档案)有没有登记 启用仓位管理 / 厂区';
SELECT place, seq, label AS 字段, col_name AS 物理列, data_type AS 类型, hidden AS 隐藏, editable AS 可编辑
  FROM yj_field WHERE panel_code = N'WH'
   AND (label LIKE N'%仓位%' OR label LIKE N'%厂区%' OR col_name LIKE N'%仓位%' OR col_name LIKE N'%厂区%')
 ORDER BY place, seq;

PRINT N'-- ③ WHLOC 面板现有「是否」字段样例(默认标记照这个口径做)';
SELECT place, seq, label AS 字段, col_name AS 物理列, data_type AS 类型, hidden AS 隐藏
  FROM yj_field WHERE panel_code = N'WHLOC' AND data_type = N'是否' ORDER BY seq;

PRINT N'-- ④ 采购入库明细要改造的那一行(现状)';
SELECT id, place, seq, label AS 字段, col_name AS 物理列, data_type AS 类型,
       editable, required, hidden, visible, ISNULL(ref_panel, N'') AS 参照面板
  FROM yj_field WHERE panel_code = N'PURCHASE_IN' AND place LIKE N'%detail%'
   AND (col_name IN (N'仓位名称', N'仓位编码', N'仓位id') OR label LIKE N'%仓位%')
 ORDER BY seq;

PRINT N'-- ⑤ bl_purchase_in 现有仓位类列的数据量与唯一索引情况';
SELECT COUNT(*) AS 行数,
       SUM(CASE WHEN ISNULL(仓位编码, N'') <> N'' THEN 1 ELSE 0 END) AS 仓位编码非空,
       SUM(CASE WHEN ISNULL(仓位名称, N'') <> N'' THEN 1 ELSE 0 END) AS 仓位名称非空
  FROM bl_purchase_in;
