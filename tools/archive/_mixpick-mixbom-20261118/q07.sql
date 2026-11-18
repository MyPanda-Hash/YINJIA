SET NOCOUNT ON;
PRINT '== TEST: A-48-41 的组装清单(半品行) ==';
SELECT TOP 20 b.单据编号, b.产品编码, b.子件编码, b.子件名称, b.标准用量, b.计量单位, b.默认BOM, b.状态
  FROM dbo.bs_asm_bom b WHERE b.产品编码 = N'A-48-41' AND ISNULL(b.asp_cancel,'N')<>'Y' ORDER BY b.行序;
PRINT '== TEST: GD-2026-09-0135 的领料台账 ==';
SELECT TOP 20 d.id, d.工单号, d.工单行号, d.领料类型, d.状态, d.领料单号, d.物料项数, d.已领项数
  FROM dbo.wo_pick_doc d WHERE d.工单号 = N'GD-2026-09-0135';
PRINT '== TEST: 有组装清单且有半品行的工单(未开单优先) ==';
SELECT TOP 12 p.pl_no, p.pl_xc, p.dm, ISNULL(p.pl_sl,0) AS pl_sl, p.scx,
       (SELECT COUNT(*) FROM dbo.wo_pick_doc d WHERE d.工单号=p.pl_no AND d.工单行号=p.pl_xc AND d.状态<>N'已作废') AS picks
  FROM dbo.plang p
 WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.pl_sl,0)>0 AND ISNULL(p.完工状态,N'')<>'Y'
   AND EXISTS (SELECT 1 FROM dbo.bs_asm_bom b WHERE b.产品编码=p.dm AND ISNULL(b.asp_cancel,'N')<>'Y'
               AND b.子件编码 LIKE '%**TB%')
 ORDER BY picks, p.id DESC;
