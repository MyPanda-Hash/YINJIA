/* 找「生产工单页默认日期窗口(近 14 天)内、且有工序检验单」的工单行 —— 供 UI 补验 C 用 */
SET NOCOUNT ON;
SELECT TOP 20 p.pl_no AS 工单号, p.pl_xc AS 工单行号, p.pl_date AS 工单日期,
       (SELECT COUNT(*) FROM dbo.qc_first_insp_head h WHERE h.工单号=p.pl_no AND h.[工单行号]=p.pl_xc AND ISNULL(h.asp_cancel,'N')<>'Y') AS 首件检验单,
       (SELECT COUNT(*) FROM dbo.qc_proc_insp_head h WHERE h.工单号=p.pl_no AND h.[工单行号]=p.pl_xc AND ISNULL(h.asp_cancel,'N')<>'Y') AS 制程检验单,
       (SELECT COUNT(*) FROM dbo.qc_asm_insp_head h WHERE h.工单号=p.pl_no AND h.[工单行号]=p.pl_xc AND ISNULL(h.asp_cancel,'N')<>'Y') AS 组装检验单
  FROM dbo.plang p
 WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND p.pl_date >= '2026-10-15'
 ORDER BY (SELECT COUNT(*) FROM dbo.qc_first_insp_head h WHERE h.工单号=p.pl_no AND h.[工单行号]=p.pl_xc)
        + (SELECT COUNT(*) FROM dbo.qc_proc_insp_head h WHERE h.工单号=p.pl_no AND h.[工单行号]=p.pl_xc)
        + (SELECT COUNT(*) FROM dbo.qc_asm_insp_head h WHERE h.工单号=p.pl_no AND h.[工单行号]=p.pl_xc) DESC, p.pl_no;
GO
