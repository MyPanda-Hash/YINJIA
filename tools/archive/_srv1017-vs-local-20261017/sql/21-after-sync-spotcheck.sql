SET NOCOUNT ON;
PRINT '=== plang_pc(CAST 后)是否一致 ===';
SELECT (SELECT COUNT(*) FROM (SELECT id, pl_no, mc, CAST(comm AS nvarchar(max)) comm FROM HSDZ_MES_SRV1017.dbo.plang_pc
        EXCEPT SELECT id, pl_no, mc, CAST(comm AS nvarchar(max)) FROM HSDZ_MES.dbo.plang_pc) a) AS 服务器独有,
       (SELECT COUNT(*) FROM (SELECT id, pl_no, mc, CAST(comm AS nvarchar(max)) comm FROM HSDZ_MES.dbo.plang_pc
        EXCEPT SELECT id, pl_no, mc, CAST(comm AS nvarchar(max)) FROM HSDZ_MES_SRV1017.dbo.plang_pc) b) AS 本地独有;
PRINT '=== outh 仍有差异的 8 行,差异列 ===';
SELECT o.id, o.审核 AS 本地审核, s.审核 AS 服务器审核, o.asp_user3 AS 本地u3, s.asp_user3 AS 服务器u3,
       CONVERT(varchar(23), o.asp_time3, 121) AS 本地t3, CONVERT(varchar(23), s.asp_time3, 121) AS 服务器t3,
       o.asp_user4 AS 本地u4, s.asp_user4 AS 服务器u4, o.asp_cancel AS 本地cancel, s.asp_cancel AS 服务器cancel
FROM HSDZ_MES.dbo.outh o JOIN HSDZ_MES_SRV1017.dbo.outh s ON s.id=o.id
WHERE ISNULL(o.审核,'')<>ISNULL(s.审核,'') OR ISNULL(o.asp_user3,'')<>ISNULL(s.asp_user3,'')
   OR ISNULL(CONVERT(varchar(23),o.asp_time3,121),'')<>ISNULL(CONVERT(varchar(23),s.asp_time3,121),'')
   OR ISNULL(o.asp_user4,'')<>ISNULL(s.asp_user4,'') OR ISNULL(o.asp_time4,'')<>ISNULL(s.asp_time4,'');
PRINT '=== s_allno 仍有差异的行 ===';
SELECT 'SRV' AS 来源, comm, ID, dh, lb, ny FROM HSDZ_MES_SRV1017.dbo.s_allno s
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES.dbo.s_allno l WHERE l.comm=s.comm AND l.ID=s.ID)
UNION ALL
SELECT 'LOC', comm, ID, dh, lb, ny FROM HSDZ_MES.dbo.s_allno l
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES_SRV1017.dbo.s_allno s WHERE s.comm=l.comm AND s.ID=l.ID);
