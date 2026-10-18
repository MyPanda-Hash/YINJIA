SET NOCOUNT ON;
PRINT N'== outh 键列长度(评估复合索引字节数)==';
SELECT c.name, t.name AS 类型, c.max_length FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id=OBJECT_ID('dbo.outh') AND c.name IN (N'src',N'rid',N'单据编号',N'物料编码',N'批号');
PRINT N'== v_stock_movement 单据编号 是否有 NULL / 重复 (src,rid) ==';
SELECT COUNT(*) AS 总行, SUM(CASE WHEN 单据编号 IS NULL THEN 1 ELSE 0 END) AS 单号NULL,
       (SELECT COUNT(*) FROM (SELECT src,rid FROM dbo.v_stock_movement GROUP BY src,rid HAVING COUNT(*)>1) x) AS 重复sr
  FROM dbo.v_stock_movement;
PRINT N'== inv_cost_ledger.rid 可空? ==';
SELECT c.name, c.is_nullable, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id=OBJECT_ID('dbo.inv_cost_ledger') AND c.name IN (N'src',N'rid',N'单据编号');
