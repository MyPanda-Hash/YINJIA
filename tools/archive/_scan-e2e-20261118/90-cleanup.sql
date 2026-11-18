/* ============================================================
   90-cleanup.sql — 扫码全流程自测后的清理(只删本次自测造出来的**无库存影响**的单据)
   保留(有库存/工序影响,删了会造成账面不一致,已在本目录 README 里登记):
     · TL-2026-11-0009  生产退料单(生产退料流程,已审核 ⇒ 库存 +1)
     · BG-2026-11-0001  报工单(工序报工流程,已审核 ⇒ 成型工序进度 +1)
   删除(都还是草稿/未过账):
     · wo_pick_doc / wo_pick_line:GD-2026-11-0010 第 3 行的组装+混料两张领料单
     · bd_material_out / bl_material_out / yj_doc_status:LL-2026-11-0031(领料提交生成的出库单草稿)
     · bd_other_out / bl_other_out / yj_doc_status:OO-2026-11-0007/0009/0010
     · bd_material_ret / bl_material_ret / yj_doc_status:TL-2026-11-0010/0011
     · wo_mixing_list:混料单 PL2611170001 的 2 行
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'HSDZ_MES_TEST'
    THROW 51000, N'这是自测清理脚本,只允许在测试账套执行。', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    /* ① 领料台账 + 明细(本次自测那两张:组装 + 混料) */
    DELETE FROM dbo.wo_pick_line
     WHERE 单头id IN (SELECT id FROM dbo.wo_pick_doc WHERE 工单号 = N'GD-2026-11-0010' AND 工单行号 = 3);
    SELECT @@ROWCOUNT AS 删领料明细;
    DELETE FROM dbo.wo_pick_doc WHERE 工单号 = N'GD-2026-11-0010' AND 工单行号 = 3;
    SELECT @@ROWCOUNT AS 删领料台账;

    /* ② 提交生成的材料出库单草稿(未审核 ⇒ 没动库存) */
    DELETE FROM dbo.bl_material_out WHERE 单据编号 = N'LL-2026-11-0031';
    SELECT @@ROWCOUNT AS 删出库明细;
    DELETE FROM dbo.bd_material_out WHERE 单据编号 = N'LL-2026-11-0031';
    SELECT @@ROWCOUNT AS 删出库单;
    DELETE FROM dbo.yj_doc_status WHERE panel_code = N'MATERIAL_OUT' AND doc_no = N'LL-2026-11-0031';
    SELECT @@ROWCOUNT AS 删出库状态;

    /* ③ 其他领料(其他出库单)草稿 —— 含空单 OO-2026-11-0010 */
    DELETE FROM dbo.bl_other_out WHERE 单据编号 IN (N'OO-2026-11-0007', N'OO-2026-11-0009', N'OO-2026-11-0010');
    SELECT @@ROWCOUNT AS 删其他出库明细;
    DELETE FROM dbo.bd_other_out WHERE 单据编号 IN (N'OO-2026-11-0007', N'OO-2026-11-0009', N'OO-2026-11-0010');
    SELECT @@ROWCOUNT AS 删其他出库单;
    DELETE FROM dbo.yj_doc_status WHERE panel_code = N'OTHER_OUT'
       AND doc_no IN (N'OO-2026-11-0007', N'OO-2026-11-0009', N'OO-2026-11-0010');
    SELECT @@ROWCOUNT AS 删其他出库状态;

    /* ④ 其他退料(生产退料单草稿) */
    DELETE FROM dbo.bl_material_ret WHERE 单据编号 IN (N'TL-2026-11-0010', N'TL-2026-11-0011');
    SELECT @@ROWCOUNT AS 删退料草稿明细;
    DELETE FROM dbo.bd_material_ret WHERE 单据编号 IN (N'TL-2026-11-0010', N'TL-2026-11-0011');
    SELECT @@ROWCOUNT AS 删退料草稿单;
    DELETE FROM dbo.yj_doc_status WHERE panel_code = N'MATERIAL_RET'
       AND doc_no IN (N'TL-2026-11-0010', N'TL-2026-11-0011');
    SELECT @@ROWCOUNT AS 删退料草稿状态;

    /* ⑤ 混料记录(本次自测的混料单 PL2611170001) */
    DELETE FROM dbo.wo_mixing_list WHERE 单据编号 = N'PL2611170001';
    SELECT @@ROWCOUNT AS 删混料记录;

    /* ⑥ 回读:工单恢复「未开单」、没有残留 */
    SELECT (SELECT COUNT(*) FROM dbo.wo_pick_doc WHERE 工单号 = N'GD-2026-11-0010' AND 工单行号 = 3) AS 领料台账残留,
           (SELECT COUNT(*) FROM dbo.bd_material_out WHERE 单据编号 = N'LL-2026-11-0031') AS 出库单残留,
           (SELECT COUNT(*) FROM dbo.bd_other_out WHERE 单据编号 >= N'OO-2026-11-0007') AS 其他出库残留,
           (SELECT COUNT(*) FROM dbo.wo_mixing_list WHERE 单据编号 = N'PL2611170001') AS 混料记录残留,
           (SELECT COUNT(*) FROM dbo.wo_pick_line l LEFT JOIN dbo.wo_pick_doc d ON d.id = l.单头id WHERE d.id IS NULL) AS 孤儿领料明细;

    COMMIT TRANSACTION;
    SELECT N'RESULT: OK — 自测的单据已清理(TL-2026-11-0009 / BG-2026-11-0001 保留)' AS 结果;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    SELECT N'RESULT: FAIL — ' + ERROR_MESSAGE() AS 结果;
    THROW;
END CATCH
