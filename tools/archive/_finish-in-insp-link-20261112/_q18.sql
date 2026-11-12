-- 只读验证 phase2b 的三条 SQL(正式库,挑最近有报工的工单 GD-2026-11-0017)
SELECT p.id, p.pl_no, p.pl_xc, p.pl_sl, p.工艺路线
FROM dbo.plang p WHERE p.pl_no = N'GD-2026-11-0017';

-- ① 最后一道工序(台账口径)
SELECT TOP 1 w.工序, w.工序序
FROM dbo.wo_process_line w JOIN dbo.plang p ON p.pl_no = w.工单号 AND p.id = w.工单行id
WHERE w.工单号 = N'GD-2026-11-0017' AND ISNULL(p.pl_xc,0) = (SELECT TOP 1 pl_xc FROM dbo.plang WHERE pl_no=N'GD-2026-11-0017')
  AND ISNULL(w.asp_cancel,'N')<>'Y'
ORDER BY ISNULL(w.工序序,0) DESC;

-- ② 该工单行各批次的已审报工量
SELECT s.gxdm, s.lot_no, SUM(s.sl) AS qty, COUNT(*) AS n
FROM dbo.scjl s
WHERE s.gldh = N'GD-2026-11-0017' AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,N'')<>N''
GROUP BY s.gxdm, s.lot_no ORDER BY s.lot_no;

-- ③ 同工单行最新已审核的两张检验单
SELECT N'QC_PROC_INSP' AS panel, h.单据编号 FROM dbo.qc_proc_insp_head h
WHERE ISNULL(h.工单号,N'')=N'GD-2026-11-0017' AND ISNULL(h.asp_cancel,'N')<>'Y'
  AND EXISTS (SELECT 1 FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_PROC_INSP' AND s.doc_no=CAST(h.单据编号 AS nvarchar(100)) AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N')<>'Y')
ORDER BY h.id DESC;
SELECT N'QC_ASM_INSP' AS panel, h.单据编号 FROM dbo.qc_asm_insp_head h
WHERE ISNULL(h.工单号,N'')=N'GD-2026-11-0017' AND ISNULL(h.asp_cancel,'N')<>'Y'
  AND EXISTS (SELECT 1 FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_ASM_INSP' AND s.doc_no=CAST(h.单据编号 AS nvarchar(100)) AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N')<>'Y')
ORDER BY h.id DESC;

-- ④ 幂等判据:该工单行/批次是否已有未作废产成品入库单
SELECT 加工单号, 工单行号, 批次号, COUNT(*) AS n FROM dbo.bd_finish_in
WHERE ISNULL(asp_cancel,'N')<>'Y' AND 加工单号=N'GD-2026-11-0017'
GROUP BY 加工单号, 工单行号, 批次号;
