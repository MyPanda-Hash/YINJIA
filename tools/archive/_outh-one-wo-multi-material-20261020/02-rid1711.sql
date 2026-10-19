/* 只读取证:rid=1711 到底指哪张表的哪一行 + 谁在写 src=6 */
SET NOCOUNT ON;

PRINT N'== A. 候选表里 id=1711 ==';
SELECT N'plang_pc' AS 表, COUNT(*) AS 命中 FROM dbo.plang_pc WHERE id = 1711
UNION ALL SELECT N'plang', COUNT(*) FROM dbo.plang WHERE id = 1711
UNION ALL SELECT N'bl_material_out', COUNT(*) FROM dbo.bl_material_out WHERE id = 1711
UNION ALL SELECT N'bd_material_out', COUNT(*) FROM dbo.bd_material_out WHERE id = 1711
UNION ALL SELECT N'outh(src=6,rid=1711)', COUNT(*) FROM dbo.outh WHERE src = 6 AND rid = 1711
UNION ALL SELECT N'outh(任意src,rid=1711)', COUNT(*) FROM dbo.outh WHERE rid = 1711;

PRINT N'== B. plang_pc 里 id=1711 / 工单 GD-2026-10-0001 的行 ==';
SELECT id, comm, pl_no, pl_xc, od_no, od_xc, scx, pl_sl, ja, lot_no, 批次号
  FROM dbo.plang_pc WHERE id = 1711 OR pl_no = N'GD-2026-10-0001' ORDER BY pl_no, pl_xc;

PRINT N'== C. bl_material_out id=1711 前后 ==';
SELECT TOP 5 id, 单据编号, 材料编码, 数量, 批号, 加工单号 FROM dbo.bl_material_out WHERE id BETWEEN 1708 AND 1714 ORDER BY id;

PRINT N'== D. src=6 的 outh 是否每个 rid 只一行(现状)==';
SELECT TOP 10 COUNT(*) AS 行数, rid FROM dbo.outh WHERE src = 6 GROUP BY rid HAVING COUNT(*) > 1;

PRINT N'== E. 材料出库单头行数(一单多行是常态)==';
SELECT TOP 5 h.单据编号, h.加工单号, h.工单行号, COUNT(l.id) AS 明细行数
  FROM dbo.bd_material_out h JOIN dbo.bl_material_out l ON l.单据编号 = h.单据编号
 GROUP BY h.单据编号, h.加工单号, h.工单行号 ORDER BY COUNT(l.id) DESC;

PRINT N'== F. 各单据表里带 1711 的 id 归属(反查最能说明 rid 语义)==';
SELECT N'plang_pc' AS 表, id, pl_no AS 单号, pl_xc AS 行号 FROM dbo.plang_pc WHERE id = 1711
UNION ALL SELECT N'bl_material_out', id, 单据编号, NULL FROM dbo.bl_material_out WHERE id = 1711
UNION ALL SELECT N'bl_purchase_in', id, 单据编号, NULL FROM dbo.bl_purchase_in WHERE id = 1711
UNION ALL SELECT N'bl_sale_out', id, 单据编号, NULL FROM dbo.bl_sale_out WHERE id = 1711;
