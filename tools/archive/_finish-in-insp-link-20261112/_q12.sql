SELECT (SELECT COUNT(*) FROM scjl) AS scjl_all,
       (SELECT COUNT(*) FROM scjl WHERE ISNULL(lot_no,N'')<>N'') AS scjl_lot,
       (SELECT COUNT(*) FROM wo_process_line) AS ledger_all,
       (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code=N'WO_REPORT') AS report_status_rows,
       (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code=N'WO_REPORT' AND shr IS NOT NULL) AS report_audited;
SELECT TOP 5 s.sc_no, s.gldh, ISNULL(s.[工单行号],0) xc, s.gxdm, s.lot_no, s.sl
FROM scjl s WHERE ISNULL(s.lot_no,N'')<>N'' ORDER BY s.sc_no DESC;
SELECT TOP 5 w.工单号, w.工单行id, w.工序, w.工序序 FROM wo_process_line w ORDER BY w.id DESC;
