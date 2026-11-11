/* ============================================================================
 * migrate-qc-insp-rec-foot-required-20261111.sql
 * 检验数据记录:表尾按模板排布 + 处理意见改标准库 + 三处必填
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-11):
 *   「红框四项修改成这个图片上的排列形式,处理意见做成标准库的形式。
 *     还有检验结论和处理意见是必填。单项判定也是必填。」
 *
 * 模板(YJ-QR-96 检验结果区底部)是**两行两对**:
 *   第 1 行:检验人 | 值 | 检验结论 | 值
 *   第 2 行:审核人 | 值 | 处理意见 | 值
 * 原来代码是「检验结论」「处理意见」各占整行、签名行单独一行(三行)。
 * 版式改动在前端(QcInspRecSheet.vue 的 QC_INSP_REC_FOOT_ROWS);本脚本只管元数据:
 *
 *   ① 处理意见:文本 → **标准库**(data_type=标准库,dict_sql=qc.insp_disposal),
 *      并在 yj_std_lib 播 7 条常用处理意见(可在界面上增删);
 *   ② 必填:检验结论(表头)/ 处理意见(表头)/ 单项判定(明细)三处 required=1
 *      —— 服务端 ButtonService.ensureRequiredFilled / ensureDetailRequiredFilled 会拦;
 *   ③ 译名兜底:处理意见 / 检验结论 / 单项判定 的 en(已有则跳过)。
 *
 * 幂等(按 panel_code+label+place 窄条件更新);两账套均执行。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---- ① 处理意见 → 标准库 ---- */
UPDATE yj_field
   SET data_type = N'标准库', dict_sql = N'qc.insp_disposal'
 WHERE panel_code = N'QC_INSP_REC' AND label = N'处理意见' AND place = N'header';
PRINT N'[字段] QC_INSP_REC.处理意见 → 标准库(qc.insp_disposal)';
GO

/* ---- ② 标准库条目(只在库为空时播种,避免复活用户删过的条目) ---- */
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'qc.insp_disposal' AND ISNULL(asp_cancel, 'N') <> 'Y')
BEGIN
    INSERT INTO yj_std_lib (lib_code, item_code, content, seq, enabled, asp_user1)
    VALUES (N'qc.insp_disposal', N'默认', N'同意入库', 10, 1, N'migration'),
           (N'qc.insp_disposal', N'默认', N'让步接收', 20, 1, N'migration'),
           (N'qc.insp_disposal', N'默认', N'挑选使用', 30, 1, N'migration'),
           (N'qc.insp_disposal', N'默认', N'退货处理', 40, 1, N'migration'),
           (N'qc.insp_disposal', N'默认', N'返工重检', 50, 1, N'migration'),
           (N'qc.insp_disposal', N'默认', N'报废处理', 60, 1, N'migration'),
           (N'qc.insp_disposal', N'默认', N'待品质部评审', 70, 1, N'migration');
    PRINT N'[标准库] qc.insp_disposal 播种 7 条';
END
ELSE PRINT N'[标准库] qc.insp_disposal 已有条目,跳过播种';
GO

/* ---- ③ 三处必填 ---- */
UPDATE yj_field SET required = 1
 WHERE panel_code = N'QC_INSP_REC' AND label = N'检验结论' AND place = N'header';
UPDATE yj_field SET required = 1
 WHERE panel_code = N'QC_INSP_REC' AND label = N'处理意见' AND place = N'header';
UPDATE yj_field SET required = 1
 WHERE panel_code = N'QC_INSP_REC' AND label = N'单项判定' AND place = N'detail';
PRINT N'[必填] 检验结论 / 处理意见 / 单项判定 → required=1';
GO

/* ---- ④ 译名兜底 ---- */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'处理意见' AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'处理意见', N'en', N'Disposition', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'检验结论' AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'检验结论', N'en', N'Inspection Verdict', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'单项判定' AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'单项判定', N'en', N'Item Judgement', N'manual');
GO

/* ---- ⑤ 自检 ---- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND label = N'处理意见' AND place = N'header'
                 AND data_type = N'标准库' AND dict_sql = N'qc.insp_disposal')
    RAISERROR(N'处理意见 未切换成标准库 qc.insp_disposal', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_INSP_REC'
      AND ((label = N'检验结论' AND place = N'header') OR (label = N'处理意见' AND place = N'header')
        OR (label = N'单项判定' AND place = N'detail')) AND required = 1) <> 3
    RAISERROR(N'必填未落齐(检验结论/处理意见/单项判定)', 16, 1);
IF (SELECT COUNT(*) FROM yj_std_lib WHERE lib_code = N'qc.insp_disposal' AND enabled = 1 AND ISNULL(asp_cancel,'N') <> 'Y') = 0
    RAISERROR(N'qc.insp_disposal 没有任何启用条目', 16, 1);

SELECT label, place, data_type, ISNULL(dict_sql, N'') AS dict_sql, required
  FROM yj_field
 WHERE panel_code = N'QC_INSP_REC' AND label IN (N'检验结论', N'处理意见', N'单项判定')
 ORDER BY place, label;
SELECT lib_code, COUNT(*) AS 条目数 FROM yj_std_lib WHERE lib_code = N'qc.insp_disposal' GROUP BY lib_code;

PRINT N'✅ 检验报告表尾元数据就绪(处理意见=标准库;检验结论/处理意见/单项判定=必填)';
GO
