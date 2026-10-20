SELECT panel_code, label, data_type, dict_sql FROM yj_field WHERE panel_code='QC_INSP_REC' AND label='检验结论'
GO
SELECT N'qc_insp_rec.来料检验单号' AS 项, COUNT(*) AS 有值 FROM qc_insp_rec WHERE ISNULL(来料检验单号,'')<>'' 
UNION ALL SELECT N'qc_insp_rec 总数', COUNT(*) FROM qc_insp_rec
UNION ALL SELECT N'qc_tc_in.检验数据记录单号 有值', COUNT(*) FROM qc_tc_in WHERE ISNULL(检验数据记录单号,'')<>''
UNION ALL SELECT N'qc_tc_in 总数', COUNT(*) FROM qc_tc_in
UNION ALL SELECT N'QC_TC_IN 附件字段', COUNT(*) FROM yj_field WHERE panel_code='QC_TC_IN' AND data_type='附件'
UNION ALL SELECT N'qc_tc_in 附件列', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.qc_tc_in') AND name LIKE N'附件%'
GO
SELECT TOP 8 单据编号, 检验单号, 产品名称, 检验数据记录单号 FROM qc_tc_in ORDER BY id DESC
GO
SELECT TOP 8 单据编号, 物料名称, 来料检验单号 FROM qc_insp_rec ORDER BY id DESC
GO
SELECT panel_code, module_group, category FROM yj_panel WHERE panel_code='QC_TC_IN'
