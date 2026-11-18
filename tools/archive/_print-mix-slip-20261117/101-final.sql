SET NOCOUNT ON;
SELECT (SELECT COUNT(*) FROM plang p WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
        AND NOT EXISTS (SELECT 1 FROM wo_pick_doc d WHERE d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废')) AS 未开单行数,
       (SELECT COUNT(*) FROM yj_print_task WHERE id IN (9,10) AND state = 'DONE') AS 两张纸已完成;
GO
SELECT id, title, JSON_VALUE(payload_json, '$."二维码内容"') AS 二维码内容, state FROM yj_print_task WHERE id IN (9,10);
