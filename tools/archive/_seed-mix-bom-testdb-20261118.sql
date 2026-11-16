/* _seed-mix-bom-testdb-20261118.sql — 演示/验收用:给测试账套的某产品补两条《物料清单》(BOM)

   为什么需要:扫码混料按用户口径读的是「一级BOM = 物料清单」(面板 WLBOM,底表 mate),
   而两个账套的 mate 现在都是 **0 行** —— 界面上走不了「扫工单 → 逐项扫料 → 保存」。
   为了能实测(截图/走流程),在**测试账套**补一份演示 BOM。

   ⚠ 只允许在 HSDZ_MES_TEST 跑(脚本自带库名硬闸门)。正式库的 BOM 由业务自己录/导,不要灌演示数据。
   ⚠ 幂等:同一产品(m_no)+ 子件(wzdm2)已存在就跳过。

   数据口径照着服务器老「混料记录」那 8 行的真实物料与单支含量:
     GD-2026-11-0015 行1(产品 A-45-01,排产 1002 支)
       YJ-TJHZ-001  雅可比CS(80-200)        单支 0.086 kg
       YJ-YKRS-005  英克瑞斯椰壳活性炭      单支 0.021 kg
   ⇒ 应投量 = 0.086 × 1002 ≈ 86.172 / 0.021 × 1002 ≈ 21.042

   执行:tools\ 下
     YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\mssql-jdbc.jar DbSync.java run ..\tools\archive\_seed-mix-bom-testdb-20261118.sql
   或直接 SqlRunner 指到 HSDZ_MES_TEST。
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'HSDZ_MES_TEST'
    THROW 51000, N'本脚本只允许在 HSDZ_MES_TEST(测试账套)执行:正式库的物料清单由业务维护。', 1;

IF OBJECT_ID(N'dbo.mate', N'U') IS NULL
    THROW 51000, N'mate(物料清单)表不存在。', 1;

DECLARE @product nvarchar(400) = N'A-45-01';
DECLARE @pname   nvarchar(400) = N'A烧结炭棒/滤芯';

DECLARE @bom TABLE (xc int, code nvarchar(400), name nvarchar(400), spec nvarchar(400),
                    uom nvarchar(400), per decimal(18,8));
INSERT INTO @bom (xc, code, name, spec, uom, per) VALUES
    (1, N'YJ-TJHZ-001', N'雅可比CS(80-200)',   N'粉料', N'kg', 0.086),
    (2, N'YJ-YKRS-005', N'英克瑞斯椰壳活性炭', N'粉料', N'kg', 0.021);

INSERT INTO dbo.mate (m_no, m_date, wzdm1, wzmc1, jldw1, xc, wzdm2, wzmc2, gg2, jldw2,
                      bzl, sl2, in_dj, jine, bz, asp_cancel, asp_user1, asp_time1)
SELECT @product, CAST(GETDATE() AS date), @product, @pname, N'支', b.xc, b.code, b.name, b.spec, b.uom,
       b.per, 0, 0, 0, N'扫码混料验收演示数据(测试账套)', 'N', N'admin', GETDATE()
  FROM @bom b
 WHERE NOT EXISTS (SELECT 1 FROM dbo.mate m
                    WHERE m.m_no = @product AND m.wzdm2 = b.code AND ISNULL(m.asp_cancel,'N') <> 'Y');

SELECT m_no, xc, wzdm2, wzmc2, bzl, jldw2
  FROM dbo.mate WHERE m_no = @product ORDER BY xc;
SELECT N'RESULT: SEED-BOM-OK' AS 结果;
