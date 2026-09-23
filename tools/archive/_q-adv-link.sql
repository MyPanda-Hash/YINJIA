/* 高级筛选服务端化 + 台账联动(选项∩基础资料) 施工前探针
   目的:① 确认 bs_wh/bs_inv 的列名(写交集 SQL 用) ② 交集后还剩多少可选组合 */
SET NOCOUNT ON;
GO

PRINT '== bs_wh 列 ==';
SELECT c.name AS 列名, t.name AS 类型, c.max_length
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID(N'bs_wh') ORDER BY c.column_id;
GO
PRINT '== bs_wh 全量(6 行) ==';
SELECT * FROM bs_wh;
GO

PRINT '== bs_inv 列(进货/存货档案) ==';
SELECT c.name AS 列名, t.name AS 类型, c.max_length
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID(N'bs_inv') ORDER BY c.column_id;
GO

PRINT '== 台账视图 distinct 仓库(9) 与 仓库档案的交集 ==';
SELECT DISTINCT RTRIM(l.仓库) AS 台账仓库,
       CASE WHEN EXISTS (SELECT 1 FROM bs_wh w WHERE RTRIM(w.仓库名称) = RTRIM(l.仓库)) THEN N'在档案' ELSE N'未建档' END AS 档案状态,
       COUNT(*) AS 行数
  FROM v_stock_ledger l
 WHERE l.仓库 IS NOT NULL AND RTRIM(l.仓库) <> '' AND l.仓库 NOT LIKE N'(未填%'
 GROUP BY RTRIM(l.仓库)
 ORDER BY 1;
GO

PRINT '== 交集后:(档案仓库 × 有流水存货) 组合数,及按仓汇总 ==';
SELECT RTRIM(l.仓库) AS 仓库, COUNT(DISTINCT RTRIM(l.存货)) AS 有流水存货数
  FROM v_stock_ledger l
 WHERE EXISTS (SELECT 1 FROM bs_wh w WHERE RTRIM(w.仓库名称) = RTRIM(l.仓库))
 GROUP BY RTRIM(l.仓库) ORDER BY 1;
GO

PRINT '== 这些存货里,有多少能在 bs_inv 找到(按名称) ==';
SELECT COUNT(DISTINCT RTRIM(l.存货)) AS 台账存货数,
       COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM bs_inv i WHERE RTRIM(i.存货名称) = RTRIM(l.存货)) THEN RTRIM(l.存货) END) AS 档案内
  FROM v_stock_ledger l
 WHERE EXISTS (SELECT 1 FROM bs_wh w WHERE RTRIM(w.仓库名称) = RTRIM(l.仓库));
GO

PRINT '== 库存状况表(v_stock_balance)同口径 ==';
SELECT RTRIM(b.仓库) AS 仓库, COUNT(*) AS 行数, COUNT(DISTINCT RTRIM(b.存货)) AS 存货数
  FROM v_stock_balance b
 WHERE EXISTS (SELECT 1 FROM bs_wh w WHERE RTRIM(w.仓库名称) = RTRIM(b.仓库))
 GROUP BY RTRIM(b.仓库) ORDER BY 1;
GO
