/* 验收查库(测试账套):api-check.mjs 跑完后执行;每条输出 PASS/FAIL */
SET NOCOUNT ON;

SELECT 'A.不合格数量落库=2' AS chk,
       CASE WHEN EXISTS (SELECT 1 FROM dbo.bl_finish_in
                          WHERE 单据编号 = N'FI-GATE-QTY-A' AND [不合格数量] = 2) THEN 'PASS' ELSE 'FAIL' END AS result
UNION ALL
SELECT 'A.实收数量未扣减(仍=4)',
       CASE WHEN EXISTS (SELECT 1 FROM dbo.bl_finish_in
                          WHERE 单据编号 = N'FI-GATE-QTY-A' AND [实收数量] = 4) THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'A.提交后状态=审批中',
       CASE WHEN EXISTS (SELECT 1 FROM dbo.yj_doc_status
                          WHERE panel_code = N'FINISH_IN' AND doc_no = N'FI-GATE-QTY-A' AND ISNULL(pending, 'N') = 'Y')
            THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'A.未被门禁回绝(无旧提示留痕)',
       CASE WHEN NOT EXISTS (SELECT 1 FROM dbo.yj_form_approval
                              WHERE panel_code = N'FINISH_IN' AND form_no = N'FI-GATE-QTY-A' AND action = 'REJECT')
            THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'B.仍被门禁拦下(未进入审批中)',
       CASE WHEN NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status
                              WHERE panel_code = N'FINISH_IN' AND doc_no = N'FI-GATE-QTY-B' AND ISNULL(pending, 'N') = 'Y')
            THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'B.未产生审批 SUBMIT 留痕',
       CASE WHEN NOT EXISTS (SELECT 1 FROM dbo.yj_form_approval
                              WHERE panel_code = N'FINISH_IN' AND form_no = N'FI-GATE-QTY-B' AND action = 'SUBMIT')
            THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'T410 验收期开关=是',
       CASE WHEN EXISTS (SELECT 1 FROM dbo.bs_inv WHERE LTRIM(RTRIM(存货编码)) = N'T410' AND ISNULL([是否过程检验], 0) = 1)
            THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'C.库存流水未被写(本单未审核)',
       CASE WHEN NOT EXISTS (SELECT 1 FROM dbo.inh
                              WHERE src = 2 AND rid IN (SELECT id FROM dbo.bl_finish_in
                                                        WHERE 单据编号 IN (N'FI-GATE-QTY-A', N'FI-GATE-QTY-B')))
            THEN 'PASS' ELSE 'FAIL' END;
