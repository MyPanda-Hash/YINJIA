SET NOCOUNT ON;
PRINT '== F2. inh 里有没有 FI-2026-09-0001 的入库流水 ==';
SELECT src, 单据编号, 单据类型, 物料编码, 数量, 仓库名称, 批号, 单据日期
FROM inh WHERE 单据编号 = N'FI-2026-09-0001';

PRINT '== G. 占用链状态(ACTIVE=未冲回释放) ==';
SELECT source_panel_code, source_form_no, target_panel_code, target_form_no, link_status, create_by, create_time
FROM form_flow_link WHERE target_panel_code = 'FINISH_IN';

PRINT '== H. 全部成品入库单:来源构成 ==';
SELECT 业务类型, 单据状态, COUNT(*) AS 单数 FROM bd_finish_in
WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY 业务类型, 单据状态 ORDER BY 业务类型, 单据状态;

PRINT '== I. inh 中 src=2(产成品入库)流水汇总 ==';
SELECT src, COUNT(*) AS 行数, ISNULL(SUM(数量),0) AS 数量合计 FROM inh
WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY src ORDER BY src;
