SELECT p.id, p.pl_no, p.pl_xc, p.pl_sl, p.工艺路线, p.dm, p.mc, p.gg, p.jldw, p.asp_cancel
FROM dbo.plang p WHERE p.id IN (83, 91);
SELECT w.工单号, w.工单行id, w.工序, w.工序序 FROM dbo.wo_process_line w WHERE w.工单行id IN (83,91) ORDER BY w.工单行id, w.工序序;
