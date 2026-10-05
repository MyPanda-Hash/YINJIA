/* migrate-route-status-restore.sql(2026-10-05):撤回「状态按钮化/开关化」两轮改动,回到 96201e68 的字段口径
 *
 * 用户口径:「撤回上面两条对话的修改先」——即撤回
 *   ① 53e9507b(状态改按钮驱动、审核状态并入单据状态);
 *   ② 715a0c21(状态改是否开关、审核状态移入明细)。
 * 目标状态 = a6f0591a 时点的元数据(金蝶字段补齐后的原始口径):
 *   · 状态     = 文本,place 'query,header'(表单字段,可填),值口径 启用/停用;
 *   · 审核状态 = 文本,place 'query,header'(表单字段,与单据状态并存),值 已审核/未审核。
 * 不用 git revert:tools/db-migrations.txt 里压着另一条任务(来料检验要求 series)未提交的登记改动,revert 会牵动它。
 * 幂等可重跑;两账套均执行。
 */

/* ① 状态:回 文本 + 表单位;值 Y/N → 启用/停用 */
UPDATE yj_field SET data_type = N'文本', place = N'query,header', required = 0, visible = 1, hidden = 0
 WHERE panel_code = N'ROUTE' AND col_name = N'状态';
UPDATE bs_route SET 状态 = CASE
      WHEN ISNULL(状态, N'') IN (N'Y', N'启用') THEN N'启用'
      WHEN ISNULL(状态, N'') IN (N'N', N'停用') THEN N'停用'
      ELSE 状态 END;
GO

/* ② 审核状态:回 文本 + 表单位(退出明细) */
UPDATE yj_field SET data_type = N'文本', place = N'query,header', seq = 30, width = 100,
                    editable = 1, required = 0, visible = 1, hidden = 0
 WHERE panel_code = N'ROUTE' AND col_name = N'审核状态';
GO

/* ③ 自检:状态=文本且在表头、不在明细;审核状态=文本且在表头、不在明细;两列都存在 */
DECLARE @bad int = 0;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'状态'
               AND data_type = N'文本' AND place LIKE N'%header%' AND place NOT LIKE N'%detail%') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'审核状态'
               AND data_type = N'文本' AND place LIKE N'%header%' AND place NOT LIKE N'%detail%') SET @bad = @bad + 1;
IF COL_LENGTH('bs_route', N'审核状态') IS NULL SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM bs_route WHERE ISNULL(状态, N'') NOT IN (N'启用', N'停用')) SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'工艺路线状态口径撤回自检失败', 16, 1);
ELSE PRINT N'已撤回:状态/审核状态 均为表头文本字段(回到 96201e68 口径)';
GO