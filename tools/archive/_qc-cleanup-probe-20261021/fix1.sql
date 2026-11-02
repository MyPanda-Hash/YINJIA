SET NOCOUNT ON;
INSERT INTO yj_doc_status (panel_code,doc_no,shr,shsj,canceled,saved,archived,update_at)
SELECT 'QC_INSP_REC', r.单据编号, N'冯敏',
       CONVERT(datetime, RTRIM(r.单据日期) + ' 12:00:00'),
       'N','Y','N', SYSDATETIME()
FROM qc_insp_rec r
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='QC_INSP_REC' AND s.doc_no=r.单据编号);
GO
UPDATE r SET 检验单号 = l.source_form_no
FROM qc_return r
JOIN form_flow_link l ON l.target_panel_code='QC_RETURN' AND l.target_form_no=r.单据编号
WHERE l.source_panel_code='QC_INSP' AND ISNULL(r.检验单号,'')='';
GO
UPDATE d SET 送检数量 = d.退货数量
FROM qc_return_detail d WHERE d.送检数量 IS NULL;
GO
SELECT 'rec status' k, COUNT(*) n FROM yj_doc_status WHERE panel_code='QC_INSP_REC' AND shr=N'冯敏'
UNION ALL SELECT 'return insp no', COUNT(*) FROM qc_return WHERE ISNULL(检验单号,'')<>''
UNION ALL SELECT 'return detail sent qty', COUNT(*) FROM qc_return_detail WHERE 送检数量 IS NOT NULL;
GO
