SET NOCOUNT ON;
PRINT N'=== 候选字段标签的现有译名(en) ===';
;WITH want(lbl) AS (
  SELECT N'单据日期' UNION ALL SELECT N'检验日期' UNION ALL SELECT N'检验数据记录单号' UNION ALL SELECT N'来料检验单号'
  UNION ALL SELECT N'来料检验单行号' UNION ALL SELECT N'检验状态' UNION ALL SELECT N'是否合格' UNION ALL SELECT N'检测物料类别'
  UNION ALL SELECT N'物料编码' UNION ALL SELECT N'物料名称' UNION ALL SELECT N'物料批次' UNION ALL SELECT N'来料数量'
  UNION ALL SELECT N'供应商' UNION ALL SELECT N'检验人' UNION ALL SELECT N'检验结论' UNION ALL SELECT N'采购订单号'
  UNION ALL SELECT N'采购订单行号' UNION ALL SELECT N'送料暂收单号' UNION ALL SELECT N'送料暂收单行号'
  UNION ALL SELECT N'采购入库单号' UNION ALL SELECT N'采购入库单行号' UNION ALL SELECT N'目录单号' UNION ALL SELECT N'目录行id'
  UNION ALL SELECT N'行号'
)
SELECT w.lbl, ISNULL(t.text, N'(缺)') AS en_text
FROM want w LEFT JOIN yj_translation t ON t.scope='field' AND t.ref_key=w.lbl AND t.locale='en'
ORDER BY w.lbl;
