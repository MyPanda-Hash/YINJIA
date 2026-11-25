SET NOCOUNT ON;
/* 复跑 appendOrphanRows 里那条 SQL 的同款形态,验证「已覆盖 ⇒ 不重复」「台账被释放 ⇒ 露出来」 */

PRINT '--- A. YJ-20260921-10 的占用聚合(合成行的数据源) ---';
SELECT target_panel_code AS 目标面板, target_form_no AS 目标单,
       SUM(COALESCE(linked_quantity,0)) AS 数量, MAX(batch_no) AS 占用批次号,
       CONVERT(varchar(19), MIN(create_time),120) AS 最早占用, COUNT(*) AS 行数
FROM form_flow_link
WHERE source_panel_code='PU_ORDER' AND source_form_no=N'YJ-20260921-10' AND link_status='ACTIVE'
  AND target_panel_code IS NOT NULL AND target_form_no IS NOT NULL AND LTRIM(RTRIM(target_form_no))<>''
GROUP BY target_panel_code, target_form_no;

PRINT '--- B. 该订单的有效台账行(known 集合:上面每一单都应有对应行 ⇒ 不应产生合成行) ---';
SELECT id, batch_no AS 批次号, status, target_form_no AS 台账去向
FROM yj_doc_batch
WHERE source_panel_code='PU_ORDER' AND source_form_no=N'YJ-20260921-10' AND status IN ('ACTIVE','PENDING');
