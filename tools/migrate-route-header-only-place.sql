/* migrate-route-header-only-place.sql(2026-10-05):表头字段退出明细位(修「表头修改后无法保存」)
 *
 * 用户报障:「表头无法实现对当前页面的数据保存,表头修改后无法保存下来」。
 * 根因(读代码定位,ButtonService 单表式保存):
 *     Map merged = new LinkedHashMap<>(head); merged.putAll(item); item.putAll(merged);
 *   ⇒ merged 先取表头、再被**明细行同名列覆盖**(行优先)。三个字段挂在明细位时,前端提交的明细行
 *     各自带着**旧值** ⇒ 表头改成新值后被行里旧值盖回去 ⇒ 表现为"表头改了保存不下来"。
 * 处置:工艺路线名称/生效日期/失效日期 place 由 header,detail 改为 **header**(退出明细位)——
 *   · 保存:头字段仍按"并入每行"落库(ButtonService:421),但不参与 front-end 明细载荷 ⇒ 无覆盖;
 *   · 回读:单表式头字段取首行(QueryService:365-370) ⇒ 表头照常显示;
 *   · 必填:只剩**表头一次校验**,不再逐行校验(正是用户最初要求的"不要填明细时校验必填")。
 * 撤回:UPDATE yj_field SET place=N'header,detail' WHERE panel_code=N'ROUTE' AND col_name IN (...);
 * 幂等;两账套均执行。
 */
UPDATE yj_field SET place = N'header'
 WHERE panel_code = N'ROUTE' AND col_name IN (N'工艺路线名称', N'生效日期', N'失效日期');
GO
SELECT col_name, label, place, required FROM yj_field WHERE panel_code=N'ROUTE'
 AND col_name IN (N'工艺路线名称',N'生效日期',N'失效日期') ORDER BY seq;
GO