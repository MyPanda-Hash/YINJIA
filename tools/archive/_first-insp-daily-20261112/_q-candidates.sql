SET NOCOUNT ON;
PRINT N'== 近 3 天外部直写候选行(吸收会扫到的) ==';
SELECT s.id, s.gldh, s.gxdm, s.sl, CONVERT(varchar(19),s.sc_date,120) AS sc_date,
       ISNULL(s.wgzt,N'') AS wgzt, ISNULL(s.[工单行号],0) AS xc, ISNULL(s.[报工单号],N'') AS rep, ISNULL(s.asp_cancel,N'') AS cancel
FROM dbo.scjl s
WHERE ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.delmark,0)=0 AND ISNULL(s.wgzt,'N')='Y'
  AND ISNULL(s.gldh,N'')<>N''
  AND (s.sc_date IS NULL OR s.sc_date >= DATEADD(day, -3, CAST(GETDATE() AS date)))
  AND (ISNULL(s.[报工单号],N'')=N'' OR NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status ds WHERE ds.panel_code=N'WO_REPORT' AND ds.doc_no=s.[报工单号] AND ds.shr IS NOT NULL))
ORDER BY s.id;
PRINT N'== 今日/昨日 首件单 ==';
SELECT 单据编号, 工单号, ISNULL(工单行号,0) AS xc, 单据日期, CONVERT(varchar(19),asp_time1,120) AS created
FROM dbo.qc_first_insp_head WHERE 单据日期 >= DATEADD(day,-2,CAST(GETDATE() AS date)) ORDER BY id DESC;
