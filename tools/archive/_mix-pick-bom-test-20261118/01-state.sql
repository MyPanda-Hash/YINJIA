-- 01-state.sql —— 测试库「未开单工单 × 物料清单」现状体检(只读)
-- 用法(tools 目录):
--   java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar SqlRunner.java ^
--     "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false" yinjia env ^
--     archive\_mix-pick-bom-test-20261118\01-state.sql
SET NOCOUNT ON;

PRINT '--- A. 工单行总数 / 未开单(无有效组装领料单)行数 ---';
-- ⚠ 不能写 SUM(CASE WHEN NOT EXISTS(...)):SQL Server 不允许聚合参数里带子查询,
--   拆成两个标量子查询(2026-11-18 踩到,报「不能对包含聚合或子查询的表达式执行聚合函数」)。
SELECT (SELECT COUNT(*) FROM plang WHERE ISNULL(asp_cancel,'N') <> 'Y') AS 工单行总数,
       (SELECT COUNT(*) FROM plang p
        WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
          AND NOT EXISTS (SELECT 1 FROM wo_pick_doc d
                          WHERE d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废')
       ) AS 未开单行数;

PRINT '--- B. 未开单工单行:产品 BOM / 半成品(**)TB) BOM 现状 ---';
SELECT p.pl_no AS 工单号, p.pl_xc AS 行号, p.dm AS 产品, p.mc AS 产品名, p.pl_sl AS 排产数量,
       ISNULL(a.asmRows,0)   AS 产品BOM行数,
       ISNULL(s.semiLines,0) AS 半成品行数,
       ISNULL(w.semiWithBom,0) AS 半成品有BOM数
FROM plang p
OUTER APPLY (
  SELECT COUNT(*) AS asmRows
  FROM bs_asm_bom b
  WHERE b.产品编码 = p.dm AND b.工序 = N'组装'
    AND ISNULL(b.asp_cancel,'N') <> 'Y' AND ISNULL(b.状态,N'启用') <> N'停用'
) a
OUTER APPLY (
  SELECT COUNT(*) AS semiLines
  FROM bs_asm_bom b
  WHERE b.产品编码 = p.dm AND b.工序 = N'组装'
    AND ISNULL(b.asp_cancel,'N') <> 'Y' AND ISNULL(b.状态,N'启用') <> N'停用'
    AND UPPER(ISNULL(b.子件编码,N'')) LIKE N'%**TB'
) s
OUTER APPLY (
  SELECT COUNT(DISTINCT b.子件编码) AS semiWithBom
  FROM bs_asm_bom b
  WHERE b.产品编码 = p.dm AND b.工序 = N'组装'
    AND ISNULL(b.asp_cancel,'N') <> 'Y' AND ISNULL(b.状态,N'启用') <> N'停用'
    AND UPPER(ISNULL(b.子件编码,N'')) LIKE N'%**TB'
    AND EXISTS (SELECT 1 FROM bs_asm_bom x
                WHERE x.产品编码 = b.子件编码 AND x.工序 = N'组装'
                  AND ISNULL(x.asp_cancel,'N') <> 'Y' AND ISNULL(x.状态,N'启用') <> N'停用')
) w
WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
  AND NOT EXISTS (SELECT 1 FROM wo_pick_doc d
                  WHERE d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废')
ORDER BY p.pl_no DESC, p.pl_xc DESC;
