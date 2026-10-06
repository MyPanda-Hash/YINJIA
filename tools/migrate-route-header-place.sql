/* migrate-route-header-place.sql(2026-10-05):工艺路线 名称/生效日期/失效日期 位置由 query,header 改为 header(表单头)
 * 用户报障「工艺路线名称无法保存」:实测服务端返回 400 工艺路线名称不能为空,而**接口带上名称即可写入成功**
 *   ⇒ 前端没把名称送出去(字段落在查询区,输入未绑定到单据)。改 place=header 让它在表单头录入。两账套已执行。 */
UPDATE yj_field SET place = N'header' WHERE panel_code = N'ROUTE' AND col_name IN (N'工艺路线名称', N'生效日期', N'失效日期');
GO
