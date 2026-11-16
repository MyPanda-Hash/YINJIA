SELECT TOP 10 s.sc_no, s.gldh, ISNULL(s.[工单行号],0) AS xc, s.gxdm, s.lot_no, s.sl
FROM dbo.scjl s
WHERE ISNULL(s.asp_cancel,'N')<>'Y'
  AND ISNULL(s.lot_no,N'')<>N''
  AND NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status st WHERE st.panel_code=N'WO_REPORT' AND st.doc_no=s.sc_no
                  AND (st.shr IS NOT NULL OR st.pending='Y'))
  AND EXISTS (
      SELECT 1 FROM dbo.wo_process_line w
      JOIN dbo.plang p ON p.pl_no = w.工单号 AND p.id = w.工单行id
      WHERE w.工单号 = s.gldh AND ISNULL(p.pl_xc,0) = ISNULL(s.[工单行号],0)
        AND w.工序 = s.gxdm AND ISNULL(w.asp_cancel,'N')<>'Y'
        AND ISNULL(w.工序序,0) = (SELECT MAX(ISNULL(w2.工序序,0)) FROM dbo.wo_process_line w2
                                    WHERE w2.工单号 = s.gldh AND w2.工单行id = w.工单行id AND ISNULL(w2.asp_cancel,'N')<>'Y')
  )
ORDER BY s.sc_no DESC;
