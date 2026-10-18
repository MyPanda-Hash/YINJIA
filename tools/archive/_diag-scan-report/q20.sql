SELECT pl_no, pl_xc, ISNULL(ja,'(null)') AS ja, ISNULL(asp_user2,N'') AS u2
FROM dbo.plang WHERE pl_no IN ('GD-2026-10-0220','GD-2026-10-0221','GD-2026-10-0222') ORDER BY pl_no, pl_xc;
