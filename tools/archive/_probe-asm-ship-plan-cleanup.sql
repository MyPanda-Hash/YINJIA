-- 【仅测试账套 HSDZ_MES_TEST】清掉 _probe-asm-ship-plan-fixture.sql 造的探针夹具
IF DB_NAME() <> N'HSDZ_MES_TEST'
    THROW 51000, N'本清理只允许在测试账套 HSDZ_MES_TEST 执行', 1;

DELETE FROM dbo.rd_insp_plan_detail WHERE [单据编号] = N'PROBE-ASM-IP-001';
DELETE FROM dbo.rd_insp_plan_head   WHERE [单据编号] = N'PROBE-ASM-IP-001';

SELECT N'清理后残留(应为 0)' AS 步骤,
       (SELECT COUNT(*) FROM dbo.rd_insp_plan_head   WHERE [单据编号]=N'PROBE-ASM-IP-001') AS 头,
       (SELECT COUNT(*) FROM dbo.rd_insp_plan_detail WHERE [单据编号]=N'PROBE-ASM-IP-001') AS 行;
