SELECT m.name AS 列名 FROM sys.columns m WHERE m.object_id=OBJECT_ID('dbo.yj_field') ORDER BY m.column_id
GO
SELECT panel_code, label, [data_type], dict_sql FROM yj_field WHERE label IN (N'单项判定', N'严重程度', N'最终处理结果', N'检验结论', N'总结论', N'检验类型') ORDER BY panel_code, label
