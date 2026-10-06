/* migrate-route-name-not-required.sql(2026-10-05):工艺路线 名称/生效日期/失效日期 取消必填
 *
 * 用户报障:「明细第 1 行工艺路线名称不能为空」+「存放在明细表行的,表头内容可以不要求必填吗?」
 * 原因:这三个原表头字段已挂明细位(place=header,detail,单表式单据必须如此才能存住),于是**明细行必填校验**
 *   也会对它们生效 —— 该行只要录了工序编码/工序序列就不再是"空行",随即被判"工艺路线名称不能为空"。
 * 处置:三个字段 required=0(**保留** 工艺路线编码/工序编码/工序控制/工序序列 必填);
 *   路线仍以「编码」为唯一标识,名称为描述性字段,可空。
 * 撤回:UPDATE yj_field SET required=1 WHERE panel_code=N'ROUTE' AND col_name IN (N'工艺路线名称',N'生效日期',N'失效日期');
 * 幂等;两账套均执行。
 */
UPDATE yj_field SET required = 0
 WHERE panel_code = N'ROUTE' AND col_name IN (N'工艺路线名称', N'生效日期', N'失效日期');
GO
SELECT req AS 必填字段 FROM (
  SELECT label AS req FROM yj_field WHERE panel_code=N'ROUTE' AND required=1) t ORDER BY req;
GO