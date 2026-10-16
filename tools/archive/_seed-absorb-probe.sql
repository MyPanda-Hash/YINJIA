/* _seed-absorb-probe.sql — 只读之外唯一写库动作：**仅测试库**造一组「手机端样式」报工数据,
   用于验证 ExternalReportAbsorbService(手机端报工吸收)→ 补镜像 / 推进状态 / 转序派线。
   幂等:先按工单号删除自己造过的行,再插入。库名守卫:非 _TEST 直接中止。 */
SET NOCOUNT ON;
DECLARE @db sysname = DB_NAME();
IF @db NOT LIKE N'%_TEST'
BEGIN
    RAISERROR(N'[ABORT] 本脚本只允许在测试库执行,当前库=%s', 16, 1, @db);
    RETURN;
END

DELETE FROM dbo.scjl WHERE gldh = N'GD-TEST-ABSORB-01';
DELETE FROM dbo.wo_process_line WHERE 工单号 = N'GD-TEST-ABSORB-01';
DELETE FROM dbo.wo_transfer_log WHERE pl_no = N'GD-TEST-ABSORB-01';
DELETE FROM dbo.plang_pc WHERE pl_no = N'GD-TEST-ABSORB-01';
DELETE FROM dbo.plang WHERE pl_no = N'GD-TEST-ABSORB-01';

-- ① 工单行(排产数量 20;路线 GY-CB-STD 成型换算率 3 ⇒ 成型计划量 60,报 100 = 超产)
INSERT INTO dbo.plang (comm, pl_no, pl_xc, pl_date, scx, khdm, dm, mc, gg, jldw, pl_sl, xq_sl, ja, od_no, od_xc,
                       [批次号], [工艺路线], asp_user1, asp_time1, asp_cancel)
VALUES (N'0', N'GD-TEST-ABSORB-01', 1, GETDATE(), NULL, N'KH-TEST', N'CP-TEST', N'吸收探针产品', N'100×50', N'件',
        20, 20, N'N', N'SO-TEST', 1, N'20261017', N'GY-CB-STD', N'absorb-probe', GETDATE(), N'N');
DECLARE @plang int = SCOPE_IDENTITY();

-- ② 排产行(plang_pc)——吸收要靠它补产线/班组/批次
INSERT INTO dbo.plang_pc (comm, pl_no, pl_xc, pl_date, scx, pl_sl, ja, plang_id, [批次号],
                          asp_user1, asp_time1, asp_cancel)
VALUES (N'0', N'GD-TEST-ABSORB-01', 1, GETDATE(), N'1号机', 20, N'N', @plang, N'20261017',
        N'absorb-probe', GETDATE(), N'N');
DECLARE @pc int = SCOPE_IDENTITY();

-- ③ 预排全程线台账(成型已落实 → 切炭/组装计划,计划线 2号机/3号机):转序要切的线在这里
INSERT INTO dbo.wo_process_line (工单号, 工单行id, 工序, 工序序, 计划生产线, 实际生产线, 计划数量, 状态,
                                 落实时间, asp_user1, asp_time1, asp_cancel)
VALUES (N'GD-TEST-ABSORB-01', @plang, N'成型', 1, N'1号机', N'1号机', 60, N'已落实', GETDATE(), N'absorb-probe', GETDATE(), N'N'),
       (N'GD-TEST-ABSORB-01', @plang, N'切炭', 2, N'2号机', NULL, 20, N'计划', NULL, N'absorb-probe', GETDATE(), N'N'),
       (N'GD-TEST-ABSORB-01', @plang, N'组装', 3, N'3号机', NULL, 20, N'计划', NULL, N'absorb-probe', GETDATE(), N'N');

-- ④ 手机端样式报工行:报工单号空、无产线(scx/scxmc 空)、产品列留空(等吸收补),数量 100 > 计划 60
INSERT INTO dbo.scjl (comm, sc_no, [报工单号], sc_date, gldh, gd_id, gxdm, sl, wgzt, wgsj,
                      scx, scxmc, [批次号], [工单行号], mc, gg, jldw, khdm, od_no, od_xc,
                      delmark, asp_user1, asp_time1, asp_cancel)
VALUES (N'0', N'GD-TEST-ABSORB-01', N'', GETDATE(), N'GD-TEST-ABSORB-01', @pc, N'成型', 100, N'Y', GETDATE(),
        NULL, NULL, N'20261017', NULL, NULL, NULL, NULL, NULL, NULL, NULL,
        0, N'mobile-probe', GETDATE(), N'N');

SELECT N'[OK] 种子:plang.id=' + CAST(@plang AS nvarchar(10)) + N' plang_pc.id=' + CAST(@pc AS nvarchar(10))
     + N' scjl 行=' + CAST(@@ROWCOUNT AS nvarchar(10)) AS msg;
