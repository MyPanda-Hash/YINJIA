SET NOCOUNT ON;
SELECT dh, lb, ny, bz, asp_user1, CONVERT(varchar(19), asp_time1, 120) AS t1 FROM [HSDZ_MES_SRV1017].dbo.s_allno WHERE dh LIKE 'LL%' ORDER BY id DESC;
SELECT lb, COUNT(*) c FROM [HSDZ_MES_SRV1017].dbo.s_allno GROUP BY lb ORDER BY c DESC;
