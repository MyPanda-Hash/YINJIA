SET NOCOUNT ON;
PRINT '== TEST: 已归档的烧结工艺清单 ==';
SELECT s.panel_code, s.doc_no, s.archived, s.canceled FROM yj_doc_status s
 WHERE s.panel_code IN ('RD_MOLD_PROC','RD_X_SINTER') AND ISNULL(s.archived,'N')='Y' ORDER BY s.doc_no;
PRINT '== TEST: 有排产数量的工单(A-48-41 / B-92-25) ==';
SELECT TOP 10 p.pl_no, p.pl_xc, p.dm, p.mc, p.pl_sl, p.scx FROM dbo.plang p
 WHERE p.dm IN (N'A-48-41', N'B-92-25') AND ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.pl_sl,0)>0;
PRINT '== TEST: 近期可测工单(未完工, 已排产) ==';
SELECT TOP 15 p.pl_no, p.pl_xc, p.dm, p.mc, p.pl_sl, p.scx FROM dbo.plang p
 WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.pl_sl,0)>0 AND ISNULL(p.完工状态,N'')<>'Y'
 ORDER BY p.id DESC;
PRINT '== TEST: bs_mix_bom / mate 行数 ==';
SELECT (SELECT COUNT(*) FROM dbo.bs_mix_bom) AS mix_rows, (SELECT COUNT(*) FROM dbo.mate) AS mate_rows,
       (SELECT COUNT(*) FROM dbo.bs_asm_bom) AS asm_rows;
