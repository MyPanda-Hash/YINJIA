/* ============================================================
   seed-mobile-pick-demo-20261030.sql — 「手机扫码 · 生产领料」演示/测试数据集

   ⚠⚠ **只允许在测试账套 HSDZ_MES_TEST 执行**(脚本里有硬库名闸门,正式库直接 RAISERROR 退出)。

   目的:让用户能**逐步**测通整条流程,每一步都有可操作的数据:
     A. 开单工作台:扫工单 → 批量生成领料单(每张工单都可点)
     B. 生产领料:未完成/已完成分组、扫码定位、单据内扫码核销、全部领完提交
     C. 生产退料:已完成单再次扫码退料、累计可退、退料标志

   ------------------------------------------------------------
   ★ 数据设计(为什么是这些)
   ------------------------------------------------------------
   10 张工单,覆盖现场会遇到的情况:
     · G1~G3  标准单(2~3 项料)—— 走通"扫工单 → 领完 → 提交 → 退料"主流程
     · G4     单行 1 项料 —— 最快跑通,适合第一次试
     · G5     5 项料(多行)—— 验证长列表、逐项核销
     · G6     含小数用量(0.5/1.25)—— 验证 4 位小数与拆批
     · G7     含大批量料(整千)—— 验证数量输入与库存充足判定
     · G8     同产品不同工单(与 G1 同 BOM)—— 验证按工单行独立开单
     · G9     未排产(排产数量 0)—— 验证异常提示(不该能领)
     · G10    已结案 —— 验证异常提示

   物料全部取**恒亿仓实测有货**的品种(BOM 里的量都远小于库存),
   保证"领多少都够",不会因为库存不足卡住验收。

   ------------------------------------------------------------
   ★ 幂等
   ------------------------------------------------------------
   先按前缀删除再插入(GD-DEMO-xx、AB2-DEMO-xx),重复执行得到同一套数据。
   **不动**用户已跑出来的业务单据(LL-xxx / OI-xxx 一张不删)。
   ============================================================ */
SET NOCOUNT ON;
GO

/* ---------- ★ 库名硬闸门:只许在测试账套 ---------- */
-- ⚠ RAISERROR 的消息参数只接受变量/常量,**不能直接写函数调用**
--   (写 DB_NAME() 会报「DB_NAME 附近有语法错误」—— 2026-10-30 实测)。
DECLARE @dbNow sysname = DB_NAME();
IF @dbNow <> N'HSDZ_MES_TEST'
BEGIN
    RAISERROR(N'[拒绝执行] 本脚本只允许在测试账套 HSDZ_MES_TEST 运行,当前库:%s', 16, 1, @dbNow);
    RETURN;
END
GO

/* ---------- ① 清理本批演示数据(只删本脚本产出的) ---------- */
DELETE FROM dbo.rd_asm_bom_detail
 WHERE 单据编号 IN (SELECT 单据编号 FROM dbo.rd_asm_bom_head WHERE 单据编号 LIKE N'AB2-DEMO-%');
DELETE FROM dbo.rd_asm_bom_head WHERE 单据编号 LIKE N'AB2-DEMO-%';
DELETE FROM dbo.plang WHERE pl_no LIKE N'GD-DEMO-%';
GO

/* ---------- ② 10 张工单 ----------
   ⚠ plang.comm 是 NOT NULL(公司代码,全库唯一 '0');
     漏掉会报「不能将值 NULL 插入列 'comm'」—— 2026-10-30 实测踩到。
   工单号用 GD-DEMO-01 .. GD-DEMO-10,行号统一 1(扫工单码 `0@GD-DEMO-01@1001` 即可)。 */
DECLARE @wo TABLE (
    no varchar(20), comm nvarchar(10), dm nvarchar(100), mc nvarchar(200),
    gg nvarchar(200), jldw nvarchar(20), pl_sl decimal(18,4), scx nvarchar(50), remark nvarchar(200)
);
INSERT INTO @wo (no, comm, dm, mc, gg, jldw, pl_sl, scx, remark) VALUES
 ('GD-DEMO-01', N'0', N'B-05-01', N'PP复合A级炭棒/滤芯', N'40.5*16*68.5', N'支', 1000, N'一线', N'标准单:2 项料,走通主流程'),
 ('GD-DEMO-02', N'0', N'B-06-01', N'A级烧结炭棒/滤芯',  N'32.5*16*204',  N'支',  800, N'一线', N'标准单:3 项料'),
 ('GD-DEMO-03', N'0', N'B-06-02', N'A级烧结炭棒/滤芯',  N'45*20*150',    N'支',  600, N'二线', N'标准单:2 项料(与 01 不同产品)'),
 ('GD-DEMO-04', N'0', N'B-009-001', N'S阻垢炭棒/滤芯',  N'30*15*100',    N'支',  300, N'二线', N'最简单:只有 1 项料,适合第一次试'),
 ('GD-DEMO-05', N'0', N'B-05-02', N'X+级烧结炭棒/滤芯', N'50*25*200',    N'支',  500, N'一线', N'多行单:5 项料,测长列表'),
 ('GD-DEMO-06', N'0', N'B-06-03', N'A级烧结炭棒/滤芯',  N'38*18*120',    N'支',  400, N'三线', N'小数用量:0.5 / 1.25'),
 ('GD-DEMO-07', N'0', N'B-05-01', N'PP复合A级炭棒/滤芯', N'40.5*16*68.5', N'支', 2000, N'一线', N'大批量:整千用量'),
 ('GD-DEMO-08', N'0', N'B-05-01', N'PP复合A级炭棒/滤芯', N'40.5*16*68.5', N'支',  120, N'三线', N'与 01 同产品不同工单(同 BOM)'),
 ('GD-DEMO-09', N'0', N'B-06-01', N'A级烧结炭棒/滤芯',  N'32.5*16*204',  N'支',    0, N'',     N'异常:未排产(排产数量 0)'),
 ('GD-DEMO-10', N'0', N'B-06-02', N'A级烧结炭棒/滤芯',  N'45*20*150',    N'支',  250, N'二线', N'异常:已结案(完工状态=Y)');

INSERT INTO dbo.plang (comm, pl_no, pl_xc, pl_man, pl_date, dm, mc, gg, jldw, pl_sl, scx,
                       asp_user1, asp_time1, asp_cancel, 工艺路线, 完工状态)
SELECT comm, no, 1, N'demo', SYSDATETIME(), dm, mc, gg, jldw, pl_sl, scx,
       N'demo', SYSDATETIME(), 'N', N'GY-CB-STD',
       CASE WHEN no = 'GD-DEMO-10' THEN N'Y' ELSE N'' END
  FROM @wo;
GO

/* ---------- ③ 组装BOM表(按产品;同产品只建一张,与上一批同产品自然共用) ----------
   每张 BOM 挂在一个产品编号上,产品编号 = 工单的 dm,
   这样不会和用户自己维护的正式 BOM 打架。
   取数键 = 产品编号 —— 后端 latestAsmBom 按产品编号取最新未作废的一张。 */
DECLARE @bom TABLE (no varchar(20), seq int, item nvarchar(120), nm nvarchar(200), spec nvarchar(100), usage nvarchar(50));

-- G1 / G7 / G8 共用 B-05-01 的 BOM(同一产品,3 项料)
INSERT INTO @bom (no, seq, item, nm, spec, usage) VALUES
 ('B-05-01-A', 1, N'YJ-KBL-003', N'热缩袋',       N'160*220', N'2'),
 ('B-05-01-A', 2, N'YJ-XMHYX-001', N'密封圈(黑色)', N'Φ12',     N'1'),
 ('B-05-01-A', 3, N'YJ-TBRW-001', N'标签',         N'40*30',   N'1'),

-- G2 用的 B-06-01:3 项
 ('B-06-01-A', 1, N'YJ-KBL-017', N'热缩袋',   N'180*240', N'2'),
 ('B-06-01-A', 2, N'YJ-XWR-016', N'加工切无纺布', N'200*300', N'1'),
 ('B-06-01-A', 3, N'YJ-CH-004', N'标签',     N'50*40',   N'2'),

-- G3 用的 B-06-02:2 项
 ('B-06-02-A', 1, N'YJ-QJ-001', N'OPP袋',  N'120*180', N'3'),
 ('B-06-02-A', 2, N'YJ-TBRW-001', N'标签', N'40*30',   N'1'),

-- G4 用的 B-009-001:只有 1 项(最简单)
 ('B-009-001-A', 1, N'YJ-KBL-026', N'气泡袋', N'100*150', N'4'),

-- G5 用的 B-05-02:5 项(长列表)
 ('B-05-02-A', 1, N'YJ-KBL-003',  N'热缩袋',       N'160*220', N'2'),
 ('B-05-02-A', 2, N'YJ-KBL-005',  N'热缩袋',       N'200*260', N'1'),
 ('B-05-02-A', 3, N'YJ-XWR-014',  N'白色无纺布100g', N'250*350', N'2'),
 ('B-05-02-A', 4, N'YJ-CH-012',   N'标签',         N'60*40',   N'1'),
 ('B-05-02-A', 5, N'YJ-XMHYX-001', N'密封圈(黑色)', N'Φ12',     N'2'),

-- G6 用的 B-06-03:小数用量
 ('B-06-03-A', 1, N'YJ-SLD-009', N'4012T1',   N'卷料', N'0.5'),
 ('B-06-03-A', 2, N'YJ-XWR-012', N'加工切无纺布(OTO)', N'180*260', N'1.25'),
 ('B-06-03-A', 3, N'YJ-KBL-003', N'热缩袋',   N'160*220', N'2');

-- 插入 BOM 头(单据编号 = 产品编号 + '-BOM',便于识别;日期取老一点,保证是"最新一张")
INSERT INTO dbo.rd_asm_bom_head (单据编号, 单据日期, 产品编号, 产品名称, 备注, asp_user1, asp_time1, asp_cancel)
SELECT DISTINCT
       b.no, N'2026-10-29',
       REPLACE(b.no, N'-A', N''),
       (SELECT TOP 1 mc FROM dbo.plang WHERE dm = REPLACE(b.no, N'-A', N'') AND pl_no LIKE 'GD-DEMO-%'),
       N'手机扫码演示用组装BOM表',
       N'demo', SYSDATETIME(), 'N'
  FROM @bom b
 WHERE NOT EXISTS (SELECT 1 FROM dbo.rd_asm_bom_head h WHERE h.单据编号 = b.no);

-- 插入 BOM 行
INSERT INTO dbo.rd_asm_bom_detail (单据编号, 序号, 物料编号, 物料名, 物料规格, 用量, asp_user1, asp_time1, asp_cancel)
SELECT b.no, CAST(b.seq AS nvarchar(10)), b.item, b.nm, b.spec, b.usage, N'demo', SYSDATETIME(), 'N'
  FROM @bom b
 WHERE NOT EXISTS (SELECT 1 FROM dbo.rd_asm_bom_detail d
                    WHERE d.单据编号 = b.no AND d.物料编号 = b.item);
GO

/* ---------- ④ 自检:每张工单的 BOM 是否都能展开 ---------- */
DECLARE @miss TABLE (wo varchar(20), dm nvarchar(100), why nvarchar(200));
INSERT INTO @miss
SELECT p.pl_no, p.dm, N'没有对应的组装BOM表'
  FROM dbo.plang p
 WHERE p.pl_no LIKE 'GD-DEMO-%'
   AND NOT EXISTS (SELECT 1 FROM dbo.rd_asm_bom_head h
                    WHERE h.产品编号 = p.dm AND ISNULL(h.asp_cancel,'N') <> 'Y')
UNION ALL
SELECT p.pl_no, p.dm, N'BOM 表头有但没有明细行'
  FROM dbo.plang p
 WHERE p.pl_no LIKE 'GD-DEMO-%'
   AND EXISTS (SELECT 1 FROM dbo.rd_asm_bom_head h WHERE h.产品编号 = p.dm AND ISNULL(h.asp_cancel,'N') <> 'Y')
   AND NOT EXISTS (SELECT 1 FROM dbo.rd_asm_bom_detail d
                     JOIN dbo.rd_asm_bom_head h ON h.单据编号 = d.单据编号
                    WHERE h.产品编号 = p.dm AND ISNULL(d.asp_cancel,'N') <> 'Y'
                      AND ISNULL(d.物料编号,'') <> '');

IF EXISTS (SELECT 1 FROM @miss)
BEGIN
    DECLARE @msg nvarchar(1000) = (SELECT STRING_AGG(wo + N':' + why, N'; ') FROM @miss);
    RAISERROR(N'[FAIL] 有工单的 BOM 展不开:%s', 16, 1, @msg);
END
GO

/* ---------- ⑤ 报表:每张工单 + BOM 项数(照这个逐个测) ---------- */
SET NOCOUNT ON;
SELECT
    p.pl_no                                   AS 工单号,
    1                                         AS 工单行号,
    p.dm                                      AS 产品编号,
    p.mc                                      AS 产品名称,
    p.pl_sl                                   AS 排产数量,
    ISNULL(NULLIF(p.scx, N''), N'(未排产)')   AS 生产线,
    (SELECT COUNT(*) FROM dbo.rd_asm_bom_detail d
       JOIN dbo.rd_asm_bom_head h ON h.单据编号 = d.单据编号
      WHERE h.产品编号 = p.dm AND ISNULL(d.asp_cancel,'N') <> 'Y'
        AND ISNULL(d.物料编号,'') <> '')      AS BOM项数,
    CASE WHEN p.pl_sl <= 0 THEN N'异常:未排产,应被拦'
         WHEN ISNULL(p.完工状态,N'') = N'Y' THEN N'异常:已结案,应被拦'
         ELSE N'可测' END                     AS 预期
  FROM dbo.plang p
 WHERE p.pl_no LIKE 'GD-DEMO-%' AND ISNULL(p.asp_cancel,'N') <> 'Y'
 ORDER BY p.pl_no;

PRINT N'[PASS] 演示数据就绪:10 张工单 + 对应组装BOM表';
GO
