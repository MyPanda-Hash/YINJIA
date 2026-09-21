-- 采购链「去向单号」收尾 A 项:为什么库里会有"已作废的暂收退料单"——代码级证据的 SQL 侧
-- 现象:11 张 QC_RETURN 里 9 张 yj_doc_status.canceled='Y',而 qc_return.asp_cancel 仍是 'N'。
-- 结论(见 ButtonService.voidDoc 1129-1134):作废走的是 yj_doc_status **软删**(MERGE canceled='Y'),
--       **不写**单据表自己的 asp_cancel;单据表的 asp_cancel 只在"档案行删除/明细行删除"时写(1114-1115)。
-- 执行: java -cp <mssql-jdbc.jar> tools/SqlRunner.java "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" yinjia <pwd> tools/archive/_q-void-cause.sql
SET NOCOUNT ON;

-- 1) 逐张退料单:表内 asp_cancel vs 状态表 canceled/deleting,以及"与检验单作废时间差"证明是级联
SELECT N'1-逐张退料单' AS 段,
       RTRIM(r.单据编号) AS 退料单,
       ISNULL(r.asp_cancel, 'N') AS 表内_asp_cancel,
       ISNULL(s.canceled, 'N') AS 状态表_canceled,
       ISNULL(s.deleting, 'N') AS 状态表_deleting,
       s.cancel_by AS 作废人,
       CONVERT(varchar(19), s.cancel_at, 120) AS 作废时间,
       RTRIM(ISNULL(r.检验单号, '')) AS 检验单,
       ISNULL(i.canceled, 'N') AS 检验单_canceled,
       CONVERT(varchar(19), i.cancel_at, 120) AS 检验单作废时间,
       DATEDIFF(SECOND, i.cancel_at, s.cancel_at) AS 与检验单作废相差秒,
       ISNULL((SELECT TOP 1 link_status FROM form_flow_link l
               WHERE l.target_panel_code = 'QC_RETURN' AND l.target_form_no = r.单据编号), N'(无链路)') AS 链路状态
FROM qc_return r
LEFT JOIN yj_doc_status s ON s.panel_code = 'QC_RETURN' AND s.doc_no = r.单据编号
LEFT JOIN yj_doc_status i ON i.panel_code = 'QC_INSP' AND i.doc_no = r.检验单号
ORDER BY r.单据编号;

-- 2) 汇总:两张标记不一致的规模
SELECT N'2-汇总' AS 段,
       COUNT(*) AS 退料单总数,
       SUM(CASE WHEN ISNULL(s.canceled, 'N') = 'Y' THEN 1 ELSE 0 END) AS 状态表已作废,
       SUM(CASE WHEN ISNULL(r.asp_cancel, 'N') = 'Y' THEN 1 ELSE 0 END) AS 表内应作废_asp_cancel_Y,
       SUM(CASE WHEN ISNULL(s.canceled, 'N') = 'Y' AND ISNULL(r.asp_cancel, 'N') <> 'Y' THEN 1 ELSE 0 END) AS 软删未同步表内标记,
       SUM(CASE WHEN s.doc_no IS NULL THEN 1 ELSE 0 END) AS 无状态表行,
       SUM(CASE WHEN ISNULL(s.deleting, 'N') = 'Y' THEN 1 ELSE 0 END) AS 删除申请中
FROM qc_return r
LEFT JOIN yj_doc_status s ON s.panel_code = 'QC_RETURN' AND s.doc_no = r.单据编号;

-- 3) 各来源面板触发的作废人分布(判断是"人工点删除"还是"检验单弃审级联")
SELECT N'3-作废人分布' AS 段, ISNULL(s.cancel_by, N'(空)') AS 作废人, COUNT(*) AS 张数
FROM qc_return r
LEFT JOIN yj_doc_status s ON s.panel_code = 'QC_RETURN' AND s.doc_no = r.单据编号
WHERE ISNULL(s.canceled, 'N') = 'Y'
GROUP BY s.cancel_by ORDER BY COUNT(*) DESC;

-- 4) 仍被 ACTIVE 链路指着的退料单(= 老 resolveEndTarget 广搜能走到的候选终点)
SELECT N'4-ACTIVE链路指向的退料单' AS 段,
       l.id AS linkId, l.batch_id, l.source_panel_code AS 来源面板, l.source_form_no AS 检验单,
       l.target_form_no AS 退料单,
       ISNULL(s.canceled, 'N') AS 退料单_canceled,
       ISNULL(r.asp_cancel, 'N') AS 退料单_表内asp_cancel
FROM form_flow_link l
LEFT JOIN yj_doc_status s ON s.panel_code = 'QC_RETURN' AND s.doc_no = l.target_form_no
LEFT JOIN qc_return r ON r.单据编号 = l.target_form_no
WHERE l.target_panel_code = 'QC_RETURN' AND l.link_status = 'ACTIVE'
ORDER BY l.id;

-- 5) 退料单行 单位/计量单位 填充情况(核对 2026-09-21「补写单位」是否生效:老单应空,新单应填)
SELECT N'5-退料行单位' AS 段, RTRIM(d.单据编号) AS 退料单,
       COUNT(*) AS 行数,
       SUM(CASE WHEN ISNULL(d.单位, N'') = N'' THEN 1 ELSE 0 END) AS 单位_空行,
       SUM(CASE WHEN ISNULL(d.计量单位, N'') = N'' THEN 1 ELSE 0 END) AS 计量单位_空行
FROM qc_return_detail d
GROUP BY RTRIM(d.单据编号) ORDER BY RTRIM(d.单据编号);
