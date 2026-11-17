IF NOT EXISTS (SELECT 1 FROM dbo.scjl WHERE sc_no = N'BG-AUTOGEN-TEST-01')
BEGIN
    INSERT INTO dbo.scjl (comm, sc_no, sc_date, gldh, [工单行号], gxdm, lot_no, sl, wzdm, mc, gg, jldw, asp_cancel)
    VALUES (N'', N'BG-AUTOGEN-TEST-01', GETDATE(), N'GD-2026-10-0015', 3, N'组装', N'20261112', 100, N'D-01-21', N'A+级烧结炭棒/滤芯', N'40*16*24', N'支', N'N');
    PRINT N'[OK] inserted synthetic report row';
END
ELSE PRINT N'[SKIP] row exists';
DELETE FROM dbo.yj_doc_status WHERE panel_code = N'WO_REPORT' AND doc_no = N'BG-AUTOGEN-TEST-01';
SELECT COUNT(*) AS scjl_rows FROM dbo.scjl WHERE sc_no = N'BG-AUTOGEN-TEST-01';
