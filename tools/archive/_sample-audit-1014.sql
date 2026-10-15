-- _sample-audit-1014.sql — 一次性(链外,不进清单)
-- 用途:Phase 3 端到端验证 —— 把写入 HSDZ_MES_TEST 的 3 张金蝶样例单据补上「已审核」留痕,
--   否则转ERP 的前置守卫会拒绝(KingdeePushService:「仅已审核(审批通过)单据可转ERP」)。
-- ⚠ 只对**测试账套**的样例单据生效(asp_user1='样例取样' 的行);正式库不执行本脚本。
SET NOCOUNT ON;
DECLARE @now datetime2 = SYSDATETIME();
MERGE yj_doc_status AS t
USING (SELECT 'FINISH_IN' AS panel_code, 单据编号 AS doc_no FROM bd_finish_in  WHERE asp_user1 = N'样例取样'
       UNION ALL SELECT 'OTHER_IN',  单据编号 FROM bd_other_in  WHERE asp_user1 = N'样例取样'
       UNION ALL SELECT 'OTHER_OUT', 单据编号 FROM bd_other_out WHERE asp_user1 = N'样例取样') AS s
ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no
WHEN MATCHED THEN UPDATE SET shr = N'样例审核', shsj = @now, canceled = N'N', stopped = N'N', update_at = @now
WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, shr, shsj, canceled, stopped, pending, update_at)
     VALUES (s.panel_code, s.doc_no, N'样例审核', @now, N'N', N'N', N'N', @now);
SELECT panel_code, doc_no, shr FROM yj_doc_status
WHERE doc_no IN (SELECT 单据编号 FROM bd_finish_in WHERE asp_user1 = N'样例取样'
                 UNION SELECT 单据编号 FROM bd_other_in WHERE asp_user1 = N'样例取样'
                 UNION SELECT 单据编号 FROM bd_other_out WHERE asp_user1 = N'样例取样');
