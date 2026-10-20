/* ============================================================================
 * migrate-qc-insp-rec-verdict-dropdown-20261019.sql —— 检验结论改「下拉框 + 可自定义补充」
 * ----------------------------------------------------------------------------
 * 用户口径(2026-10-19《10.19 问题》第 2 条):
 *   「检验结论改为'特采,合格,不合格'下拉选择。并且可以让他们自定义补充。」
 *
 * 落地:
 *   ① `yj_field` 里 QC_INSP_REC(检验数据记录 / 检验报告 YJ-QR-96)的「检验结论」**两行**
 *      (place=query 与 place=header 各一行,query 那行是列表页筛选列)从 `文本` 改为 **`下拉框`**,
 *      字典 = 特采 / 合格 / 不合格(存值即中文数据键,ADR-0001:数据键永不随语言变化);
 *   ② 「可以自定义补充」由**前端**承担:QcInspRecSheet 的检验结论控件用
 *      `el-select filterable allow-create` —— 预置三项可选,也能直接敲一个新结论回车落库
 *      (与「检验项」控件的 allow-create 同一套交互)。库侧不需要"自定义值"表:
 *      结论落在 `qc_insp_rec.检验结论`(nvarchar),新值天然可存。
 *   ③ 自检:两行都必须是 下拉框 + 字典里有三个值,否则 RAISERROR。
 *
 * ⚠ 只改元数据,不动任何一行业务数据(现有结论文本原样保留;非字典值仍能正常显示/编辑)。
 * 配套代码(同提交):frontend/src/core/views/QcInspRecSheet.vue(表尾「检验结论」格改下拉)。
 * 两账套均执行,幂等可重跑。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 两行「检验结论」→ 下拉框 + 三项字典 ---------- */
UPDATE yj_field
   SET data_type = N'下拉框',
       dict_sql  = N'SELECT v FROM (VALUES (N''特采''),(N''合格''),(N''不合格'')) AS t(v)'
 WHERE panel_code = N'QC_INSP_REC'
   AND label      = N'检验结论';
PRINT N'[改] QC_INSP_REC.检验结论 行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ② 自检 ---------- */
IF (SELECT COUNT(*) FROM yj_field
     WHERE panel_code = N'QC_INSP_REC' AND label = N'检验结论' AND data_type = N'下拉框') <> 2
    RAISERROR(N'QC_INSP_REC 的「检验结论」应有 2 行(query + header)且都改为下拉框', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field
                WHERE panel_code = N'QC_INSP_REC' AND label = N'检验结论'
                  AND dict_sql LIKE N'%特采%' AND dict_sql LIKE N'%合格%' AND dict_sql LIKE N'%不合格%')
    RAISERROR(N'QC_INSP_REC.检验结论 字典未含 特采/合格/不合格', 16, 1);
PRINT N'✅ 检验结论已改为下拉框(特采/合格/不合格),前端 allow-create 允许自定义补充';
GO
