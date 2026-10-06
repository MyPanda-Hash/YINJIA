/* migrate-route-relax-required.sql(2026-10-05):工艺路线必填收敛(放开工序控制/生效·失效日期)
 *
 * 用户报障:「明细第 2 行工序控制不能为空」「填写明细行提示表头未进行填写」。
 * 根因(实测 yj_field):
 *   ① 「工序控制(=列 加工方式)」被设为 required=1(照金蝶截图的 * ) ⇒ 每新增一行必须选一次,否则报"第 N 行工序控制不能为空";
 *   ② 「生效日期/失效日期」也是 required=1 ⇒ 单表式 doc 保存时表头(编码/名称/日期)不全就拦;
 *   ③ ROUTE 是 **单据形态(表头+明细)** ⇒ 表头(编码/名称)未填时,明细行无法保存 —— 这是形式决定的顺序,不改引擎。
 * 处置:放开工序控制、生效日期、失效日期三个必填(**保留** 工艺路线编码/名称/工序编码/工序序列 必填)。
 *   撤回:UPDATE yj_field SET required=1 WHERE panel_code=N'ROUTE' AND col_name IN (N'加工方式',N'生效日期',N'失效日期');
 * 幂等;两账套均执行。
 */
UPDATE yj_field SET required = 0
 WHERE panel_code = N'ROUTE' AND col_name IN (N'加工方式', N'生效日期', N'失效日期');
GO
DECLARE @bad int = 0;
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code=N'ROUTE' AND required=1
           AND col_name IN (N'加工方式',N'生效日期',N'失效日期')) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code=N'ROUTE' AND col_name=N'工序编码' AND required=1) SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'工艺路线必填收敛自检失败',16,1);
ELSE PRINT N'工艺路线必填已收敛:仅保留 编码/名称/工序编码/工序序列';
GO