-- _health-orphan.sql  只读:三张检验单头的「报工单号」在 scjl 是否存在(孤儿引用)
SELECT 来源表, COUNT(*) AS 总行数,
       SUM(CASE WHEN 报工单号 IS NOT NULL AND LTRIM(RTRIM(报工单号)) <> '' THEN 1 ELSE 0 END) AS 报工单号非空行
FROM (
  SELECT N'qc_mold_insp_head' AS 来源表, 报工单号 FROM qc_mold_insp_head
  UNION ALL SELECT N'qc_cut_insp_head', 报工单号 FROM qc_cut_insp_head
  UNION ALL SELECT N'qc_asm_insp_head', 报工单号 FROM qc_asm_insp_head
) z GROUP BY 来源表 ORDER BY 来源表;
GO
SELECT N'合计' AS 来源表, COUNT(*) AS 孤儿总数,
       SUM(CASE WHEN asp_cancel <> 'Y' THEN 1 ELSE 0 END) AS 其中非废单,
       SUM(CASE WHEN asp_cancel = 'Y' THEN 1 ELSE 0 END) AS 其中废单
FROM (
  SELECT h.报工单号, h.asp_cancel FROM qc_mold_insp_head h
    WHERE h.报工单号 IS NOT NULL AND LTRIM(RTRIM(h.报工单号)) <> ''
      AND NOT EXISTS (SELECT 1 FROM scjl s WHERE s.报工单号 = h.报工单号)
  UNION ALL
  SELECT h.报工单号, h.asp_cancel FROM qc_cut_insp_head h
    WHERE h.报工单号 IS NOT NULL AND LTRIM(RTRIM(h.报工单号)) <> ''
      AND NOT EXISTS (SELECT 1 FROM scjl s WHERE s.报工单号 = h.报工单号)
  UNION ALL
  SELECT h.报工单号, h.asp_cancel FROM qc_asm_insp_head h
    WHERE h.报工单号 IS NOT NULL AND LTRIM(RTRIM(h.报工单号)) <> ''
      AND NOT EXISTS (SELECT 1 FROM scjl s WHERE s.报工单号 = h.报工单号)
) z;
GO
SELECT 来源表, 单据编号, 报工单号, 工单号, 工单行号, 批次号, asp_cancel AS 作废标记, 单据状态
FROM (
  SELECT N'qc_mold_insp_head' AS 来源表, h.单据编号, h.报工单号, h.工单号, h.工单行号, h.批次号, h.asp_cancel, h.单据状态
    FROM qc_mold_insp_head h
    WHERE h.报工单号 IS NOT NULL AND LTRIM(RTRIM(h.报工单号)) <> ''
      AND NOT EXISTS (SELECT 1 FROM scjl s WHERE s.报工单号 = h.报工单号)
  UNION ALL
  SELECT N'qc_cut_insp_head', h.单据编号, h.报工单号, h.工单号, h.工单行号, h.批次号, h.asp_cancel, h.单据状态
    FROM qc_cut_insp_head h
    WHERE h.报工单号 IS NOT NULL AND LTRIM(RTRIM(h.报工单号)) <> ''
      AND NOT EXISTS (SELECT 1 FROM scjl s WHERE s.报工单号 = h.报工单号)
  UNION ALL
  SELECT N'qc_asm_insp_head', h.单据编号, h.报工单号, h.工单号, h.工单行号, h.批次号, h.asp_cancel, h.单据状态
    FROM qc_asm_insp_head h
    WHERE h.报工单号 IS NOT NULL AND LTRIM(RTRIM(h.报工单号)) <> ''
      AND NOT EXISTS (SELECT 1 FROM scjl s WHERE s.报工单号 = h.报工单号)
) z ORDER BY 来源表, 单据编号;
GO
-- 反过来:scjl 里是否存在这些报工单号但被删/作废的痕迹(按 批次号 20261006 交叉看)
SELECT s.报工单号, s.批次号, s.asp_cancel AS scjl作废标记, COUNT(*) AS 行数
FROM scjl s WHERE s.批次号 LIKE N'%20261006%' GROUP BY s.报工单号, s.批次号, s.asp_cancel ORDER BY 1;
