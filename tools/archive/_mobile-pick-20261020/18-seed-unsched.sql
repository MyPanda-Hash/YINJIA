SET NOCOUNT ON;
IF NOT EXISTS (SELECT 1 FROM dbo.plang WHERE pl_no = N'GD-TEST-UNSCH')
  INSERT INTO dbo.plang (comm, pl_no, pl_xc, scx, pl_man, pl_date, dm, mc, gg, jldw, pl_sl, xq_sl, ja, asp_user1, asp_time1, asp_cancel)
  VALUES (N'0', N'GD-TEST-UNSCH', 1, N'', N'探针', CAST(GETDATE() AS date), N'A-32-01', N'未排产探针产品', N'探规格', N'支', 0, 100, N'N', N'probe', SYSDATETIME(), N'N');
SELECT pl_no, pl_xc, pl_sl, scx, dm FROM dbo.plang WHERE pl_no = N'GD-TEST-UNSCH';
