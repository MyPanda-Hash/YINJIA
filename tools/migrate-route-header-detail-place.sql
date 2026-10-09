/* migrate-route-header-detail-place.sql(2026-10-05):工艺路线表头字段同时挂明细位(修「保存后名称消失」)
 *
 * 用户报障:「点击保存后工艺路线名称会消失」。排查证据(实测 bs_route):
 *   保存前:id=34(工艺路线名称=空, 加工顺序=1, OP-HL 混料)                      ← 表头读的是这一行
 *   保存后:新增 id=35(工艺路线名称=名称写入判定X, **加工顺序=NULL**)           ← 名称被写到"另一行"
 *   ⇒ 单表式单据(head_table 为空)保存时把头字段写进了**只含头字段的一行**,而表头回显按 **ORDER BY id 的第一行** 读取
 *     ⇒ 名称"消失"(其实在第二行)。字段只挂 header 位时,明细行不带该值,合并逻辑落不到同一行。
 * 处置:让三个表头字段**同时挂明细位**(place = header,detail) ⇒ 头字段随每一行写入/回读,表头与明细同源。
 * 撤回:UPDATE yj_field SET place=N'header' WHERE panel_code=N'ROUTE' AND col_name IN (N'工艺路线名称',N'生效日期',N'失效日期');
 * 幂等;两账套均执行。
 */
UPDATE yj_field SET place = N'header,detail'
 WHERE panel_code = N'ROUTE' AND col_name IN (N'工艺路线名称', N'生效日期', N'失效日期');
GO
SELECT col_name, label, place, required FROM yj_field
 WHERE panel_code = N'ROUTE' AND col_name IN (N'工艺路线编码',N'工艺路线名称',N'生效日期',N'失效日期') ORDER BY seq;
GO