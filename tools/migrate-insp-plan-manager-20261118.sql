/* ============================================================================
 * migrate-insp-plan-manager-20261118.sql
 * 出货检验计划表（RD_INSP_PLAN）表单管理人：冯敏 → 崔晓云
 * ----------------------------------------------------------------------------
 * 用户口径（2026-11-18）：「出货控制计划的表单管理员默认写崔晓云」。
 * 与《流程》表行24「柴善银制作组装控制清单 / **崔晓云制作 出货控制计划**」一致。
 *
 * 代码侧：docDefaults 的 RD_INSP_PLAN 默认已改崔晓云（只影响新建）。
 * 本脚本处理**存量**：把仍是旧默认「冯敏」的单改成崔晓云。
 *
 * ⚠ 物理列名是「管理人」不是「表单管理人」（实测 yj_field: label 表单管理人 → col 管理人）。
 * ⚠ 只改**恰好等于旧默认「冯敏」**的行：
 *   · 空值的 8 张不动（用户说"默认写"，没让凭空补）；
 *   · 人工改成别人的（若有）不动 —— 那是人为指定，不是默认值残留。
 * 幂等：WHERE 精确匹配旧值，重复执行 0 行。两账套都执行。
 * ========================================================================== */

SET NOCOUNT ON;

IF OBJECT_ID('rd_insp_plan_head') IS NULL
    RAISERROR(N'[insp-manager] 缺 rd_insp_plan_head', 16, 1);
IF COL_LENGTH('rd_insp_plan_head', N'管理人') IS NULL
    RAISERROR(N'[insp-manager] rd_insp_plan_head 缺「管理人」列（label 表单管理人 的物理列）', 16, 1);
GO

UPDATE rd_insp_plan_head
   SET [管理人] = N'崔晓云'
 WHERE [管理人] = N'冯敏'
   AND ISNULL(asp_cancel, 'N') <> 'Y';
PRINT N'[insp-manager] 表单管理人 冯敏 → 崔晓云 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- 自检：不该再有旧默认残留 ---------- */
IF EXISTS (SELECT 1 FROM rd_insp_plan_head WHERE [管理人] = N'冯敏' AND ISNULL(asp_cancel,'N') <> 'Y')
    RAISERROR(N'[insp-manager] 自检失败：仍有「冯敏」', 16, 1);
PRINT N'[insp-manager] 自检通过。';
GO
