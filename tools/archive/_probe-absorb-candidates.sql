/* _probe-absorb-candidates.sql — 只读：**部署前安全检查** —— 吸收候选行(手机端直写)在两个账套各有多少
   判据与 ExternalReportAbsorbService.CANDIDATE_SQL 完全一致。 */
SET NOCOUNT ON;
DECLARE @d7 date = DATEADD(day, -7, CAST(GETDATE() AS date));
DECLARE @d90 date = DATEADD(day, -90, CAST(GETDATE() AS date));

SELECT '近 7 天候选(吸收窗口默认 3 天,这里放宽到 7 天)' AS 口径,
       CAST(COUNT(*) AS varchar(10)) AS 行数
FROM dbo.scjl s
WHERE ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.delmark,0)=0
  AND ISNULL(s.wgzt,'N')='Y' AND ISNULL(s.gldh,N'')<>N''
  AND (s.sc_date IS NULL OR s.sc_date >= @d7)
  AND (ISNULL(s.[报工单号],N'')=N''
       OR NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status ds WHERE ds.panel_code=N'WO_REPORT'
                      AND ds.doc_no=s.[报工单号] AND ds.shr IS NOT NULL));

SELECT '近 90 天候选(看历史量)' AS 口径, CAST(COUNT(*) AS varchar(10)) AS 行数
FROM dbo.scjl s
WHERE ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.delmark,0)=0
  AND ISNULL(s.wgzt,'N')='Y' AND ISNULL(s.gldh,N'')<>N''
  AND (s.sc_date IS NULL OR s.sc_date >= @d90)
  AND (ISNULL(s.[报工单号],N'')=N''
       OR NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status ds WHERE ds.panel_code=N'WO_REPORT'
                      AND ds.doc_no=s.[报工单号] AND ds.shr IS NOT NULL));

SELECT 'scjl 总行数 / 已完工行 / 报工单号为空行' AS 口径,
       CAST(COUNT(*) AS varchar(10)) + ' / '
       + CAST(SUM(CASE WHEN ISNULL(wgzt,'N')='Y' THEN 1 ELSE 0 END) AS varchar(10)) + ' / '
       + CAST(SUM(CASE WHEN ISNULL([报工单号],N'')=N'' THEN 1 ELSE 0 END) AS varchar(10)) AS 行数
FROM dbo.scjl WHERE ISNULL(asp_cancel,'N')<>'Y';
