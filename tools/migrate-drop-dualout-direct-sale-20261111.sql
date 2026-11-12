-- ============================================================================================
-- migrate-drop-dualout-direct-sale-20261111.sql
-- 下线「切炭直销(裁切双出口)」功能 —— 2026-11-11 用户口径:「没有这个路线直接删除掉,不要实现了」
--
-- 背景:2026-09-10 上线的「裁切双出口」= 切炭报工单填「直销数量」→ 审核时自动生成产成品入库单
--   并审核入账(ButtonService.dualOutFinishIn)/ 弃审时自动生成红字(负数量)入库单冲回
--   (dualOutRedReverse);报工单面板(WO_REPORT/WO_REPORT_LIST)登记「直销数量」可填列。
--   用户 2026-11-11 确认生产上**没有这条工艺路线/业务**,要求删掉实现。
--
-- 本脚本处理「数据/元数据」这一半(代码侧同批已删:双出口两个方法 + 两个调用点 +
--   WoReportService 里「直销数量≤报工数量」校验与 dual_qty 取数 + 前端 i18n 词条保留未用):
--   ① yj_field:删除 WO_REPORT / WO_REPORT_LIST 的「直销数量」字段行 ⇒ 表单/明细列不再出现;
--   ② yj_translation:删除该字段的中文/英文译名(含历史 ref_key「直销数量(切炭)」)。
--
-- ⚠ 物理列**保留不删**:scjl.[直销数量] / wo_report.[直销数量] / wo_stage_report.dual_out_qty /
--   pr_cut_daily.[直销数量]。理由:
--     · scjl / wo_report 属「冻结登记遗留表」,wo_stage_report / pr_cut_daily 已停用;
--     · 全库非零数据 0 条(正式库 1163 条报工行、直销数量全 NULL/0),代码 0 引用;
--     · DROP COLUMN 会牵动《数据库表清单》列数、历史导入脚本与冻结表红线。
--   ⇒ 按「功能下线」处理;如后续要彻底删列,另开一次性迁移并在《部署台账》记录。
--
-- 幂等:DELETE 按条件删,重复执行影响 0 行;末尾自检「WO_REPORT 不再有该字段」,失败即 RAISERROR。
-- 两账套都要执行(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
-- ============================================================================================
SET NOCOUNT ON;

-- ① 译名(含历史 ref_key)
DELETE FROM dbo.yj_translation
 WHERE scope = N'field' AND ref_key IN (N'直销数量', N'直销数量(切炭)');

-- ② 面板字段(报工单 + 报工单列表)
DELETE FROM dbo.yj_field
 WHERE col_name = N'直销数量'
   AND panel_code IN ('WO_REPORT', 'WO_REPORT_LIST');

-- ③ 自检
IF EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = 'WO_REPORT' AND col_name = N'直销数量')
    RAISERROR(N'[FAIL] WO_REPORT 仍残留「直销数量」字段行', 16, 1);
ELSE IF EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = 'WO_REPORT_LIST' AND col_name = N'直销数量')
    RAISERROR(N'[FAIL] WO_REPORT_LIST 仍残留「直销数量」字段行', 16, 1);
ELSE
    RAISERROR(N'[PASS] 切炭直销字段已下架(WO_REPORT/WO_REPORT_LIST);物理列保留(0 非零数据、0 代码引用)', 10, 1);
