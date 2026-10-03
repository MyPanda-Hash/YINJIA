SET NOCOUNT ON;
SELECT 'qc.insp_item 标准库' AS t, COUNT(*) AS 总数, SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) AS 启用,
       SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 作废
FROM yj_std_lib WHERE lib_code = N'qc.insp_item';
SELECT TOP 10 'qc.insp_item 样例' AS t, seq, item_code, LEFT(content, 80) AS content前80, enabled
FROM yj_std_lib WHERE lib_code = N'qc.insp_item' ORDER BY seq, id;
SELECT '列中文注明(检验项)' AS t, ep.value AS 注明
FROM sys.extended_properties ep
JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
WHERE c.object_id = OBJECT_ID('qc_insp_rec_detail') AND ep.name = 'MS_Description'
ORDER BY c.column_id;
SELECT 'qc_insp_rec_detail 现存行' AS t, 单据编号, 检验项, 检测标准, 单项判定 FROM qc_insp_rec_detail;
