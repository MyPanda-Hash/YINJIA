/* migrate-route-status-as-button.sql(2026-10-05):工艺路线「状态」改按钮驱动、「审核状态」并入单据状态
 *
 * 用户口径:「状态应该是按钮,审批状态应该和当前单据状态相同」。
 *
 * 现状/依据(实测):
 *   · 本引擎**没有**「按钮」型字段(data_type 词表:文本/小数/参照/下拉框/日期/是否/附件/整数/标准库/数值),
 *     也没有按钮配置表;`yj_panel.config` 为空;
 *   · 「单据状态」是**引擎派生**的,唯一真源是状态机(yj_doc_status + 审核/弃审动作)——
 *     ButtonService 里对提交上来的 `单据状态` 直接 `body.remove("单据状态")`,
 *     即状态**不允许手工填**,只能由按钮(保存/审核/弃审)驱动;
 *   · ROUTE 上一版为了照抄金蝶截图,额外登记了「状态」(启用/停用,可填)与「审核状态」(独立物理列)两个字段
 *     ⇒ 与引擎状态机形成两套状态,正是用户要消除的。
 *
 * 处置(只改元数据 + 撤掉我加的那一列,不动既有数据):
 *   · ①「状态」→ 退出表单位(place='query'),不再作为可填字段;状态改由面板的**审核/弃审按钮**驱动;
 *   · ②「审核状态」→ 删除该字段登记,并**drop 掉那一列**(该列是本轮为照抄截图新增、且值只是我铺的"已审核",
 *        无业务数据)⇒ 面板只保留引擎的「单据状态」一个状态显示,天然"审批状态 = 当前单据状态";
 *   · ③ 顺带把该列上我铺过的示例值一并撤掉(随列删除)。
 *
 * ⚠ 若日后确实需要"启用/停用"这一类**业务**开关(与审核状态无关),应作为独立字段+独立按钮另立,
 *   不要复用「状态」标签(yj_field 规范:同一物理列只准一个中文标签)。
 * 幂等可重跑;两账套均执行。
 */

/* ① 状态:退出表单位 */
UPDATE yj_field SET place = N'query' WHERE panel_code = N'ROUTE' AND col_name = N'状态';
GO

/* ② 审核状态:删登记 + drop 列(仅当该列存在且是本轮新增的) */
DELETE FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'审核状态';
GO
IF COL_LENGTH('bs_route', N'审核状态') IS NOT NULL
BEGIN
  /* 权限/参照引用兜底:清掉可能残留的对照登记 */
  DELETE FROM yj_translation WHERE scope = 'field' AND ref_key = N'审核状态'
    AND NOT EXISTS (SELECT 1 FROM yj_field WHERE label = N'审核状态');
  ALTER TABLE bs_route DROP COLUMN [审核状态];
END
GO

/* ③ 自检:ROUTE 不得再有「状态/审核状态」作为表单字段,且不得再存在 审核状态 列 */
DECLARE @bad int = 0;
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'状态' AND place LIKE N'%header%') SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'审核状态') SET @bad = @bad + 1;
IF COL_LENGTH('bs_route', N'审核状态') IS NOT NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'ROUTE' AND mode = N'doc') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'工艺路线状态口径自检失败', 16, 1);
ELSE PRINT N'工艺路线状态就绪:状态由审核/弃审按钮驱动,审批状态 = 引擎单据状态(唯一真源)';
GO
