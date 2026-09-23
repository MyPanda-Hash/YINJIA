-- ============================================================================
-- 检验数据记录(QC_INSP_REC):物料批次 置为不可编辑
--
-- 背景(2026-09-23 用户口径):「检验数据记录的物料批次不可以编辑,需要回填的批次号
--   都不可以编辑」。物料批次是**回填**字段 —— 批次号在采购入库审核时才分配并回填
--   (BatchService.assignNoAndBackfill → 回填检验单/检验目录/本报告),录入阶段不允许手填。
--
-- 前端已同步:QcInspRecSheet.vue 抬头按 locked 渲染为纯文本(qcInspRecColumns.js 真源)。
-- 本脚本同步元数据,避免通用表单/内联编辑等其它路径仍能改这一格。
--   注意:程序化回填(检验目录→本报告跳转预填、后端回填)不经过 editable 校验,不受影响。
--
-- 幂等:重复执行结果一致。
-- ============================================================================
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND label = N'物料批次' AND ISNULL(editable, 1) <> 0)
BEGIN
    UPDATE yj_field SET editable = 0
     WHERE panel_code = N'QC_INSP_REC' AND label = N'物料批次';
    PRINT N'[OK] QC_INSP_REC.物料批次 已置为不可编辑';
END
ELSE
BEGIN
    PRINT N'[SKIP] QC_INSP_REC.物料批次 已是不可编辑(或字段不存在)';
END
GO

-- 自检(结果集:editable 应为 0)
SELECT 'QC_INSP_REC_物料批次' AS k, place, seq, label, col_name, editable, required
FROM yj_field
WHERE panel_code = N'QC_INSP_REC' AND label = N'物料批次';
GO
