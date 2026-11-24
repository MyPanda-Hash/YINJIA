-- 清理首轮验证造数(仅测试账套):删掉自动生成的生产领料单、把领料单退回未完成
SET NOCOUNT ON;
BEGIN TRAN;

DELETE FROM dbo.bl_material_out WHERE 单据编号 = N'LL-2026-11-0047';
DELETE FROM dbo.bd_material_out WHERE 单据编号 = N'LL-2026-11-0047';
DELETE FROM dbo.yj_doc_status WHERE panel_code = 'MATERIAL_OUT' AND doc_no = N'LL-2026-11-0047';

UPDATE dbo.wo_pick_doc
   SET 状态 = N'未完成', 已领项数 = 0, 提交人 = NULL, 提交时间 = NULL
 WHERE id = 856;

UPDATE dbo.wo_pick_line
   SET 实领数量 = 0, 批号 = NULL,
       明细备注 = LEFT(明细备注, CASE WHEN CHARINDEX(N'; 领料批次:', 明细备注) > 0
                                      THEN CHARINDEX(N'; 领料批次:', 明细备注) - 1
                                      ELSE LEN(明细备注) END)
 WHERE 单头id = 856 AND ISNULL(asp_cancel,'N') <> 'Y';

UPDATE dbo.wo_pick_batch SET asp_cancel = 'Y' WHERE 单头id = 856 AND ISNULL(asp_cancel,'N') <> 'Y';

-- 给 admin 临时挂部门(验证「领料部门按账号所属部门带入」;验完恢复 NULL)
UPDATE dbo.yj_user SET dept_id = 8 WHERE username = 'admin';

COMMIT;

SELECT id, 状态, 已领项数, 提交人 FROM dbo.wo_pick_doc WHERE id = 856;
SELECT 行号, 物料编码, 实领数量, 批号, 明细备注 FROM dbo.wo_pick_line WHERE 单头id = 856 ORDER BY TRY_CAST(行号 AS int);
SELECT username, dept_id FROM dbo.yj_user WHERE username='admin';
SELECT id, 部门编码, 部门名称 FROM dbo.bs_dept WHERE id = 8;
