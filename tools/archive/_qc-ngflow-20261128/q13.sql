SELECT TOP 10 r.单据编号 AS recNo, r.来料检验单号, r.物料编码, r.检验结论,
       (SELECT TOP 1 s.shr FROM yj_doc_status s WHERE s.panel_code='QC_INSP_REC' AND s.doc_no=r.单据编号) AS recShr,
       (SELECT TOP 1 s.shr FROM yj_doc_status s WHERE s.panel_code='QC_INSP' AND s.doc_no=r.来料检验单号) AS inspShr,
       (SELECT TOP 1 x.特采 FROM qc_insp_detail x WHERE x.单据编号=r.来料检验单号 AND x.物料编码=r.物料编码) AS tc,
       (SELECT TOP 1 x.不合格数量 FROM qc_insp_detail x WHERE x.单据编号=r.来料检验单号 AND x.物料编码=r.物料编码) AS ng
FROM qc_insp_rec r
WHERE ISNULL(r.asp_cancel,'N') <> 'Y' AND ISNULL(r.来料检验单号,N'') <> N''
ORDER BY r.id DESC;
