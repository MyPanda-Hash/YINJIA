/* ============================================================
   migrate-material-out-wo-line-query-col-20261015.sql — 2026-10-15
   材料出库单(领料单)列表补「工单行号」列 —— 让用户在列表上就能分辨是哪一行

   背景(用户口径 2026-10-15):「就是当前的**工单号加工单行号**作为标识,每个独立进行」
   +「工单号+工单行号 就为当前的**一个新的单**的模式」。
   转领料单已按该口径出单(一个标识 ⇒ 一张新单),单头也确实写了「工单行号」——
   但该字段 `place='header'`(**只在表单页显示**),列表页看不到 ⇒
   同一工单多行转出的多张领料单在**列表**上长得一样,用户仍分不出哪张是哪一行。

   处置(纯元数据,零改表):把 MATERIAL_OUT 的「工单行号」place 由 `header`
   改为 `query,header`(列表 + 表单都显示),seq 保持 22 紧随 加工单号 20。

   ⚠ 只改 place,不动 col_name/label/seq/editable —— 数据键与写入路径完全不变。
   ⚠ 按规范 §4.2「守卫要跨过本链后续改名/删列」:这里同时检查**物理列仍在**
     (COL_LENGTH 非空)才改,避免列被后续脚本删掉后本脚本重跑挂空。

   幂等可重跑;两账套均执行(先正式、后测试)。
   ============================================================ */
SET NOCOUNT ON;
GO
IF COL_LENGTH(N'dbo.bd_material_out', N'工单行号') IS NOT NULL
   AND EXISTS (SELECT 1 FROM yj_field
               WHERE panel_code = 'MATERIAL_OUT' AND label = N'工单行号'
                 AND RTRIM(place) = N'header')
BEGIN
    UPDATE yj_field SET place = N'query,header'
     WHERE panel_code = 'MATERIAL_OUT' AND label = N'工单行号' AND RTRIM(place) = N'header';
    PRINT N'MATERIAL_OUT.工单行号 已改为列表+表单显示(query,header)';
END
ELSE
    PRINT N'MATERIAL_OUT.工单行号 已是列表可见(或物理列不存在),无需变更';
GO
-- 自检:该字段必须存在且 place 含 query
DECLARE @bad int = 0;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND label=N'工单行号') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND label=N'工单行号'
               AND place LIKE N'%query%') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'材料出库单「工单行号」列表可见性自检失败(%d 项)', 16, 1, @bad);
ELSE PRINT N'MATERIAL_OUT.工单行号 列表可见性就绪(幂等)';
GO
