-- 验证造数清理(仅测试账套):删两张验证单据 + 领料单退回未完成 + 删造数库存 + 还原 admin 部门
SET NOCOUNT ON;
BEGIN TRAN;

-- ① 生产领料单 / 生产退料单(草稿)整单删除
DELETE FROM dbo.bl_material_out WHERE 单据编号 = N'LL-2026-11-0047';
DELETE FROM dbo.bd_material_out WHERE 单据编号 = N'LL-2026-11-0047';
DELETE FROM dbo.bl_material_ret  WHERE 单据编号 = N'TL-2026-11-0021';
DELETE FROM dbo.bd_material_ret  WHERE 单据编号 = N'TL-2026-11-0021';
DELETE FROM dbo.yj_doc_status WHERE doc_no IN (N'LL-2026-11-0047', N'TL-2026-11-0021');
DELETE FROM dbo.outh WHERE 单据编号 = N'LL-2026-11-0047' AND ISNULL(asp_cancel,'N') = 'Y';

-- ② 领料单退回未完成
UPDATE dbo.wo_pick_doc
   SET 状态 = N'未完成', 已领项数 = 0, 提交人 = NULL, 提交时间 = NULL, 退料单号 = NULL
 WHERE id = 856;

UPDATE dbo.wo_pick_line
   SET 实领数量 = 0, 批号 = NULL,
       明细备注 = LEFT(明细备注, CASE WHEN CHARINDEX(N'; 领料批次:', 明细备注) > 0
                                      THEN CHARINDEX(N'; 领料批次:', 明细备注) - 1
                                      ELSE LEN(明细备注) END)
 WHERE 单头id = 856 AND ISNULL(asp_cancel,'N') <> 'Y';

UPDATE dbo.wo_pick_batch SET asp_cancel = 'Y' WHERE 单头id = 856 AND ISNULL(asp_cancel,'N') <> 'Y';
DELETE FROM dbo.wo_pick_return WHERE 领料单号 = N'LL-2026-11-0047';
DELETE FROM dbo.s_allno WHERE dh IN (N'TL-2026-11-0021');

-- ③ 删掉验证用的假批次库存(TESTB-*)
DELETE FROM dbo.kucun WHERE wzdm = N'YJ-XWR-058' AND lot_no LIKE N'TESTB-%';

-- ④ 还原 admin 的部门(验证时临时挂的)
UPDATE dbo.yj_user SET dept_id = NULL WHERE username = 'admin';

COMMIT;

SELECT 'kucun' AS t, lot_no, yl FROM dbo.kucun WHERE wzdm = N'YJ-XWR-058';
SELECT 'doc' AS t, id, 状态, 领料单号, 退料单号 FROM dbo.wo_pick_doc WHERE id = 856;
SELECT 'line' AS t, 行号, 实领数量, 批号 FROM dbo.wo_pick_line WHERE 单头id = 856 ORDER BY TRY_CAST(行号 AS int);
SELECT 'out_doc' AS t, COUNT(*) AS n FROM dbo.bd_material_out WHERE 单据编号 = N'LL-2026-11-0047';
SELECT 'ret_doc' AS t, COUNT(*) AS n FROM dbo.bd_material_ret WHERE 单据编号 = N'TL-2026-11-0021';
SELECT 'return_ledger' AS t, COUNT(*) AS n FROM dbo.wo_pick_return WHERE 领料单号 = N'LL-2026-11-0047';
SELECT 'admin_dept' AS t, dept_id FROM dbo.yj_user WHERE username='admin';
