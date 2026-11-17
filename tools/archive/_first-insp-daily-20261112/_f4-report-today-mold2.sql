SET NOCOUNT ON;
DECLARE @wo nvarchar(60) = N'GD-TEST-FIRST-261112';
DECLARE @pcid int = (SELECT TOP 1 pc.id FROM dbo.plang_pc pc JOIN dbo.plang p ON p.id=pc.plang_id
                     WHERE p.pl_no=@wo AND ISNULL(pc.asp_cancel,'N')<>'Y' ORDER BY pc.id);
IF NOT EXISTS (SELECT 1 FROM dbo.scjl WHERE gldh=@wo AND sc_no=N'TESTFIRST-T2')
INSERT INTO dbo.scjl (comm, sc_no, gldh, gxdm, sl, wgzt, [工单行号], gd_id, [批次号], sc_date,
                      asp_cancel, delmark, asp_time1, mc, wzdm, gg, jldw)
VALUES (N'', N'TESTFIRST-T2', @wo, N'成型', 1, N'Y', 1, @pcid, NULL,
        CAST(GETDATE() AS date), N'N', 0, GETDATE(), N'首件按天验证件', N'TEST-FIRST-001', N'T-FIRST', N'个');
PRINT N'[OK] 今日成型第二笔报工 1';
