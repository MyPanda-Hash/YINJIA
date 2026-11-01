SET NOCOUNT ON;
INSERT INTO yj_form_approval (panel_code,form_no,action,result,node_no,operator,opinion,create_time)
SELECT 'QC_INSP', h.单据编号, 'AUDIT', 'APPROVED', 1, N'冯敏',
       CASE WHEN h.总结论=N'合格' THEN N'来料检验完成，同意入库' ELSE N'来料检验完成，不合格行退货' END,
       CONVERT(datetime, RTRIM(h.单据日期)+' 12:00:00')
FROM qc_insp h
WHERE NOT EXISTS (SELECT 1 FROM yj_form_approval a WHERE a.panel_code='QC_INSP' AND a.form_no=h.单据编号);
GO
INSERT INTO yj_form_approval (panel_code,form_no,action,result,node_no,operator,opinion,create_time)
SELECT 'QC_INSP_REC', h.单据编号, 'AUDIT', 'APPROVED', 1, N'冯敏', N'检验数据记录审核',
       CONVERT(datetime, RTRIM(h.单据日期)+' 12:00:00')
FROM qc_insp_rec h
WHERE NOT EXISTS (SELECT 1 FROM yj_form_approval a WHERE a.panel_code='QC_INSP_REC' AND a.form_no=h.单据编号);
GO
INSERT INTO yj_form_approval (panel_code,form_no,action,result,node_no,operator,opinion,create_time)
SELECT 'QC_CATALOG', h.单据编号, 'AUDIT', 'APPROVED', 1, N'冯敏', N'检验目录审核',
       CONVERT(datetime, RTRIM(h.单据日期)+' 12:00:00')
FROM qc_catalog h
WHERE NOT EXISTS (SELECT 1 FROM yj_form_approval a WHERE a.panel_code='QC_CATALOG' AND a.form_no=h.单据编号);
GO
SELECT panel_code,action,result,COUNT(*) n FROM yj_form_approval
WHERE panel_code IN ('QC_INSP','QC_INSP_REC','QC_CATALOG','QC_RETURN')
GROUP BY panel_code,action,result ORDER BY panel_code,action;
GO
