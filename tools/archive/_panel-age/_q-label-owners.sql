SET NOCOUNT ON;
SELECT 'LABEL_OWNERS' AS k, f.label, f.panel_code, f.col_name FROM yj_field f
WHERE f.label IN (N'外部单据号',N'需求日期',N'自动生入库单',N'建议供应商',N'收货人',N'请购人',N'委外加工单号',N'是否带票')
ORDER BY f.label, f.panel_code;
GO
