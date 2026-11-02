SET NOCOUNT ON;
DELETE FROM dbo.wo_pick_doc;
DELETE FROM yj_doc_status WHERE doc_no IN (SELECT 单据编号 FROM bd_material_out WHERE 加工单号 LIKE 'GD-E2E-%');
DELETE FROM bl_material_out WHERE 单据编号 IN (SELECT 单据编号 FROM bd_material_out WHERE 加工单号 LIKE 'GD-E2E-%');
DELETE FROM bd_material_out WHERE 加工单号 LIKE 'GD-E2E-%';
DELETE FROM bl_other_in WHERE 单据编号 IN (SELECT 单据编号 FROM bd_other_in WHERE 备注 LIKE '%GD-E2E-%');
DELETE FROM bd_other_in WHERE 备注 LIKE '%GD-E2E-%';
-- 再造一张工单行,用来验证"批量"确实能一次开两张
DELETE FROM dbo.plang WHERE pl_no='GD-E2E-0002';
INSERT INTO dbo.plang (comm, pl_no, pl_xc, pl_man, pl_date, dm, mc, gg, jldw, pl_sl, scx, asp_user1, asp_time1, asp_cancel, 工艺路线)
VALUES (N'0', N'GD-E2E-0002', 1, N'admin', SYSDATETIME(), N'B-70-04', N'X烧结PP复合阻垢碳棒/滤芯', N'32.5*16*204', N'支', 50, N'一线', N'e2e', SYSDATETIME(), 'N', N'GY-CB-STD');
SELECT 'reset ok' k, (SELECT COUNT(*) FROM plang WHERE pl_no LIKE 'GD-E2E-%') 工单行数;
