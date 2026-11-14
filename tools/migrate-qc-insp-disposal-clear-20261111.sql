/* ============================================================================
 * migrate-qc-insp-disposal-clear-20261111.sql
 * 处理意见标准库:清掉预置样例,只留"手动填写"
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-11):「是下面的处理意见的标准库信息删除干净,不需要先写样例,
 *   自己手动填写就行。」
 *
 * 背景:上一步 migrate-qc-insp-rec-foot-required-20261111.sql 把「处理意见」改成标准库
 * (qc.insp_disposal)时顺手播了 7 条常用样例(同意入库/让步接收/…)。
 * 用户不要样例 —— 这个库先空着,现场在纸面直接输入,**想沉淀再往库里加**
 * (「⧉ 标准库维护」或 yj_std_lib)。
 *
 * 只删**本仓库播种的那些行**(asp_user1='migration' 且 content 在那 7 条名单里),
 * 不碰用户后来自己加/改的条目;幂等,重复执行无副作用。两账套均执行。
 *
 * ⚠ 库清空后前端仍是「标准库 + allow-create」下拉:候选为空,直接敲字即可落库;
 *   已存单据上的处理意见是**数据值**,不受本脚本影响。
 * ========================================================================== */

SET NOCOUNT ON;
GO

DELETE FROM yj_std_lib
 WHERE lib_code = N'qc.insp_disposal'
   AND ISNULL(asp_user1, N'') = N'migration'
   AND content IN (N'同意入库', N'让步接收', N'挑选使用', N'退货处理', N'返工重检', N'报废处理', N'待品质部评审');
PRINT N'[清理] 删除 qc.insp_disposal 预置样例行: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* 仍在库里的条目(用户自己加的)原样保留 */
SELECT N'剩余条目' AS 项, COUNT(*) AS 值
  FROM yj_std_lib WHERE lib_code = N'qc.insp_disposal' AND ISNULL(asp_cancel, 'N') <> 'Y';
SELECT lib_code, content, seq, enabled FROM yj_std_lib
 WHERE lib_code = N'qc.insp_disposal' ORDER BY seq, id;

/* 字段本身仍是标准库(候选为空 = 手填),别被误判成"退回文本" */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND label = N'处理意见'
                 AND place = N'header' AND data_type = N'标准库' AND dict_sql = N'qc.insp_disposal')
    RAISERROR(N'处理意见 不再是标准库 qc.insp_disposal,请检查', 16, 1);

PRINT N'✅ 处理意见标准库已清空(保留标准库形态,现场手填)';
GO
