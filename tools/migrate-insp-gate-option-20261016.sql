/* migrate-insp-gate-option-20261016.sql(2026-10-16)
 *
 * 目的:把「工序检验单生成门禁(成型完成)」的**强度档位**显式写进元数据 `yj_panel.config`,
 *   让现场口径可以**不改代码、不发版**地切换(把关/只提示/不做门禁)。
 *
 * 背景(用户口径 2026-10-16):「当前首件检验单、制程检验单、组装成品检验单都需要实现当前完成了进行,
 *   成型完成后的生产工单才能生成这个首件检验单,当前实现的所有生产工单都能生成检验单据,修改当前的实现逻辑」。
 *   落地形态 = 判据收敛到深模块 `WoInspGate`(判据/取数/话术一处)+ 强度由本脚本写入的配置决定。
 *
 * 键(读法见 WoInspGate.loadPolicy:字符串匹配,不用 JSON_VALUE —— 库兼容级别 100,JSON 函数要 130+,
 *   与 PanelConfigService.panelSingleDoc 同一写法):
 *   "inspGate"       = off | warn | block  —— 判据不满足时的系统行为
 *                      off  = 不做门禁(兼容/回滚档)
 *                      warn = 放行但预警(界面确认 + 写 yj_usage_log 留痕)
 *                      block= 422 拦截(默认;管理员可凭原因强制开单,留痕)
 *   "inspGateLegacy" = pass | block        —— **存量行**(该工单行还没有任何已审核报工)是否也拦
 *                      pass = 放行并标注(默认;本地/服务器现存工单几乎都没有报工历史,不放行会全库开不出单)
 *                      block= 一并拦截(严格口径:真正实现"只有成型完成的工单才能开单")
 *
 * 写入位置:三张检验单面板**任一**写了即生效(取 panel_code 排序后第一个非空的;顺序固定,见 GATE_PANELS)。
 *   本脚本在 QS_ASM_INSP 已有 fixedItems 的既有 config 上**追加**,不覆盖原有键。
 *
 * 幂等:已含 "inspGate" 的面板整行跳过(重复执行 0 行为预期);两账套均执行。
 * 自检:执行后三个面板的 config 必须都能匹配到 "inspGate"(否则报错)。
 *
 * ⚠ 本脚本只写元数据,**不改任何业务数据**;门禁的实际行为由代码侧 WoInspGate/WoInspGateGuard 决定。
 */

DECLARE @panels TABLE (code nvarchar(64));
INSERT INTO @panels (code) VALUES (N'QC_FIRST_INSP'), (N'QC_PROC_INSP'), (N'QC_ASM_INSP');

-- ① 空 config → 直接写默认档(拦 + 存量放行)
UPDATE p
   SET p.config = N'{"inspGate":"block","inspGateLegacy":"pass"}'
  FROM dbo.yj_panel p
 WHERE p.panel_code IN (SELECT code FROM @panels)
   AND RTRIM(LTRIM(ISNULL(CONVERT(nvarchar(max), p.config), N''))) = N'';

-- ② 非空且尚未写门禁键 → 在原 JSON 的 `}` 前追加两个键(保留既有 fixedItems/singleDoc 等)
UPDATE p
   SET p.config = LEFT(x.c, LEN(x.c) - 1) + N',"inspGate":"block","inspGateLegacy":"pass"}'
  FROM dbo.yj_panel p
 CROSS APPLY (SELECT RTRIM(LTRIM(CONVERT(nvarchar(max), p.config))) AS c) x
 WHERE p.panel_code IN (SELECT code FROM @panels)
   AND x.c <> N''
   AND RIGHT(x.c, 1) = N'}'
   AND CHARINDEX(N'"inspGate"', x.c) = 0;
GO

-- ③ 自检:三个面板都得能匹配到 inspGate(读不到 = 现场改不了口径,必须当场发现)
DECLARE @bad int = 0;
SELECT @bad = COUNT(*) FROM dbo.yj_panel
 WHERE panel_code IN (N'QC_FIRST_INSP', N'QC_PROC_INSP', N'QC_ASM_INSP')
   AND CHARINDEX(N'"inspGate"', CONVERT(nvarchar(max), ISNULL(config, N''))) = 0;
IF @bad > 0 RAISERROR(N'检验单门禁强度配置写入自检失败:仍有面板没有 inspGate 键', 16, 1);
ELSE PRINT N'检验单门禁强度配置已就位(inspGate=block / inspGateLegacy=pass;改档位只需 UPDATE 该键)';
GO
