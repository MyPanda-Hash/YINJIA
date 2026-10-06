/* migrate-route-header-hide-in-detail.sql(2026-10-05):表头字段不在明细行默认显示
 *
 * 用户口径:「当前表头存在的[字段]默认在明细行隐藏掉」。
 * 背景:ROUTE 是单表式单据,表头字段必须挂明细位(place 含 detail)才会被写入行并回读
 *   (否则保存后"名称消失");但用户不希望这些**表头语义**的字段(工艺路线名称/生效日期/失效日期)
 *   在明细表格里多出三列 ⇒ 保留 place='header,detail'(数据口径不变),仅把**显示开关**关掉:
 *   明细列口径 = place 含 detail 且 visible=1 且 hidden=0(采购链四单文档 §3),故置 visible=0 即可隐藏。
 * 撤回:UPDATE yj_field SET visible=1 WHERE panel_code=N'ROUTE' AND col_name IN (N'工艺路线名称',N'生效日期',N'失效日期');
 * 幂等;两账套均执行。
 */
UPDATE yj_field SET visible = 0
 WHERE panel_code = N'ROUTE' AND col_name IN (N'工艺路线名称', N'生效日期', N'失效日期');
GO
SELECT col_name, label, place, visible, required FROM yj_field
 WHERE panel_code = N'ROUTE' AND col_name IN (N'工艺路线名称', N'生效日期', N'失效日期') ORDER BY seq;
GO