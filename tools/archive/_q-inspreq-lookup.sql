-- _q-inspreq-lookup.sql — 探针:来料检验要求的物料编号口径 vs 检验数据记录物料编码
SET NOCOUNT ON;
PRINT N'① yj_field: QC_INSP_REQ 字段';
SELECT seq, col_name, label, data_type, place, editable, hidden, visible FROM yj_field
 WHERE panel_code='QC_INSP_REQ' ORDER BY place, seq;
GO
PRINT N'② qc_insp_req 物料类别 × 物料编号';
SELECT [物料类别], [物料编号] FROM qc_insp_req WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY [物料类别], id;
GO
PRINT N'③ 检验数据记录的物料编码(近 30)';
SELECT TOP 30 [单据编号], [物料编码], [物料名称] FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
GO
PRINT N'④ 两边口径抽样比对(精确 / 模糊命中)';
SELECT TOP 20 r.[物料编码],
       (SELECT COUNT(*) FROM qc_insp_req q WHERE ISNULL(q.asp_cancel,'N')<>'Y' AND LTRIM(RTRIM(q.[物料编号])) = LTRIM(RTRIM(r.[物料编码]))) AS 精确命中,
       (SELECT COUNT(*) FROM qc_insp_req q WHERE ISNULL(q.asp_cancel,'N')<>'Y' AND q.[物料编号] LIKE N'%' + r.[物料编码] + N'%') AS 模糊命中
  FROM qc_insp_rec r WHERE ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(r.[物料编码],N'')<>N'' ORDER BY r.id DESC;
GO
PRINT N'⑤ 去重计数';
SELECT (SELECT COUNT(DISTINCT LTRIM(RTRIM([物料编号]))) FROM qc_insp_req WHERE ISNULL(asp_cancel,'N')<>'Y') AS 要求物料数,
       (SELECT COUNT(DISTINCT LTRIM(RTRIM([物料编码]))) FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y') AS 记录物料数,
       (SELECT COUNT(*) FROM qc_insp_req WHERE ISNULL(asp_cancel,'N')<>'Y') AS 要求行数;
GO
