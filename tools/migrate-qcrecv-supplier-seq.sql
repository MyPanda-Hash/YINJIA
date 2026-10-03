/* ═══════════════════════════════════════════════════════════════════════════════
   migrate-qcrecv-supplier-seq.sql — QC_RECV 表头「供应商」seq 归位(45,紧跟供应商代码 40)
   背景(2026-09-28 服务器实战事故):生单表头映射旧逻辑按 seq 先到先得、上限 7,
     服务器 QC_RECV 的「供应商」(seq 50,前面有 金额/税额/总金额 41-43)被挤出映射窗口,
     暂收→检验 生单丢供应商名称(供应商代码 seq 40 靠前所以能过)。
     服务器已手工 UPDATE seq=45 应急;本脚本把该修复固化进链,防止环境重建后复发
     (开发两账套此前未做此修复,执行后三库一致)。
     配套代码修复(同提交):PanelConfigService 表头映射改两轮收集(可见优先)+上限 12,
     本脚本自此仅为顺序整洁,不再是功能依赖。
   幂等:可重复执行。两账套均执行。
   ═══════════════════════════════════════════════════════════════════════════════ */
SET NOCOUNT ON;
GO
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_RECV' AND col_name = N'供应商' AND place LIKE '%header%')
BEGIN
    DECLARE @seq int = (SELECT TOP 1 seq FROM yj_field WHERE panel_code = 'QC_RECV' AND col_name = N'供应商' AND place LIKE '%header%');
    UPDATE yj_field SET seq = 45
     WHERE panel_code = 'QC_RECV' AND col_name = N'供应商' AND place LIKE '%header%' AND seq <> 45;
    PRINT N'migrate-qcrecv-supplier-seq 完成:供应商 seq=' + CAST(@seq AS varchar(10)) + N' → 45';
END
ELSE
    PRINT N'migrate-qcrecv-supplier-seq 跳过:QC_RECV 表头无 供应商 字段行(环境血统不符,人工核对)';
GO
