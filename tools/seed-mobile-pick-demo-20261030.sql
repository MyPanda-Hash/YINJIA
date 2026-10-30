/* ============================================================
   seed-mobile-pick-demo-20261030.sql — 「手机扫码 · 生产领料」演示/测试数据集

   ⚠⚠ **只允许在测试账套 HSDZ_MES_TEST 执行**(脚本里有硬库名闸门,正式库直接 RAISERROR 退出)。

   ------------------------------------------------------------
   ★★ 2026-10-30 重要修正:组装BOM 必须落在「组装工艺清单」 ★★
   ------------------------------------------------------------
   上一版把演示 BOM 写进了 `rd_asm_bom_head/_detail`(组装BOM表)—— **那是错的表**:
     · 组装BOM表**面板菜单早已下线**(2026-09-11 并入组装工艺清单第 2 页签);
     · 界面上用户在「研发管理 → 产品文件 → 组装工艺清单 → 页签1 组装BOM表」看到的是
       `rd_asm_proc_head` + `rd_asm_proc_detail(表区='物料清单')`;
     · 上一版数据写进已废弃的表 ⇒ **界面上 BOM 表是空的,而领料单却能领出料**,两边对不上。

   ⇒ 本版把 BOM 写进正确位置:
        rd_asm_proc_head(表头, 产品编号 = 工单的产品)
        rd_asm_proc_detail(表区='物料清单', 物料编号/物料名/物料规格/用量)
      用户打开组装工艺清单就能看到这份 BOM,和领料单逐项对得上。

   ------------------------------------------------------------
   数据集:10 张工单,覆盖现场会遇到的情况
     · GD-DEMO-01~03  标准单(2~3 项料)—— 走通"扫工单 → 领完 → 提交 → 退料"主流程
     · GD-DEMO-04     单行 1 项料 —— 最快跑通,适合第一次试
     · GD-DEMO-05     5 项料(多行)—— 验证长列表、逐项核销
     · GD-DEMO-06     含小数用量(0.5/1.25)—— 验证 4 位小数与拆批
     · GD-DEMO-07     大批量(整千)—— 验证数量输入与库存充足判定
     · GD-DEMO-08     同产品不同工单(与 01 同 BOM)—— 验证按工单行独立开单
     · GD-DEMO-09     未排产(排产数量 0)—— 验证开单拦截
     · GD-DEMO-10     已结案 —— 验证开单拦截

   物料全部取**恒亿仓实测有货**的品种(BOM 里的量都远小于库存),保证"领多少都够"。

   幂等:先按前缀删除再插入(GD-DEMO-xx、AP-DEMO-xx),重复执行得到同一套数据。
   **不动**用户已跑出来的业务单据(LL-xxx / OI-xxx 一张不删)。
   ============================================================ */
SET NOCOUNT ON;
GO

/* ---------- ★ 库名硬闸门:只许在测试账套 ----------
   ⚠ RAISERROR 的消息参数只接受变量/常量,不能直接写函数调用(写 DB_NAME() 会报语法错)。 */
DECLARE @dbNow sysname = DB_NAME();
IF @dbNow <> N'HSDZ_MES_TEST'
BEGIN
    RAISERROR(N'[拒绝执行] 本脚本只允许在测试账套 HSDZ_MES_TEST 运行,当前库:%s', 16, 1, @dbNow);
    RETURN;
END
GO

/* ---------- ① 清理本批演示数据(只删本脚本产出的) ---------- */
DELETE FROM dbo.rd_asm_proc_detail WHERE 单据编号 LIKE N'AP-DEMO-%';
DELETE FROM dbo.rd_asm_proc_head   WHERE 单据编号 LIKE N'AP-DEMO-%';
DELETE FROM dbo.plang WHERE pl_no LIKE N'GD-DEMO-%';
GO

/* ---------- ② 10 张工单 ----------
   ⚠ plang.comm 是 NOT NULL(公司代码,全库唯一 '0');漏掉会报「不能将值 NULL 插入列 'comm'」。 */
DECLARE @wo TABLE (
    no varchar(20), dm nvarchar(100), mc nvarchar(200),
    gg nvarchar(200), jldw nvarchar(20), pl_sl decimal(18,4), scx nvarchar(50)
);
INSERT INTO @wo (no, dm, mc, gg, jldw, pl_sl, scx) VALUES
 ('GD-DEMO-01', N'B-05-01',   N'PP复合A级炭棒/滤芯',   N'40.5*16*68.5', N'支', 1000, N'一线'),
 ('GD-DEMO-02', N'B-06-01',   N'A级烧结炭棒/滤芯',     N'32.5*16*204',  N'支',  800, N'一线'),
 ('GD-DEMO-03', N'B-06-02',   N'A级烧结炭棒/滤芯',     N'45*20*150',    N'支',  600, N'二线'),
 ('GD-DEMO-04', N'B-009-001', N'S阻垢炭棒/滤芯',       N'30*15*100',    N'支',  300, N'二线'),
 ('GD-DEMO-05', N'B-05-02',   N'X+级烧结炭棒/滤芯',    N'50*25*200',    N'支',  500, N'一线'),
 ('GD-DEMO-06', N'B-06-03',   N'A级烧结炭棒/滤芯',     N'38*18*120',    N'支',  400, N'三线'),
 ('GD-DEMO-07', N'B-05-01',   N'PP复合A级炭棒/滤芯',   N'40.5*16*68.5', N'支', 2000, N'一线'),
 ('GD-DEMO-08', N'B-05-01',   N'PP复合A级炭棒/滤芯',   N'40.5*16*68.5', N'支',  120, N'三线'),
 ('GD-DEMO-09', N'B-06-01',   N'A级烧结炭棒/滤芯',     N'32.5*16*204',  N'支',    0, N''),
 ('GD-DEMO-10', N'B-06-02',   N'A级烧结炭棒/滤芯',     N'45*20*150',    N'支',  250, N'二线');

INSERT INTO dbo.plang (comm, pl_no, pl_xc, pl_man, pl_date, dm, mc, gg, jldw, pl_sl, scx,
                       asp_user1, asp_time1, asp_cancel, 工艺路线, 完工状态)
SELECT N'0', no, 1, N'demo', SYSDATETIME(), dm, mc, gg, jldw, pl_sl, scx,
       N'demo', SYSDATETIME(), 'N', N'GY-CB-STD',
       CASE WHEN no = 'GD-DEMO-10' THEN N'Y' ELSE N'' END
  FROM @wo;
GO

/* ---------- ③ 组装工艺清单(页签1 组装BOM表)----------
   物理落点:rd_asm_proc_head + rd_asm_proc_detail(表区='物料清单')。
   单据编号用 AP-DEMO-xx(AP 是组装工艺清单的单号前缀,和界面一致),
   产品编号 = 工单的 dm,这样后端按产品编号就能找到它。 */
DECLARE @bom TABLE (no varchar(20), dm nvarchar(100), seq int, item nvarchar(120), nm nvarchar(200), spec nvarchar(100), usage nvarchar(50));

-- B-05-01(GD-DEMO-01/07/08 共用)
INSERT INTO @bom VALUES
 ('AP-DEMO-01', N'B-05-01', 1, N'YJ-KBL-003',    N'热缩袋',        N'160*220', N'2'),
 ('AP-DEMO-01', N'B-05-01', 2, N'YJ-XMHYX-001',  N'密封圈(黑色)',  N'Φ12',     N'1'),
 ('AP-DEMO-01', N'B-05-01', 3, N'YJ-TBRW-001',   N'标签',          N'40*30',   N'1'),
-- B-06-01(GD-DEMO-02/09)
 ('AP-DEMO-02', N'B-06-01', 1, N'YJ-KBL-017',    N'热缩袋',        N'180*240', N'2'),
 ('AP-DEMO-02', N'B-06-01', 2, N'YJ-XWR-016',    N'加工切无纺布',  N'200*300', N'1'),
 ('AP-DEMO-02', N'B-06-01', 3, N'YJ-CH-004',     N'标签',          N'50*40',   N'2'),
-- B-06-02(GD-DEMO-03/10)
 ('AP-DEMO-03', N'B-06-02', 1, N'YJ-QJ-001',     N'OPP袋',         N'120*180', N'3'),
 ('AP-DEMO-03', N'B-06-02', 2, N'YJ-TBRW-001',   N'标签',          N'40*30',   N'1'),
-- B-009-001(GD-DEMO-04,只有 1 项,最快跑通)
 ('AP-DEMO-04', N'B-009-001', 1, N'YJ-KBL-026',  N'气泡袋',        N'100*150', N'4'),
-- B-05-02(GD-DEMO-05,5 项长列表)
 ('AP-DEMO-05', N'B-05-02', 1, N'YJ-KBL-003',    N'热缩袋',        N'160*220', N'2'),
 ('AP-DEMO-05', N'B-05-02', 2, N'YJ-KBL-005',    N'热缩袋',        N'200*260', N'1'),
 ('AP-DEMO-05', N'B-05-02', 3, N'YJ-XWR-014',    N'白色无纺布100g', N'250*350', N'2'),
 ('AP-DEMO-05', N'B-05-02', 4, N'YJ-CH-012',     N'标签',          N'60*40',   N'1'),
 ('AP-DEMO-05', N'B-05-02', 5, N'YJ-XMHYX-001',  N'密封圈(黑色)',  N'Φ12',     N'2'),
-- B-06-03(GD-DEMO-06,小数用量)
 ('AP-DEMO-06', N'B-06-03', 1, N'YJ-SLD-009',    N'4012T1',        N'卷料',     N'0.5'),
 ('AP-DEMO-06', N'B-06-03', 2, N'YJ-XWR-012',    N'加工切无纺布(OTO)', N'180*260', N'1.25'),
 ('AP-DEMO-06', N'B-06-03', 3, N'YJ-KBL-003',    N'热缩袋',        N'160*220', N'2');

-- 表头(产品编号取该 BOM 对应的产品)
INSERT INTO dbo.rd_asm_proc_head (单据编号, 单据日期, 产品编号, 产品名称, 备注, asp_user1, asp_time1, asp_cancel)
SELECT DISTINCT b.no, N'2026-10-29', b.dm,
       (SELECT TOP 1 mc FROM dbo.plang WHERE dm = b.dm AND pl_no LIKE 'GD-DEMO-%'),
       N'手机扫码演示用组装BOM',
       N'demo', SYSDATETIME(), 'N'
  FROM @bom b
 WHERE NOT EXISTS (SELECT 1 FROM dbo.rd_asm_proc_head h WHERE h.单据编号 = b.no);

-- 明细行:⚠ 表区='物料清单' 是必须的 —— 这张行表由三张逻辑表共用
-- (修订记录/物料清单/关键控制清单),不带表区会把别人的行当成领料用料。
INSERT INTO dbo.rd_asm_proc_detail (单据编号, 表区, 序号, 物料编号, 物料名, 物料规格, 用量,
                                    asp_user1, asp_time1, asp_cancel)
SELECT b.no, N'物料清单', CAST(b.seq AS nvarchar(10)), b.item, b.nm, b.spec, b.usage,
       N'demo', SYSDATETIME(), 'N'
  FROM @bom b
 WHERE NOT EXISTS (SELECT 1 FROM dbo.rd_asm_proc_detail d
                    WHERE d.单据编号 = b.no AND d.物料编号 = b.item AND d.表区 = N'物料清单');
GO

/* ---------- ④ 自检:每张工单都必须能展开出用料 ---------- */
DECLARE @miss TABLE (wo varchar(20), dm nvarchar(100), why nvarchar(200));
INSERT INTO @miss
SELECT p.pl_no, p.dm, N'没有对应的组装工艺清单'
  FROM dbo.plang p
 WHERE p.pl_no LIKE 'GD-DEMO-%'
   AND NOT EXISTS (SELECT 1 FROM dbo.rd_asm_proc_head h
                    WHERE h.产品编号 = p.dm AND ISNULL(h.asp_cancel,'N') <> 'Y')
UNION ALL
SELECT p.pl_no, p.dm, N'清单存在但「物料清单」表区没有用料行'
  FROM dbo.plang p
 WHERE p.pl_no LIKE 'GD-DEMO-%'
   AND EXISTS (SELECT 1 FROM dbo.rd_asm_proc_head h WHERE h.产品编号 = p.dm AND ISNULL(h.asp_cancel,'N') <> 'Y')
   AND NOT EXISTS (SELECT 1 FROM dbo.rd_asm_proc_detail d
                     JOIN dbo.rd_asm_proc_head h ON h.单据编号 = d.单据编号
                    WHERE h.产品编号 = p.dm AND d.表区 = N'物料清单'
                      AND ISNULL(d.asp_cancel,'N') <> 'Y' AND ISNULL(d.物料编号,'') <> '');

IF EXISTS (SELECT 1 FROM @miss)
BEGIN
    DECLARE @msg nvarchar(1000) = (SELECT STRING_AGG(wo + N':' + why, N'; ') FROM @miss);
    RAISERROR(N'[FAIL] 有工单的用料展不开:%s', 16, 1, @msg);
END
GO

/* ---------- ⑤ 报表:每张工单 + 用料项数(照这个逐个测) ---------- */
SELECT
    p.pl_no                                   AS 工单号,
    p.dm                                      AS 产品编号,
    p.mc                                      AS 产品名称,
    p.pl_sl                                   AS 排产数量,
    ISNULL(NULLIF(p.scx, N''), N'(未排产)')   AS 生产线,
    (SELECT COUNT(*) FROM dbo.rd_asm_proc_detail d
       JOIN dbo.rd_asm_proc_head h ON h.单据编号 = d.单据编号
      WHERE h.产品编号 = p.dm AND d.表区 = N'物料清单'
        AND ISNULL(d.asp_cancel,'N') <> 'Y' AND ISNULL(d.物料编号,'') <> '')  AS 用料项数,
    CASE WHEN p.pl_sl <= 0 THEN N'异常:未排产,应被拦'
         WHEN ISNULL(p.完工状态,N'') = N'Y' THEN N'异常:已结案,应被拦'
         ELSE N'可测' END                     AS 预期
  FROM dbo.plang p
 WHERE p.pl_no LIKE 'GD-DEMO-%' AND ISNULL(p.asp_cancel,'N') <> 'Y'
 ORDER BY p.pl_no;

PRINT N'[PASS] 演示数据就绪:10 张工单 + 组装工艺清单(物料清单表区)';
GO
