SET NOCOUNT ON;
DECLARE @wo nvarchar(60) = N'GD-TEST-FIRST-261112';
DECLARE @pid int, @pcid int;
SELECT @pid = id FROM dbo.plang WHERE pl_no=@wo AND ISNULL(pl_xc,0)=1;
IF @pid IS NULL
BEGIN
  INSERT INTO dbo.plang (comm, pl_no, pl_xc, scx, dm, mc, gg, jldw, pl_sl, xq_sl, rk_sl, yl, ja,
                         [工艺路线], [批次号], asp_cancel, asp_user1, asp_time1)
  VALUES (N'', @wo, 1, N'', N'TEST-FIRST-001', N'首件按天验证件', N'T-FIRST', N'个', 1000, 1000, 0, 0, N'N',
          N'GY-CB-STD', NULL, N'N', N'lead-verify', GETDATE());
  SET @pid = SCOPE_IDENTITY();
  PRINT N'[OK] plang inserted';
END
ELSE PRINT N'[SKIP] plang exists';
SELECT @pcid = id FROM dbo.plang_pc WHERE plang_id=@pid;
IF @pcid IS NULL
BEGIN
  INSERT INTO dbo.plang_pc (comm, pl_no, pl_xc, scx, dm, mc, gg, jldw, pl_sl, xq_sl, rk_sl, yl, ja,
                            [批次号], plang_id, asp_cancel, asp_time1)
  VALUES (N'', @wo, 1, N'', N'TEST-FIRST-001', N'首件按天验证件', N'T-FIRST', N'个', 1000, 1000, 0, 0, N'N',
          NULL, @pid, N'N', GETDATE());
  SET @pcid = SCOPE_IDENTITY();
  PRINT N'[OK] plang_pc inserted';
END
ELSE PRINT N'[SKIP] plang_pc exists';
SELECT @pid AS pid, @pcid AS pcid;
