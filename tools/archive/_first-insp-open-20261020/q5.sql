SELECT f.label AS 字段, f.place AS 位置, f.col_name AS 物理列, f.required AS 必填, f.hidden AS 隐藏, f.seq AS 序
FROM dbo.yj_field f
WHERE f.panel_code=N'QC_FIRST_INSP' AND f.label IN (N'工单号',N'工单行号',N'完工状态',N'产品编码')
ORDER BY f.seq
GO
