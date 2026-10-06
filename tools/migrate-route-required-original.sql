/* migrate-route-required-original.sql(2026-10-05):工艺路线必填恢复"原本模式"(七字段全必填)
 *
 * 用户口径:「必填按照原本的模式实现即可」⇒ 撤回 d1f6a2c9(名称/生效/失效 取消必填),
 *   恢复为**照金蝶截图登记时的原始必填集**:
 *     表头:工艺路线编码、工艺路线名称、生效日期、失效日期
 *     明细:工序编码、工序控制(=列 加工方式)、工序序列(=列 加工顺序)
 * 说明:字段位置(place=header,detail)与显示开关(visible)保持现状 —— 那是"单表式单据能存住"的前提,
 *   与必填无关,不在本次改动范围。撤回:把 name/生效/失效 三条改回 required=0(见 d1f6a2c9 脚本)。
 * 幂等;两账套均执行。
 */
UPDATE yj_field SET required = 1
 WHERE panel_code = N'ROUTE' AND col_name IN (N'工艺路线编码', N'工艺路线名称', N'生效日期', N'失效日期',
                                               N'工序编码', N'加工方式', N'加工顺序');
GO
DECLARE @n int = (SELECT COUNT(*) FROM yj_field WHERE panel_code=N'ROUTE' AND required=1);
IF @n <> 7 RAISERROR(N'必填恢复未达预期(应为 7 个字段)',16,1);
ELSE PRINT N'工艺路线必填已恢复为原本模式:7 个字段';
SELECT label AS 必填字段 FROM yj_field WHERE panel_code=N'ROUTE' AND required=1 ORDER BY place, seq;
GO