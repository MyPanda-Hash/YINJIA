SELECT 批次号, COUNT(*) AS 孤儿检验单数, COUNT(DISTINCT 报工单号) AS 涉及报工单号数,
       SUM(CASE WHEN asp_cancel='Y' THEN 1 ELSE 0 END) AS 废单, SUM(CASE WHEN asp_cancel<>'Y' THEN 1 ELSE 0 END) AS 活单,
       STRING_AGG(来源表 + N'/' + 单据编号 + N'->' + 报工单号, N' | ') AS 明细
FROM (
  SELECT N'qc_mold_insp_head' AS 来源表, h.单据编号, h.报工单号, h.批次号, h.asp_cancel FROM qc_mold_insp_head h
    WHERE h.报工单号 IS NOT NULL AND LTRIM(RTRIM(h.报工单号))<>'' AND NOT EXISTS (SELECT 1 FROM scjl s WHERE s.报工单号=h.报工单号)
  UNION ALL
  SELECT N'qc_cut_insp_head', h.单据编号, h.报工单号, h.批次号, h.asp_cancel FROM qc_cut_insp_head h
    WHERE h.报工单号 IS NOT NULL AND LTRIM(RTRIM(h.报工单号))<>'' AND NOT EXISTS (SELECT 1 FROM scjl s WHERE s.报工单号=h.报工单号)
  UNION ALL
  SELECT N'qc_asm_insp_head', h.单据编号, h.报工单号, h.批次号, h.asp_cancel FROM qc_asm_insp_head h
    WHERE h.报工单号 IS NOT NULL AND LTRIM(RTRIM(h.报工单号))<>'' AND NOT EXISTS (SELECT 1 FROM scjl s WHERE s.报工单号=h.报工单号)
) z GROUP BY 批次号 ORDER BY 批次号;