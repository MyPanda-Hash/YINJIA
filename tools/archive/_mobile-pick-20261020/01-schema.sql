/* 只读:移动端扫码领料要用的字段现状(仓库/仓位/批号日期) */
SET NOCOUNT ON;

PRINT N'== A. kucun 列(非备用)==';
SELECT c.name AS 列, ty.name AS 类型, c.max_length
  FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.kucun') AND c.name NOT LIKE N'备用%' ORDER BY c.column_id;

PRINT N'== B. 带仓位/库位字样的表 ==';
SELECT name FROM sys.tables WHERE name LIKE N'%bin%' OR name LIKE N'%仓位%' OR name LIKE N'%loc%' OR name LIKE N'%wh%';

PRINT N'== C. v_stock_pick 的列 ==';
SELECT c.name AS 列 FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.v_stock_pick') ORDER BY c.column_id;

PRINT N'== D. kucun 批号样本(看批号里有没有日期)==';
SELECT TOP 15 wzdm, ckdm, lot_no, in_date, yl FROM dbo.kucun
 WHERE ISNULL(asp_cancel,N'N') <> N'Y' AND ISNULL(yl,0) > 0 ORDER BY lot_no;

PRINT N'== E. 批号能解析出 8 位日期的比例 ==';
SELECT COUNT(*) AS 有货行,
       SUM(CASE WHEN lot_no LIKE '%[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]%' THEN 1 ELSE 0 END) AS 批号含8位数字,
       SUM(CASE WHEN in_date IS NOT NULL THEN 1 ELSE 0 END) AS 有入库日期
  FROM dbo.kucun WHERE ISNULL(asp_cancel,N'N') <> N'Y' AND ISNULL(yl,0) > 0;
