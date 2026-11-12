SELECT panel_code, panel_name, line_table, head_table, group_col, prefix FROM yj_panel WHERE panel_code IN (N'WO_REPORT', N'WO_REPORT_LIST');
SELECT COUNT(*) AS total, SUM(CASE WHEN ISNULL(lot_no,N'')<>N'' THEN 1 ELSE 0 END) AS with_lot FROM scjl;
SELECT TOP 5 id, sc_no, gldh, [工单行号], gxdm, lot_no, sl FROM scjl WHERE ISNULL(lot_no,N'')<>N'' ORDER BY id DESC;
