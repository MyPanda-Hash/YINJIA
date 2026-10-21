/* _probe-procshop-seed.sql —— ProcessShop 端到端验证用的**测试库**造数(只跑 HSDZ_MES_TEST)
 * 目的:验证「装箱」能进组装车间的线、不能进成型车间的线。
 * 造一条探针工单 PROBE-PROC-20261021(复制一条未排产行的全部列,只改身份/路线/数量)+ 路线 GY-2026-10-0001。
 * 收尾脚本见 _probe-procshop-clean.sql。
 */

-- ① 路线(乙级客户口径:成型 → 装箱)
IF NOT EXISTS (SELECT 1 FROM bs_route WHERE 工艺路线编码 = 'GY-2026-10-0001' AND 加工顺序 = 1)
    INSERT INTO bs_route (工艺路线编码, 工艺路线名称, 工序编码, 工序名称, 生产车间, 加工顺序, 换算率,
                          状态, asp_cancel, asp_user1, asp_time1)
    VALUES (N'GY-2026-10-0001', N'乙级客户路线(探针)', N'OP-CX', N'成型', N'成型', 1, 1,
            N'启用', N'N', N'probe', SYSDATETIME());

IF NOT EXISTS (SELECT 1 FROM bs_route WHERE 工艺路线编码 = 'GY-2026-10-0001' AND 加工顺序 = 2)
    INSERT INTO bs_route (工艺路线编码, 工艺路线名称, 工序编码, 工序名称, 生产车间, 加工顺序, 换算率,
                          状态, asp_cancel, asp_user1, asp_time1)
    VALUES (N'GY-2026-10-0001', N'乙级客户路线(探针)', N'OP-ZX', N'装箱', N'组装', 2, 1,
            N'启用', N'N', N'probe', SYSDATETIME());

-- ② 探针工单(幂等:先清掉同名探针单再复制)
DECLARE @probe INT = (SELECT TOP 1 id FROM plang WHERE pl_no = N'PROBE-PROC-20261021');
IF @probe IS NOT NULL
BEGIN
    DELETE FROM plang_pc WHERE plang_id = @probe;
    DELETE FROM wo_process_line WHERE 工单行id = @probe OR 工单号 = N'PROBE-PROC-20261021';
    DELETE FROM plang WHERE id = @probe;
END

DECLARE @src INT = (SELECT TOP 1 id FROM plang
                     WHERE ISNULL(asp_cancel, 'N') <> 'Y' AND ISNULL(scx, N'') = N''
                       AND ISNULL(xq_sl, 0) > 0 ORDER BY id);
IF @src IS NULL THROW 50000, N'测试库没有可复制的未排产行', 1;

IF OBJECT_ID('tempdb..#t') IS NOT NULL DROP TABLE #t;
SELECT * INTO #t FROM plang WHERE id = @src;

DECLARE @new INT = (SELECT ISNULL(MAX(id), 0) + 1000 FROM plang);
UPDATE #t SET id = @new, pl_no = N'PROBE-PROC-20261021', pl_xc = 1, scx = NULL,
              [工艺路线] = N'GY-2026-10-0001', pl_sl = 0, xq_sl = 100, rk_sl = 0,
              [批次号] = N'PROBE-20261021', ja = N'N', [完工状态] = NULL, [当前工序] = NULL
 WHERE id = @src;

SET IDENTITY_INSERT dbo.plang ON;
INSERT INTO plang SELECT * FROM #t;
SET IDENTITY_INSERT dbo.plang OFF;

SELECT @new AS probe_row_id, @src AS copied_from;
