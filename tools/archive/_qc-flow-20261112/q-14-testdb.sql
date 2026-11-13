SET NOCOUNT ON;
SELECT N'暂收单' AS t, ISNULL(单据状态,N'(空)') AS st, COUNT(*) AS n FROM dbo.sl_recv GROUP BY 单据状态
UNION ALL SELECT N'检验单', ISNULL(单据状态,N'(空)'), COUNT(*) FROM dbo.qc_insp GROUP BY 单据状态;
SELECT SUM(CASE WHEN ISNULL(canceled,'N')='Y' THEN 1 ELSE 0 END) AS 作废, SUM(CASE WHEN ISNULL(stopped,'N')='Y' THEN 1 ELSE 0 END) AS 中止, COUNT(*) AS 行
  FROM dbo.yj_doc_status WHERE panel_code IN (N'QC_RECV', N'QC_INSP', N'PURCHASE_IN');
SELECT COUNT(*) AS 检验行, SUM(CASE WHEN ISNULL(不合格数量,0)>0 THEN 1 ELSE 0 END) AS 有不合格,
       SUM(CASE WHEN ISNULL(不合格数量,0)>0 AND ISNULL(合格数量,0)=0 THEN 1 ELSE 0 END) AS 全不合格
  FROM dbo.qc_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y';
