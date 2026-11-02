/* ============================================================
   seed-mobile-pick-real-20261030.sql — 「手机扫码·生产领料」真实数据基础

   ⚠⚠ **只允许在 HSDZ_MES_TEST 执行**(硬库名闸门)。

   ------------------------------------------------------------
   用户口径(2026-10-30 最终版)
   ------------------------------------------------------------
   ① 「测试的工单要从工单结转转过来」—— 工单不由本脚本直接插 plang,
      必须由**真实销售订单行**经「订单结转 → 转工单」生成(见配套 .mjs);
   ② 「对应的 bom 生成的领料单明细,应该是每条明细的 bom 组成个数 × 工单需求数量」;
   ③ 「数据都用真实数据」—— 产品/客户/物料/库存全部取正式库现有档案。

   ------------------------------------------------------------
   本脚本:给 **40 个真实在售产品**建《组装工艺清单》的「物料清单」表区
   ------------------------------------------------------------
   这 40 个产品取自正式库「待结转」里**剩余数量 ≤1500、且尚未转出**的订单行
   (共 103 行可选)—— 量小,一轮跑完不会把库存领爆,
   也够铺满 4 个环节 × 10 条 = 40 张工单。

   用料:每个产品用同一套**通用包装辅料**(恒亿仓实测有货的真实物料),
        「用量」= **每 1 个成品**的用量。真实 BOM 应由工艺维护,
        这里只是为了把流程数据铺开(页面上能对得上:数量 = 用量 × 工单数量)。

   ⚠ 只建 BOM,不建工单(工单由 .mjs 走结转接口生成)。
   ⚠ 幂等:按 AP-REAL- 前缀先删后建。
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

/* ---------- ① 清理本批 ---------- */
DELETE FROM dbo.rd_asm_proc_detail WHERE 单据编号 LIKE N'AP-REAL-%';
DELETE FROM dbo.rd_asm_proc_head   WHERE 单据编号 LIKE N'AP-REAL-%';
GO

/* ---------- ② 挑 40 个真实在售产品 ----------
   判据与 .mjs 一致:待结转行、剩余数量 >0、≤1500、按剩余升序取前 40 个产品。
   ⚠ 取数逻辑必须与 .mjs 的订单行池一致,否则会出现"BOM 建了但订单行没了"。 */
/* 🔴 产品清单的唯一真源 = _realSeedProducts(下面这段 INSERT,由 --plan 生成)
   mjs --plan 拉真实待结转、按产品聚合、剩余<=1500、升序取前 N 个,
   然后**把同一份清单写进本脚本**(它直接改这个文件里的清单区)。
   为什么不再让 SQL 自己算:第一版 SQL 按订单行筛、mjs 按产品聚合筛,
   两边选出的产品只有 1 个交集 —— 建了 BOM 的没订单行、有订单行的没 BOM,整轮全失败。 */
CREATE TABLE #plan (dm nvarchar(100) PRIMARY KEY);
INSERT INTO #plan (dm) VALUES
  (N'A-32-26'),
  (N'A-32-32'),
  (N'A-32-27'),
  (N'B-81-02'),
  (N'D-01-18'),
  (N'C-109-06'),
  (N'S071-2'),
  (N'T042-2'),
  (N'S051-4'),
  (N'S062-2'),
  (N'S042-1'),
  (N'T233'),
  (N'B-92-05'),
  (N'A-48-35'),
  (N'T062-2'),
  (N'S042-2'),
  (N'C-95-19'),
  (N'D-01-49'),
  (N'B-92-20'),
  (N'C-95-01'),
  (N'T223'),
  (N'T073-1'),
  (N'T211-2'),
  (N'T042'),
  (N'T042-6'),
  (N'S102-1'),
  (N'S031-1'),
  (N'C-89-04'),
  (N'A-48-16'),
  (N'A-48-18'),
  (N'C-109-05'),
  (N'D-58-01'),
  (N'B-84-13'),
  (N'A-42-04'),
  (N'D-01-50'),
  (N'A-45-01'),
  (N'D-18-10'),
  (N'C-78-21'),
  (N'C-95-13'),
  (N'T073');
-- ⚠ 表变量必须在**本批次**里 DECLARE;之前替换时把声明行弄丢了,报「必须声明标量变量 "@pid"」
DECLARE @pid TABLE (seq int IDENTITY(1,1), dm nvarchar(100), mc nvarchar(200));
INSERT INTO @pid (dm, mc)
SELECT p.dm, ISNULL(i.存货名称, p.dm)
  FROM #plan p LEFT JOIN dbo.bs_inv i ON i.存货编码 = p.dm AND ISNULL(i.asp_cancel,'N') <> 'Y'
 ORDER BY p.dm;

-- 产品名称以正式库档案为准(bs_inv)
UPDATE p SET p.mc = ISNULL(i.存货名称, ISNULL(p.mc, p.dm))
  FROM @pid p LEFT JOIN dbo.bs_inv i ON i.存货编码 = p.dm AND ISNULL(i.asp_cancel,'N') <> 'Y';

/* ---------- ③ 为每个产品建 BOM(3 项通用包装辅料) ----------
   用量按"每 1 个成品"给:
     YJ-KBL-003 热缩袋  × 1
     YJ-TBRW-001 标签   × 1
     YJ-XWR-016 加工切无纺布 × 0.5(半张)
   这三个是恒亿仓实测有货量最大的辅料,足够撑住 40 张工单的领料。 */
DECLARE @bom TABLE (bomNo varchar(20), dm nvarchar(100), mc nvarchar(200), seq int,
                    item nvarchar(120), nm nvarchar(200), spec nvarchar(100), uso nvarchar(50));

INSERT INTO @bom (bomNo, dm, mc, seq, item, nm, spec, uso)
SELECT 'AP-REAL-' + RIGHT('00' + CAST(p.seq AS varchar(3)), 3), p.dm, p.mc, v.seq, v.item, v.nm, v.spec, v.uso
  FROM @pid p
 CROSS JOIN (VALUES
     (1, N'YJ-KBL-003', N'热缩袋',         N'160*220', N'0.01'),
     (2, N'YJ-TBRW-001', N'标签',          N'40*30',   N'0.01'),
     (3, N'YJ-XWR-016',  N'加工切无纺布',  N'200*300', N'0.005')
 ) v(seq, item, nm, spec, uso);

INSERT INTO dbo.rd_asm_proc_head (单据编号, 单据日期, 产品编号, 产品名称, 备注,
                                  asp_user1, asp_time1, asp_cancel)
SELECT DISTINCT b.bomNo, N'2026-10-29', b.dm, b.mc,
       N'手机扫码测试用组装BOM(真实产品 + 真实辅料)',
       N'seed', SYSDATETIME(), 'N'
  FROM @bom b
 WHERE NOT EXISTS (SELECT 1 FROM dbo.rd_asm_proc_head h WHERE h.单据编号 = b.bomNo);

INSERT INTO dbo.rd_asm_proc_detail (单据编号, 表区, 序号, 物料编号, 物料名, 物料规格, 用量,
                                    asp_user1, asp_time1, asp_cancel)
SELECT b.bomNo, N'物料清单', CAST(b.seq AS nvarchar(10)), b.item, b.nm, b.spec, b.uso,
       N'seed', SYSDATETIME(), 'N'
  FROM @bom b
 WHERE NOT EXISTS (SELECT 1 FROM dbo.rd_asm_proc_detail d
                    WHERE d.单据编号 = b.bomNo AND d.物料编号 = b.item AND d.表区 = N'物料清单');
GO

/* ---------- ④ 自检 ---------- */
DECLARE @boms int, @miss int, @nostock int;
SELECT @boms = COUNT(*) FROM dbo.rd_asm_proc_head WHERE 单据编号 LIKE N'AP-REAL-%';
SELECT @miss = COUNT(*) FROM dbo.rd_asm_proc_head h
 WHERE h.单据编号 LIKE N'AP-REAL-%'
   AND NOT EXISTS (SELECT 1 FROM dbo.rd_asm_proc_detail d
                    WHERE d.单据编号 = h.单据编号 AND d.表区 = N'物料清单');
SELECT @nostock = COUNT(DISTINCT d.物料编号)
  FROM dbo.rd_asm_proc_detail d
 WHERE d.单据编号 LIKE N'AP-REAL-%' AND d.表区 = N'物料清单'
   AND NOT EXISTS (SELECT 1 FROM dbo.v_stock_pick s
                    WHERE s.存货编码 = d.物料编号 AND s.仓库 = N'恒亿仓' AND s.现存量 > 0);

DECLARE @want int = (SELECT COUNT(*) FROM #plan);
IF @boms < @want RAISERROR(N'[FAIL] 清单 %d 个产品,只建出 %d 张 BOM', 16, 1, @want, @boms);
IF @miss > 0  RAISERROR(N'[FAIL] 有 %d 张 BOM 没有物料清单行', 16, 1, @miss);
IF @nostock > 0
   PRINT N'[WARN] 有 ' + CAST(@nostock AS nvarchar(10)) + N' 个物料在恒亿仓没货';
GO

/* ---------- ⑤ 报表 ---------- */
SELECT COUNT(*) AS BOM张数,
       (SELECT COUNT(*) FROM dbo.rd_asm_proc_detail WHERE 单据编号 LIKE N'AP-REAL-%' AND 表区 = N'物料清单') AS 用料行数
  FROM dbo.rd_asm_proc_head WHERE 单据编号 LIKE N'AP-REAL-%';
GO

PRINT N'[PASS] 40 张真实在售产品 BOM 就绪';
PRINT N'      下一步:node tools/seed-mobile-pick-real-20261030.mjs --run';
GO
