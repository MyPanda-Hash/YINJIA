-- migrate-qc-insp-req-drop-custom-tab.sql — 下线「来料检验要求」里的「自定义检验要求」页签(已独立成新面板)
--
-- 用户口径(2026-10-04 第四轮):「现在将那个自定义的表删除,然后多增加一个来料检验要求的面版,
--   下面有这几个切换表(而且都是自定义的)…只是为了不要太多的表都集中在一个面版才拆成两个」
-- ⇒ 「自定义检验要求」页签从 QC_INSP_REQ 下线,内容迁到新面板 QC_INSP_REQ_SERIES
--   (见 migrate-qc-insp-req-series.sql:10 张全自定义表)。
--
-- 本脚本做四件事(幂等):
--   ① 物料类别 词表去掉第 8 值「自定义检验要求」(整串重建 ⇒ 只剩 7 张固定表);
--   ② 该页签上绑定的动态字段 **退绑**(删 yj_field 行;备用列数据保留不动 —— 与"停用"同口径);
--   ③ 该页签的数据行 **软删**(asp_cancel='Y'):整表 upsert 面板里,页签没了就没有界面可以再编辑它,
--      留着会让"缺席行=已删除"的账对不上;软删可回溯,不是物理删除;
--   ④ 备用141..160 的列注明改为「预留(原自定义检验要求扩展池,该表已下线)」,不再标成某个页签的池。
--
-- ⚠ 顺序:本脚本必须在 migrate-qc-insp-req-series.sql **之后**执行(那一步先建好新面板与新表);
--   两个账套都要跑。执行前建议按下述自检查一眼影响行数(正式库预期:字段 1 个、数据 2 行)。
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库时不得被切走)
GO
PRINT N'--- 执行前:将被退绑的字段 ---';
SELECT id, col_name, label, tab_key FROM yj_field
 WHERE panel_code = 'QC_INSP_REQ' AND tab_key = N'自定义检验要求' ORDER BY seq, id;
PRINT N'--- 执行前:将被软删的数据行 ---';
SELECT id, 物料编号, ISNULL(asp_cancel,'N') AS 作废 FROM qc_insp_req
 WHERE 物料类别 = N'自定义检验要求' AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id;
GO

-- ═════════════ ① 词表去掉第 8 值 ═════════════
DECLARE @dict nvarchar(500) = N'SELECT v FROM (VALUES (N''折叠棉''),(N''垫片''),(N''无纺布''),(N''网套''),(N''PP管''),(N''端盖''),(N''PP棉'')) AS t(v)';
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_INSP_REQ' AND col_name = N'物料类别' AND ISNULL(dict_sql, N'') LIKE N'%自定义检验要求%')
BEGIN
  UPDATE yj_field SET dict_sql = @dict WHERE panel_code = 'QC_INSP_REQ' AND col_name = N'物料类别';
  PRINT N'[OK] 物料类别 词表已回到 7 张固定表(去掉「自定义检验要求」)';
END
ELSE PRINT N'[跳过] 词表已不含「自定义检验要求」';
GO

-- ═════════════ ② 退绑该页签的动态字段(承载列的数据按"停用"口径保留) ═════════════
DECLARE @ret TABLE (label nvarchar(200), col nvarchar(20));
INSERT INTO @ret SELECT label, col_name FROM yj_field WHERE panel_code = 'QC_INSP_REQ' AND tab_key = N'自定义检验要求';
DELETE FROM yj_field WHERE panel_code = 'QC_INSP_REQ' AND tab_key = N'自定义检验要求';
PRINT N'[OK] 退绑动态字段 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 个(其承载列的数据保留不动)';
INSERT INTO yj_ext_bind_log (panel_code, label, col_name, action, op_by, detail)
SELECT N'QC_INSP_REQ', label, col, N'retire', N'migration',
       N'「自定义检验要求」页签拆成独立面板 QC_INSP_REQ_SERIES,原字段整体退绑'
  FROM @ret;
GO

-- ═════════════ ③ 软删该页签的数据行 ═════════════
UPDATE qc_insp_req SET asp_cancel = 'Y'
 WHERE 物料类别 = N'自定义检验要求' AND ISNULL(asp_cancel, 'N') <> 'Y';
PRINT N'[OK] 已软删该页签数据行 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行(asp_cancel=Y,可回溯)';
GO

-- ═════════════ ④ 备用141..160 的注明改为"已下线预留" ═════════════
DECLARE @i int = 141, @c nvarchar(20), @d nvarchar(300);
WHILE @i <= 160
BEGIN
  SET @c = N'备用' + CAST(@i AS nvarchar(3));
  SET @d = N'预留(原自定义检验要求扩展池 ' + CAST(@i - 140 AS nvarchar(3)) + N'/20;该页签已拆成独立面板 QC_INSP_REQ_SERIES)';
  IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('qc_insp_req')
             AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('qc_insp_req'), @c, 'ColumnId') AND ep.name = 'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_req', N'COLUMN', @c;
  SET @i = @i + 1;
END
PRINT N'[OK] 备用141..160 注明已改为已下线预留';
GO

-- ═════════════ 自检 ═════════════
SELECT N'物料类别词表' AS k, dict_sql FROM yj_field WHERE panel_code = 'QC_INSP_REQ' AND col_name = N'物料类别';
SELECT N'仍挂在旧页签的字段' AS k, COUNT(*) AS n FROM yj_field WHERE panel_code = 'QC_INSP_REQ' AND tab_key = N'自定义检验要求';
SELECT N'该页签存活行' AS k, COUNT(*) AS n FROM qc_insp_req WHERE 物料类别 = N'自定义检验要求' AND ISNULL(asp_cancel,'N') <> 'Y';
SELECT N'该页签已作废行' AS k, COUNT(*) AS n FROM qc_insp_req WHERE 物料类别 = N'自定义检验要求' AND ISNULL(asp_cancel,'N') = 'Y';
SELECT N'剩余扩展位(1..140 仍按 7 张表分段)' AS k, COUNT(*) AS n FROM sys.columns WHERE object_id = OBJECT_ID('qc_insp_req') AND name LIKE N'备用%';
GO
