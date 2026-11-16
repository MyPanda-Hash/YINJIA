DECLARE @wo nvarchar(50)=N'GD-2026-10-0221', @xc int=1;
SELECT (SELECT TOP 1 w.工序 FROM dbo.wo_process_line w JOIN dbo.plang p ON p.pl_no=w.工单号 AND p.id=w.工单行id
        WHERE w.工单号=@wo AND ISNULL(p.pl_xc,0)=@xc AND ISNULL(w.asp_cancel,'N')<>'Y'
        ORDER BY ISNULL(w.工序序,0) DESC) AS 最后一道工序;
SELECT gxdm, lot_no, SUM(sl) AS 已审报工量 FROM dbo.scjl
 WHERE gldh=@wo AND ISNULL([工单行号],0)=@xc AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(wgzt,N'')<>N''
 GROUP BY gxdm, lot_no;
SELECT h.单据编号 AS 出货检验功能单号 FROM dbo.qc_proc_insp_head h
 WHERE ISNULL(h.工单号,N'')=@wo AND ISNULL(h.工单行号,0)=@xc AND ISNULL(h.asp_cancel,'N')<>'Y'
   AND EXISTS (SELECT 1 FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_PROC_INSP' AND s.doc_no=CAST(h.单据编号 AS nvarchar(100)) AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N')<>'Y')
 ORDER BY h.id DESC;
SELECT h.单据编号 AS 出货检验表观单号 FROM dbo.qc_asm_insp_head h
 WHERE ISNULL(h.工单号,N'')=@wo AND ISNULL(h.工单行号,0)=@xc AND ISNULL(h.asp_cancel,'N')<>'Y'
   AND EXISTS (SELECT 1 FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_ASM_INSP' AND s.doc_no=CAST(h.单据编号 AS nvarchar(100)) AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N')<>'Y')
 ORDER BY h.id DESC;
SELECT 单据编号, 工单行号, 批次号, 实收数量_头, 状态 FROM (
  SELECT h.单据编号, h.工单行号, h.批次号, CAST(NULL AS decimal(18,4)) AS 实收数量_头, N'-' AS 状态
  FROM dbo.bd_finish_in h WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND h.加工单号=@wo
) t;
