-- ============================================================================
-- 回填批次号一律只读(2026-09-23 用户口径:「需要回填的批次号都不可以编辑」)
--
-- 背景:批次号在**采购入库审核**时才分配并回填(BatchService.assignNoAndBackfill →
--   检验单 / 送料暂收单 / 检验目录 / 检验数据记录),录入阶段不允许手填;
--   报废/退货等记录面板的批号同为下游回填值。
--
-- 覆盖(据 yj_field 实测清单):
--   QC_INSP   来料检验单     批次号(header/detail) + 批次键(隐藏键)
--   QC_RECV   送料暂收单     批次号(header/detail) + 批次键
--   QC_RETURN 退货单         批次号(header/detail)
--   QC_DISPOSAL 报废/处置    批号
--   QC_LYB / QC_SCP / QC_BHZ 物料批次;QC_JJF 批次号;QC_SCY 产品/物料批次
--   QC_TC_IN  特采入库       批次号 + 批次键(已是 0,此处兜底)
--   QC_CATALOG 检验目录 批次号、QC_INSP_REC 检验数据记录 物料批次(各自迁移已置 0,兜底)
--
-- **不动**出库/生产链的批号:MATERIAL_OUT / OTHER_OUT / OUTSOURCE_ISSUE 等的批号是
--   扫码/人工录入(出库必须扫),生产链(MANU_ORDER 等)的批号由计划录入 —— 都不是回填值。
--
-- 说明:前端纸面组件(如 QcInspRecSheet 的 locked)另有渲染层控制;
--       本脚本统一元数据,使通用表单/内联编辑等路径也不能改这些字段。
--       程序化回填不经过 editable 校验,不受影响。
-- 幂等:重复执行结果一致。
-- ============================================================================
DECLARE @t TABLE (panel_code nvarchar(60), label nvarchar(120));
INSERT INTO @t (panel_code, label) VALUES
  (N'QC_INSP', N'批次号'), (N'QC_INSP', N'批次键'),
  (N'QC_RECV', N'批次号'), (N'QC_RECV', N'批次键'),
  (N'QC_RETURN', N'批次号'),
  (N'QC_DISPOSAL', N'批号'),
  (N'QC_LYB', N'物料批次'),
  (N'QC_SCP', N'物料批次'),
  (N'QC_BHZ', N'物料批次'),
  (N'QC_JJF', N'批次号'),
  (N'QC_SCY', N'产品/物料批次'),
  (N'QC_TC_IN', N'批次号'), (N'QC_TC_IN', N'批次键'),
  (N'QC_CATALOG', N'批次号'),
  (N'QC_INSP_REC', N'物料批次');

UPDATE f SET f.editable = 0
FROM yj_field f JOIN @t t ON t.panel_code = f.panel_code AND t.label = f.label
WHERE ISNULL(f.editable, 1) <> 0;
GO

-- 自检:下列每行的 editable 应全为 0
SELECT '自检' AS k, f.panel_code, f.place, f.seq, f.label, f.editable, f.required
FROM yj_field f
WHERE f.label IN (N'批次号', N'批次键', N'批号', N'物料批次', N'产品/物料批次')
  AND f.panel_code LIKE N'QC[_]%'
ORDER BY f.panel_code, f.place, f.seq;
GO
