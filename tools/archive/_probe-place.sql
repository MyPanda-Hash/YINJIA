SET NOCOUNT ON;
SELECT f.place, COUNT(*) AS 行数 FROM yj_field f WHERE f.panel_code = N'RD_INSP_PLAN' GROUP BY f.place;
PRINT '--- RD_INSP_PLAN 全部字段(按 place,seq) ---';
SELECT f.place, f.seq, f.label AS 数据键, f.alias AS 显示别名, f.col_name, f.data_type, f.editable,
       CASE WHEN f.alias IS NOT NULL AND f.alias <> f.label THEN N'★分叉' ELSE N'' END AS 备注
FROM yj_field f WHERE f.panel_code = N'RD_INSP_PLAN' ORDER BY f.place, f.seq;
