/* ============================================================================
 * migrate-qc-insp-rec-verdict-stdlib-20261111.sql
 * 检验报告「检验结论」改标准库(只要 合格 / 不合格,去掉 特采)
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-11 第二轮):
 *   「只要合格和不合格,没有特采。还有下面的直接设计成标准库的形式就可以。先有内容。」
 *
 * 现状:「检验结论」是**下拉框**,候选取自 yj_field.dict_sql 里写死的一段 VALUES
 *   (特采 / 合格 / 不合格)。用户要的形态与「处理意见」「检验项」一致 —— **标准库**,
 *   条目在 yj_std_lib 里维护(可增删、可停用),候选先播 合格 / 不合格 两条。
 *
 * 本脚本(幂等,两账套执行):
 *   ① 检验结论(query + header 两行)data_type → 标准库、dict_sql → qc.insp_verdict;
 *   ② yj_std_lib 播 2 条:合格 / 不合格(库为空才播,不复活用户删过的条目);
 *   ③ 译名兜底:合格 / 不合格 属数据键(不翻译);此处只补「标准库」相关无内容。
 *
 * ⚠ 历史值不动:老单上若曾写过「特采」或整段文字描述,纸面照原值回显
 *   (前端 el-select 带 allow-create,值不在候选里也能显示/保留)。
 *
 * 配套前端(QcInspRecSheet.vue):检验结论标签旁加「⧉ 标准库维护」,与处理意见同款。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---- ① 检验结论:下拉框 → 标准库 ---- */
UPDATE yj_field
   SET data_type = N'标准库', dict_sql = N'qc.insp_verdict'
 WHERE panel_code = N'QC_INSP_REC' AND label = N'检验结论';
PRINT N'[字段] QC_INSP_REC.检验结论 → 标准库 qc.insp_verdict(query + header)';
GO

/* ---- ② 标准库条目:合格 / 不合格(库为空才播) ---- */
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'qc.insp_verdict' AND ISNULL(asp_cancel, 'N') <> 'Y')
BEGIN
    INSERT INTO yj_std_lib (lib_code, item_code, content, seq, enabled, asp_user1)
    VALUES (N'qc.insp_verdict', N'默认', N'合格', 10, 1, N'migration'),
           (N'qc.insp_verdict', N'默认', N'不合格', 20, 1, N'migration');
    PRINT N'[标准库] qc.insp_verdict 播种 2 条(合格 / 不合格)';
END
ELSE PRINT N'[标准库] qc.insp_verdict 已有条目,跳过播种';
GO

/* ---- ③ 自检 ---- */
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND label = N'检验结论'
      AND data_type = N'标准库' AND dict_sql = N'qc.insp_verdict') <> 2
    RAISERROR(N'检验结论(query+header)未全部切到标准库 qc.insp_verdict', 16, 1);
IF (SELECT COUNT(*) FROM yj_std_lib WHERE lib_code = N'qc.insp_verdict' AND enabled = 1 AND ISNULL(asp_cancel,'N') <> 'Y') < 2
    RAISERROR(N'qc.insp_verdict 条目不足 2 条', 16, 1);

SELECT label, place, data_type, dict_sql, required
  FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND label = N'检验结论' ORDER BY place;
SELECT lib_code, content, enabled FROM yj_std_lib WHERE lib_code = N'qc.insp_verdict' ORDER BY seq;
PRINT N'✅ 检验结论已改为标准库(合格 / 不合格,无特采)';
GO
