SET NOCOUNT ON;
SELECT comm, dh, lb, ny, asp_user1, asp_cancel, CONVERT(nvarchar(19),asp_time1,120) AS t1 FROM s_allno WHERE ISNULL(lb,N'')=N'';
