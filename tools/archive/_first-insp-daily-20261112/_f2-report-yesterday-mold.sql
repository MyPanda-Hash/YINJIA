SET NOCOUNT ON;
DECLARE @wo nvarchar(60) = N'GD-TEST-FIRST-261112';
DECLARE @pcid int = (SELECT TOP 1 pc.id FROM dbo.plang_pc pc JOIN dbo.plang p ON p.id=pc.plang_id
                     WHERE p.pl_no=@wo AND ISNULL(pc.asp_cancel,'N')<>'Y' ORDER BY pc.id);
IF @pcid IS NULL BEGIN RAISERROR(N'夹具缺少 plang_pc,请先跑 _f1-fixture.sql', 16, 1); RETURN; END
IF NOT EXISTS (SELECT 1 FROM dbo.scjl WHERE gldh=@wo AND gxdm=N'成型' AND CAST(sc_date AS date)=DATEADD(day,-1,CAST(GETDATE() AS date)))
INSERT INTO dbo.scjl (comm, sc_no, gldh, gxdm, sl, wgzt, [工单行号], gd_id, [批次号], sc_date,
                      asp_cancel, delmark, asp_time1, mc, wzdm, gg, jldw)
VALUES (N'', N'TESTFIRST-Y', @wo, N'成型', 10, N'Y', 1, @pcid, NULL,
        DATEADD(day,-1,CAST(GETDATE() AS date)), N'N', 0, GETDATE(), N'首件按天验证件', N'TEST-FIRST-001', N'T-FIRST', N'个');
PRINT N'[OK] 昨日成型报工 10 (sc_date=昨天)';
SELECT id, gldh, gxdm, sl, CONVERT(varchar(10),sc_date,120) AS d FROM dbo.scjl WHERE gldh=@wo ORDER BY id;
