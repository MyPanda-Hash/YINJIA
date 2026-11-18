SET NOCOUNT ON;
SELECT (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.qc_insp_rec_detail') AND name LIKE N'结果%') AS 结果列数_物理列,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code=N'QC_INSP_REC' AND place=N'detail' AND label LIKE N'结果%') AS 结果字段数,
       (SELECT seq FROM yj_field WHERE panel_code=N'QC_INSP_REC' AND label=N'单项判定' AND place=N'detail') AS 单项判定seq,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code=N'QC_INSP_REC' AND label=N'结果列数') AS 结果列数字段,
       (SELECT COUNT(*) FROM dbo.qc_insp_rec WHERE [结果列数]=5) AS 单数_列数5,
       (SELECT COUNT(*) FROM yj_translation WHERE scope=N'field' AND ref_key LIKE N'结果%') AS 译名条数;
EXEC sp_help N'qc_insp_rec';
