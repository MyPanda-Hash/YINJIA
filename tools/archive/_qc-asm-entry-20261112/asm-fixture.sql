SET NOCOUNT ON;
DECLARE @pid int, @pcid int, @scjl int;
SELECT @pid = id FROM dbo.plang WHERE pl_no=N'GD-TEST-ASM-20261112';
IF @pid IS NULL
BEGIN
  INSERT INTO dbo.plang (comm, pl_no, pl_xc, scx, dm, mc, gg, jldw, pl_sl, xq_sl, rk_sl, yl, ja,
                         [工艺路线], [批次号], asp_cancel, asp_user1, asp_time1)
  VALUES (N'', N'GD-TEST-ASM-20261112', 1, N'', N'TEST-ASM-001', N'表观自动出单验证件', N'T-ASM', N'个',
          1000, 1000, 0, 0, N'N', N'GY-CB-STD', N'TESTASM01', N'N', N'lead-verify', GETDATE());
  SET @pid = SCOPE_IDENTITY();
  PRINT N'[OK] plang inserted';
END
ELSE PRINT N'[SKIP] plang exists';

SELECT @pcid = id FROM dbo.plang_pc WHERE plang_id=@pid;
IF @pcid IS NULL
BEGIN
  INSERT INTO dbo.plang_pc (comm, pl_no, pl_xc, scx, dm, mc, gg, jldw, pl_sl, xq_sl, rk_sl, yl, ja,
                            [批次号], plang_id, asp_cancel, asp_time1)
  VALUES (N'', N'GD-TEST-ASM-20261112', 1, N'', N'TEST-ASM-001', N'表观自动出单验证件', N'T-ASM', N'个',
          1000, 1000, 0, 0, N'N', N'TESTASM01', @pid, N'N', GETDATE());
  SET @pcid = SCOPE_IDENTITY();
  PRINT N'[OK] plang_pc inserted';
END
ELSE PRINT N'[SKIP] plang_pc exists';

SELECT @scjl = id FROM dbo.scjl WHERE gldh=N'GD-TEST-ASM-20261112' AND gxdm=N'组装' AND ISNULL(asp_cancel,'N')<>'Y';
IF @scjl IS NULL
BEGIN
  INSERT INTO dbo.scjl (comm, sc_no, gldh, gxdm, sl, wgzt, [工单行号], gd_id, [批次号], sc_date,
                        asp_cancel, delmark, asp_time1, mc, wzdm, gg, jldw)
  VALUES (N'', N'TESTASM01-SC1', N'GD-TEST-ASM-20261112', N'组装', 300, 'Y', 1, @pcid, N'TESTASM01',
          CAST(GETDATE() AS date), N'N', 0, GETDATE(), N'表观自动出单验证件', N'TEST-ASM-001', N'T-ASM', N'个');
  SET @scjl = SCOPE_IDENTITY();
  PRINT N'[OK] scjl inserted';
END
ELSE PRINT N'[SKIP] scjl exists';

SELECT @pid AS pid, @pcid AS pcid, @scjl AS scjl_id;
