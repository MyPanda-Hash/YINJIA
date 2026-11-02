SET NOCOUNT ON;
SELECT N'qc_first' t, h.[单据编号] no, ISNULL(h.[单据状态],N'') st, ISNULL(h.asp_cancel,'N') cancel, h.[工单行号] xc
FROM dbo.qc_first_insp_head h WHERE h.[工单号]=N'GD-2026-09-0011' AND ISNULL(h.[工单行号],0)=2
UNION ALL SELECT N'qc_proc', h.[单据编号], ISNULL(h.[单据状态],N''), ISNULL(h.asp_cancel,'N'), h.[工单行号]
FROM dbo.qc_proc_insp_head h WHERE h.[工单号]=N'GD-2026-09-0011' AND ISNULL(h.[工单行号],0)=2
UNION ALL SELECT N'qc_asm', h.[单据编号], ISNULL(h.[单据状态],N''), ISNULL(h.asp_cancel,'N'), h.[工单行号]
FROM dbo.qc_asm_insp_head h WHERE h.[工单号]=N'GD-2026-09-0011' AND ISNULL(h.[工单行号],0)=2;
GO
SELECT d.id, d.[单据编号], d.[单据日期], ISNULL(d.[单据状态],N'') 状态, ISNULL(d.asp_cancel,'N') cancel, ISNULL(d.[来源单号],N'') 来源单号
FROM dbo.bd_material_out d WHERE d.[加工单号]=N'GD-2026-09-0011' ORDER BY d.id;
GO
SELECT f.id, f.target_form_no 领料单号, f.source_line_key, f.link_status
FROM dbo.form_flow_link f WHERE f.source_form_no=N'GD-2026-09-0011' AND f.target_panel_code='MATERIAL_OUT';
GO
