/* ============================================================
   seed-mobile-pick-all-stages-20261030.sql — 「手机扫码 · 生产领料」**全环节**测试数据

   ⚠⚠ **只允许在测试账套 HSDZ_MES_TEST 执行**(脚本开头有硬库名闸门)。

   ------------------------------------------------------------
   用户口径:「每个环节至少 10 条」
   ------------------------------------------------------------
   不只是"造 10 张工单",而是把**每一个可测试的环节**都铺满 ≥10 条,
   这样每个界面状态打开就有东西看、每个操作都有得点。

   环节与配额(共 50 张工单):

     ┌────┬──────────────────────┬──────┬───────────────────────────────┐
     │序号│ 环节                  │ 条数 │ 你能测什么                      │
     ├────┼──────────────────────┼──────┼───────────────────────────────┤
     │ ①  │ 未开单(可正常开)      │  10  │ 扫工单 → 生成 → 生单成功          │
     │ ②  │ 未开单(开不了:未排产)  │  10  │ 开单被拦 + 未开单组里的红标签      │
     │ ③  │ 已开单 · 一项没领      │  10  │ 进单据 → 扫物料 → 填数量         │
     │ ④  │ 已开单 · 领了一部分    │  10  │ 接着把剩下的领完 → 提交           │
     │ ⑤  │ 已完成(可退料)        │  10  │ 扫码退料 → 生成其他入库单        │
     │ ⑥  │ 已完成 · 已退过料      │  10  │ 再退一次、看「含退料」徽标与累计可退  │
     └────┴──────────────────────┴──────┴───────────────────────────────┘

   ★ 哪些是"造数据"、哪些是"真跑流程"
     ③④⑤⑥ 不是直接在库里伪造单据,而是**真的调用生单/领料/提交/退料接口**跑出来的
     (见配套脚本 seed-mobile-pick-all-stages-20261030.mjs)。原因:
       领料单、材料出库单、库存台账、退料台账之间有一整条过账链,
       手工 INSERT 必然与真实过账分叉(库存对不上、工单回写不对、状态推不出来),
       测出来的东西也就不可信。
     ⇒ 本 .sql 只负责**基底数据**(工单 + 组装工艺清单),状态由 mjs 用接口推。

   ★ 幂等
     先删 GD-STG-* 的工单与 AP-STG-* 的清单,再重建。不动其它数据。
   ============================================================ */
SET NOCOUNT ON;
GO

DECLARE @dbNow sysname = DB_NAME();
IF @dbNow <> N'HSDZ_MES_TEST'
BEGIN
    RAISERROR(N'[拒绝执行] 本脚本只允许在测试账套 HSDZ_MES_TEST 运行,当前库:%s', 16, 1, @dbNow);
    RETURN;
END
GO

/* ---------- ① 清掉本批(stages)数据 ---------- */
DELETE FROM dbo.rd_asm_proc_detail WHERE 单据编号 LIKE N'AP-STG-%';
DELETE FROM dbo.rd_asm_proc_head   WHERE 单据编号 LIKE N'AP-STG-%';
DELETE FROM dbo.plang               WHERE pl_no LIKE N'GD-STG-%';
GO

/* ---------- ② 50 张工单 ----------
   命名:GD-STG-<组><序号>,组 = A(未开单) B(未排产) C(已开未领) D(领一半) E(已完成) F(已退料)
   ⚠ plang.comm 是 NOT NULL(公司代码 '0')。 */
DECLARE @wo TABLE (no varchar(20), dm nvarchar(100), mc nvarchar(200),
                   gg nvarchar(200), jldw nvarchar(20), pl_sl decimal(18,4), scx nvarchar(50));
DECLARE @i int = 1;

-- A:未开单(10) —— 排产正常,可以正常开单
WHILE @i <= 10
BEGIN
    INSERT INTO @wo VALUES (
        'GD-STG-A' + RIGHT('0' + CAST(@i AS varchar(2)), 2),
        N'B-05-01', N'PP复合A级炭棒/滤芯', N'40.5*16*68.5', N'支',
        500 + @i * 10, N'一线');
    SET @i = @i + 1;
END

-- B:未排产(10) —— 排产数量 0,开单应被拦
SET @i = 1;
WHILE @i <= 10
BEGIN
    INSERT INTO @wo VALUES (
        'GD-STG-B' + RIGHT('0' + CAST(@i AS varchar(2)), 2),
        N'B-06-01', N'A级烧结炭棒/滤芯', N'32.5*16*204', N'支',
        0, N'');
    SET @i = @i + 1;
END

-- C:已开单未领(10)
SET @i = 1;
WHILE @i <= 10
BEGIN
    INSERT INTO @wo VALUES (
        'GD-STG-C' + RIGHT('0' + CAST(@i AS varchar(2)), 2),
        N'B-06-02', N'A级烧结炭棒/滤芯', N'45*20*150', N'支',
        300 + @i * 10, N'二线');
    SET @i = @i + 1;
END

-- D:领了一部分(10)
SET @i = 1;
WHILE @i <= 10
BEGIN
    INSERT INTO @wo VALUES (
        'GD-STG-D' + RIGHT('0' + CAST(@i AS varchar(2)), 2),
        N'B-05-02', N'X+级烧结炭棒/滤芯', N'50*25*200', N'支',
        400 + @i * 10, N'一线');
    SET @i = @i + 1;
END

-- E:已完成(10) —— 可退料
SET @i = 1;
WHILE @i <= 10
BEGIN
    INSERT INTO @wo VALUES (
        'GD-STG-E' + RIGHT('0' + CAST(@i AS varchar(2)), 2),
        N'B-009-001', N'S阻垢炭棒/滤芯', N'30*15*100', N'支',
        200 + @i * 10, N'二线');
    SET @i = @i + 1;
END

-- F:已完成且已退过料(10)
SET @i = 1;
WHILE @i <= 10
BEGIN
    INSERT INTO @wo VALUES (
        'GD-STG-F' + RIGHT('0' + CAST(@i AS varchar(2)), 2),
        N'B-06-03', N'A级烧结炭棒/滤芯', N'38*18*120', N'支',
        150 + @i * 10, N'三线');
    SET @i = @i + 1;
END

INSERT INTO dbo.plang (comm, pl_no, pl_xc, pl_man, pl_date, dm, mc, gg, jldw, pl_sl, scx,
                       asp_user1, asp_time1, asp_cancel, 工艺路线)
SELECT N'0', no, 1, N'stage', SYSDATETIME(), dm, mc, gg, jldw, pl_sl, scx,
       N'stage', SYSDATETIME(), 'N', N'GY-CB-STD'
  FROM @wo;
GO

/* ---------- ③ 组装工艺清单(页签1「组装BOM表」)----------
   落点:rd_asm_proc_head + rd_asm_proc_detail(表区='物料清单')。
   每个产品一张 BOM,产品编号 = 工单的 dm。 */
DECLARE @bom TABLE (no varchar(20), dm nvarchar(100), seq int, item nvarchar(120),
                    nm nvarchar(200), spec nvarchar(100), usage nvarchar(50));
INSERT INTO @bom VALUES
 -- B-05-01(A 组 10 张 + 另有 DEMO 用):4 项
 ('AP-STG-01', N'B-05-01',  1, N'YJ-KBL-003',   N'热缩袋',       N'160*220', N'2'),
 ('AP-STG-01', N'B-05-01',  2, N'YJ-XMHYX-001', N'密封圈(黑色)', N'Φ12',     N'1'),
 ('AP-STG-01', N'B-05-01',  3, N'YJ-TBRW-001',  N'标签',         N'40*30',   N'1'),
 ('AP-STG-01', N'B-05-01',  4, N'YJ-JPL-034',   N'55目乳白网',   N'100目',   N'0.5'),
 -- B-06-01(B 组):3 项
 ('AP-STG-02', N'B-06-01',  1, N'YJ-KBL-017',   N'热缩袋',       N'180*240', N'2'),
 ('AP-STG-02', N'B-06-01',  2, N'YJ-XWR-016',   N'加工切无纺布', N'200*300', N'1'),
 ('AP-STG-02', N'B-06-01',  3, N'YJ-CH-004',    N'标签',         N'50*40',   N'2'),
 -- B-06-02(C 组):3 项
 ('AP-STG-03', N'B-06-02',  1, N'YJ-QJ-001',    N'OPP袋',        N'120*180', N'3'),
 ('AP-STG-03', N'B-06-02',  2, N'YJ-TBRW-001',  N'标签',         N'40*30',   N'1'),
 ('AP-STG-03', N'B-06-02',  3, N'YJ-XWR-021',   N'过滤棉',       N'120*200', N'1'),
 -- B-05-02(D 组):5 项
 ('AP-STG-04', N'B-05-02',  1, N'YJ-KBL-003',   N'热缩袋',       N'160*220', N'2'),
 ('AP-STG-04', N'B-05-02',  2, N'YJ-KBL-005',   N'热缩袋',       N'200*260', N'1'),
 ('AP-STG-04', N'B-05-02',  3, N'YJ-XWR-014',   N'白色无纺布100g', N'250*350', N'2'),
 ('AP-STG-04', N'B-05-02',  4, N'YJ-CH-012',    N'标签',         N'60*40',   N'1'),
 ('AP-STG-04', N'B-05-02',  5, N'YJ-XMHYX-001', N'密封圈(黑色)', N'Φ12',     N'2'),
 -- B-009-001(E 组):2 项
 ('AP-STG-05', N'B-009-001', 1, N'YJ-KBL-026',  N'气泡袋',       N'100*150', N'4'),
 ('AP-STG-05', N'B-009-001', 2, N'YJ-TBRW-001', N'标签',         N'40*30',   N'1'),
 -- B-06-03(F 组):3 项
 ('AP-STG-06', N'B-06-03',  1, N'YJ-SLD-009',   N'4012T1',       N'卷料',     N'0.5'),
 ('AP-STG-06', N'B-06-03',  2, N'YJ-XWR-012',   N'加工切无纺布(OTO)', N'180*260', N'1.25'),
 ('AP-STG-06', N'B-06-03',  3, N'YJ-KBL-003',   N'热缩袋',       N'160*220', N'2');

INSERT INTO dbo.rd_asm_proc_head (单据编号, 单据日期, 产品编号, 产品名称, 备注, asp_user1, asp_time1, asp_cancel)
SELECT DISTINCT b.no, N'2026-10-29', b.dm,
       (SELECT TOP 1 mc FROM dbo.plang WHERE dm = b.dm AND pl_no LIKE 'GD-STG-%'),
       N'全环节测试用组装BOM', N'stage', SYSDATETIME(), 'N'
  FROM @bom b
 WHERE NOT EXISTS (SELECT 1 FROM dbo.rd_asm_proc_head h WHERE h.单据编号 = b.no);

INSERT INTO dbo.rd_asm_proc_detail (单据编号, 表区, 序号, 物料编号, 物料名, 物料规格, 用量,
                                    asp_user1, asp_time1, asp_cancel)
SELECT b.no, N'物料清单', CAST(b.seq AS nvarchar(10)), b.item, b.nm, b.spec, b.usage,
       N'stage', SYSDATETIME(), 'N'
  FROM @bom b
 WHERE NOT EXISTS (SELECT 1 FROM dbo.rd_asm_proc_detail d
                    WHERE d.单据编号 = b.no AND d.物料编号 = b.item AND d.表区 = N'物料清单');
GO

/* ---------- ④ 自检:每张工单都能展开出用料 ---------- */
DECLARE @miss int;
SELECT @miss = COUNT(*) FROM dbo.plang p
 WHERE p.pl_no LIKE 'GD-STG-%' AND ISNULL(p.asp_cancel,'N') <> 'Y'
   AND NOT EXISTS (SELECT 1 FROM dbo.rd_asm_proc_detail d
                     JOIN dbo.rd_asm_proc_head h ON h.单据编号 = d.单据编号
                    WHERE h.产品编号 = p.dm AND d.表区 = N'物料清单'
                      AND ISNULL(d.asp_cancel,'N') <> 'Y' AND ISNULL(d.物料编号,'') <> '');
IF @miss > 0
   RAISERROR(N'[FAIL] 有 %d 张工单展不开用料', 16, 1, @miss);

/* ---------- ⑤ 基底报表 ---------- */
SELECT
    LEFT(p.pl_no, 6)                          AS 组别,
    COUNT(*)                                  AS 工单数,
    SUM(CASE WHEN p.pl_sl > 0 THEN 1 ELSE 0 END) AS 可开单,
    SUM(CASE WHEN p.pl_sl <= 0 THEN 1 ELSE 0 END) AS 不可开单,
    (SELECT COUNT(*) FROM dbo.rd_asm_proc_detail d
       JOIN dbo.rd_asm_proc_head h ON h.单据编号 = d.单据编号
      WHERE h.产品编号 = p.dm AND d.表区 = N'物料清单') AS BOM行数
  FROM dbo.plang p
 WHERE p.pl_no LIKE 'GD-STG-%' AND ISNULL(p.asp_cancel,'N') <> 'Y'
 GROUP BY LEFT(p.pl_no, 6), p.dm
 ORDER BY 组别;

PRINT N'[PASS] 基底就绪:50 张工单(6 组) + 6 张组装工艺清单';
PRINT N'      下一步:node tools/seed-mobile-pick-all-stages-20261030.mjs  (用接口把状态推到各环节)';
GO
