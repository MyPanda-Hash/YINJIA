-- 【仅测试账套 HSDZ_MES_TEST】UI 取证夹具:
--   给「组装成品检验单 ZJ-2026-10-0002 的产品 20200040001」挂一张出货检验计划,
--   以便在界面上验证「检验项目维护 → 来源②出货检验计划 → 勾选 → 带入明细(写表区/检查频率)」。
-- 幂等:先按单号删再插。用完跑 _q-asm-test-fixture-cleanup.sql 清掉。
IF DB_NAME() <> N'HSDZ_MES_TEST'
    THROW 51000, N'本夹具只允许在测试账套 HSDZ_MES_TEST 执行', 1;

DELETE FROM dbo.rd_insp_plan_detail WHERE [单据编号] = N'PROBE-ASM-IP-001';
DELETE FROM dbo.rd_insp_plan_head   WHERE [单据编号] = N'PROBE-ASM-IP-001';

INSERT INTO dbo.rd_insp_plan_head ([单据编号], [单据日期], [产品编号], [标题], [版本号], asp_user1, asp_time1)
VALUES (N'PROBE-ASM-IP-001', CAST(GETDATE() AS date), N'20200040001',
        N'【探针夹具】组装成品检验单取数用', N'V-PROBE', N'admin', GETDATE());

INSERT INTO dbo.rd_insp_plan_detail
    ([单据编号], [检验类别], [序号], [控制项目], [检验内容], [控制标准及要求], [控制方法], [检测频率], [备注], asp_user1, asp_time1)
VALUES
 (N'PROBE-ASM-IP-001', N'必测项',   N'10', N'外观-端盖两头', N'外观',     N'外观均匀完好，无弯曲变形、无明显划痕裂纹', N'目视',           N'1PCS/一个生产批次', N'每批首件必看', N'admin', GETDATE()),
 (N'PROBE-ASM-IP-001', N'必测项',   N'20', N'尺寸-外径',     N'重要尺寸', N'外径：44.5±0.5mm',                        N'游标卡尺测量',   N'1PCS/一个生产批次', N'首件+巡检',   N'admin', GETDATE()),
 (N'PROBE-ASM-IP-001', N'必测项',   N'30', N'出货重量',      N'重量',     N'＞200克',                                 N'电子秤称量',     N'1PCS/一个生产批次', NULL,           N'admin', GETDATE()),
 (N'PROBE-ASM-IP-001', N'型式检验', N'40', N'余氯去除率',    N'性能',     N'≥98%',                                    N'加标水通入5min后取样测试', N'型式检验', N'半年一次', N'admin', GETDATE());

SELECT N'夹具就绪' AS 步骤, h.[单据编号], h.[产品编号],
       (SELECT COUNT(*) FROM dbo.rd_insp_plan_detail d
         WHERE d.[单据编号]=h.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'Y') AS 计划行
FROM dbo.rd_insp_plan_head h WHERE h.[单据编号]=N'PROBE-ASM-IP-001';
