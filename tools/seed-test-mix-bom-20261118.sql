/* ============================================================================
   seed-test-mix-bom-20261118.sql — 测试库「物料清单 / 半成品混料清单」补齐(演示/验收数据)

   用户口径(2026-11-18):「帮我补齐测试库的物料清单,对着未开单的工单补齐。」

   ⚠⚠ **只允许在测试账套 HSDZ_MES_TEST 执行**(脚本内有硬库名闸门,正式库直接 THROW)。
       这是演示/验收数据,不是迁移,**不要**登记进 tools/db-migrations.txt、**不要**推到服务器。

   ── 补齐口径(2026-11-18 用户拍板 A 案)──────────────────────────────────────
   背景事实(2026-11-18 实测,证据见 tools/archive/_mix-pick-bom-test-20261118/):
     · 未开单工单行 28 张 / 涉及半成品(编码含 **TB)23 个;
     · 全库 656 个 **TB 半成品里,**只有 D-02-03**TB 一个**有自己的清单(金蝶 BOM 引出带进来的);
     · 服务器快照(HSDZ_MES_manual_20261111 还原成 HSDZ_SRVSNAP)里真实「混料配方」
       (rd_mold_proc_detail)只剩 5 个产品有效(其余 11 张单 asp_cancel='Y' 已作废);
     · 服务器 mate(面板 WLBOM《物料清单》)38 行全是**组装件**且用量为 0,不能当混料用料。
   ⇒ 这 23 个半成品**没有任何真实配方可抄**,故按「同品类真实配方套用」补数:
       ① 半成品的《组装物料清单》(bs_asm_bom,产品编码=半成品编码)
          —— 这是「生成工单领料 → 混料领料单」的取数源(WorkOrderBomService.standardOf,
             工序='组装'、默认BOM='是'、状态='启用');
       ② 成品的《物料清单》(mate,面板 WLBOM,m_no=成品编码)
          —— 这是「手机扫码 → 扫码混料」的取数源(MixScanService.bomOf)。
      两份用的是**同一套混料配方**,单支用量一致,现场扫码与领料单才对得上。

   ── 配方来源(全部是服务器快照里在用的真实配方,按品类套用)───────────────────
     代号 R0 ← D-02-03**TB 自己的真实清单(折叠复合阻垢炭棒/滤芯,kg)
     代号 R1 ← A-48-41-tb「PP复合阻垢炭棒」
     代号 R2 ← A-48-43-tb「A级烧结炭棒/滤芯」
     代号 R3 ← A-54-08「阻垢炭棒滤芯」
     代号 R4 ← A-54-11「A+级阻垢炭棒/滤芯」
     代号 R5 ← A-54-12-tb「A+级烧结炭棒滤芯」
     原配方「单支物料含量」单位按 **g** 记录(经 rd_mold_proc_detail 实测:单支合计约 190~200 g);
     落到清单时按该物料的存货档案计量单位换算:kg ⇒ /1000(4 位小数),其它单位(如 HP-08 是 g)⇒ 原值。

   ── 另外补 2 张「连组装清单都没有」的工单产品(用户拍板:只补这两个,不补 A-32-26)────
     D-01-18「A+级烧结炭棒/滤芯」(半成品规格 34*12*24)
     T042-6 「A+级烧结炭棒/滤芯」(28*12*180)
     ⇒ 做法不是凭空造,而是**整份复制同品类真实组装清单**,只替换第 1 行的半成品:
       模板 T042-6 ← B-35-05-3_V0001(28*12*175,6 行:半成品+T筒+内盖+防尘塞×2+标签+纸箱)
       模板 D-01-18 ← A-32-06_V0003 (63*34*39.5,6 行:半成品+端盖×2+珍珠棉片+PE袋+纸箱;
                     原来选的 B-70-03_V0002 只有 2 行,补出来像缺包装,已换)
       包装件规格与本品略有差异(纸箱/标签),演示够用;真要用请按实际包装重维护。
     A-32-26「载银颗粒碳」是**粉料**(kg),不该有组装清单 ⇒ 按用户拍板**不补**。

   ── 幂等 ────────────────────────────────────────────────────────────────
     开头按**来源标记**删掉本脚本上一次写入的行,再全量重插;不碰任何手工维护的清单:
       bs_asm_bom.来源 IN ('测试库演示_混料配方套用_20261118','测试库演示_组装清单套用_20261118')
       mate.bz LIKE '测试库演示·混料配方套用%'
     顺手补两个物料的计量单位(档案为空,没单位生单必被拦「计量单位不能为空」):
       KG-AJE-A01(ANGEL-阻垢)、Sr-35200(富锶A-1) ⇒ kg(仅当为空时)

   执行(tools 目录):
     org:  $env:YINJIA_SQL_DB='HSDZ_MES_TEST'
     java -cp lib\mssql-jdbc.jar DbSync.java run seed-test-mix-bom-20261118.sql
     或:  java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar SqlRunner.java ^
            "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false" yinjia env ^
            seed-test-mix-bom-20261118.sql
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'HSDZ_MES_TEST'
    THROW 51000, N'本脚本是测试库演示数据,只允许在 HSDZ_MES_TEST 执行(正式库不要跑)。', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    /* ── ① 计量单位兜底(档案里这两个物料没单位,材料出库单生单会被拦)────────── */
    UPDATE dbo.bs_inv SET 计量单位 = N'kg'
     WHERE 存货编码 IN (N'KG-AJE-A01', N'Sr-35200') AND ISNULL(计量单位, N'') = N'';
    PRINT N'[1/6] 补计量单位(空才填):' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

    /* ── ② 幂等清理:只删本脚本自己写的 ────────────────────────────────── */
    DELETE FROM dbo.bs_asm_bom
     WHERE 来源 IN (N'测试库演示_混料配方套用_20261118', N'测试库演示_组装清单套用_20261118');
    PRINT N'[2/6] 清理上次写入的清单行:' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
    DELETE FROM dbo.mate WHERE bz LIKE N'测试库演示·混料配方套用%';
    PRINT N'      清理上次写入的物料清单行:' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

    /* ── ③ 配方表(单支用量,单位 g;与服务器 rd_mold_proc_detail 逐行一致)────── */
    DECLARE @recipe TABLE (r nvarchar(4), 序号 int, 物料编号 nvarchar(50), 单支含量g decimal(18,4));
    INSERT INTO @recipe (r, 序号, 物料编号, 单支含量g) VALUES
      -- R0 = D-02-03**TB 自己的真实清单(本身就是 kg,先按 g 记再 /1000 落库,保持同一套换算)
      (N'R0', 1, N'YJ-YPS-001', 286.0000), (N'R0', 2, N'PS-2',       118.0000),
      (N'R0', 3, N'YJ-ZX-003',  304.0000), (N'R0', 4, N'BHP-12',      80.0000),
      -- R1 = A-48-41-tb「PP复合阻垢炭棒」
      (N'R1', 1, N'YJ-XH-001',   75.9500), (N'R1', 2, N'YJ-YPS-002',   9.9400),
      (N'R1', 3, N'PS-2',         9.9400), (N'R1', 4, N'YJ-ZX-003',   67.6000),
      (N'R1', 5, N'YJ-SLD-009',  19.3100), (N'R1', 6, N'HP-12',       16.0000),
      -- R2 = A-48-43-tb「A级烧结炭棒/滤芯」
      (N'R2', 1, N'YJ-XH-002',   79.5000), (N'R2', 2, N'YJ-ZX-003',   30.5800),
      (N'R2', 3, N'YJ-ZX-004',   12.2300),
      -- R3 = A-54-08「阻垢炭棒滤芯」(原配方序号1 有两个候选料,取鑫恒酸洗,另一个是备选)
      (N'R3', 1, N'YJ-XH-002',   79.2200), (N'R3', 2, N'YJ-YPS-002',   4.8000),
      (N'R3', 3, N'YJ-ZX-003',   53.3900), (N'R3', 4, N'YJ-SLD-009',   7.6300),
      (N'R3', 5, N'KG-AJE-A01',  15.0000),
      -- R4 = A-54-11「A+级阻垢炭棒/滤芯」
      (N'R4', 1, N'YJ-XH-002',   14.1100), (N'R4', 2, N'YJ-YPS-002',   5.6500),
      (N'R4', 3, N'AGC-80250',   10.6000), (N'R4', 4, N'PMC-80325',   10.6000),
      (N'R4', 5, N'YJ-ZX-001',   19.7000), (N'R4', 6, N'HP-08',       10.0000),
      -- R5 = A-54-12-tb「A+级烧结炭棒滤芯」
      (N'R5', 1, N'YJ-YKRS-001', 30.3700), (N'R5', 2, N'YJ-YPS-002',   7.5100),
      (N'R5', 3, N'YJ-ZX-003',   21.1900), (N'R5', 4, N'YJ-ZX-001',    7.0600),
      (N'R5', 5, N'Sr-35200',     9.0000);

    /* ── ④ 半成品 → 配方 映射(按半成品名称归品类;源配方产品写进备注便于追溯)── */
    DECLARE @map TABLE (半成品 nvarchar(60), r nvarchar(4), 源配方产品 nvarchar(60));
    INSERT INTO @map (半成品, r, 源配方产品) VALUES
      -- 阻垢类 ⇒ R3
      (N'S031**TB',     N'R3', N'A-54-08 阻垢炭棒滤芯'),
      (N'S042**TB',     N'R3', N'A-54-08 阻垢炭棒滤芯'),
      (N'A-32-27**TB',  N'R3', N'A-54-08 阻垢炭棒滤芯'),
      (N'D-01-49**TB',  N'R3', N'A-54-08 阻垢炭棒滤芯'),
      (N'S051**TB',     N'R3', N'A-54-08 阻垢炭棒滤芯'),
      (N'C-89-04**TB',  N'R3', N'A-54-08 阻垢炭棒滤芯'),
      -- A+/A 级烧结炭棒 ⇒ R5 / R2
      (N'S062**TB',     N'R5', N'A-54-12-tb A+级烧结炭棒滤芯'),
      (N'T211**TB',     N'R5', N'A-54-12-tb A+级烧结炭棒滤芯'),
      (N'T073**TB',     N'R5', N'A-54-12-tb A+级烧结炭棒滤芯'),
      (N'A-48-16**TB',  N'R5', N'A-54-12-tb A+级烧结炭棒滤芯'),   -- A+级微矿化,按 A+ 烧结套
      (N'B-81-02**TB',  N'R5', N'A-54-12-tb A+级烧结炭棒滤芯'),
      (N'A-48-35**TB',  N'R5', N'A-54-12-tb A+级烧结炭棒滤芯'),
      (N'D-01-18**TB',  N'R5', N'A-54-12-tb A+级烧结炭棒滤芯'),
      (N'T042**TB',     N'R5', N'A-54-12-tb A+级烧结炭棒滤芯'),
      (N'T062**TB',     N'R2', N'A-48-43-tb A级烧结炭棒/滤芯'),   -- X级烧结 ⇒ A 级
      -- 功能/抑菌类(含载银粉、抑菌陶瓷粉)⇒ R4
      (N'C-95-13**TB',  N'R4', N'A-54-11 A+级阻垢炭棒/滤芯'),
      (N'C-95-19**TB',  N'R4', N'A-54-11 A+级阻垢炭棒/滤芯'),
      (N'T233**TB',     N'R4', N'A-54-11 A+级阻垢炭棒/滤芯'),
      (N'C-109-05**TB', N'R4', N'A-54-11 A+级阻垢炭棒/滤芯'),
      (N'C-109-06**TB', N'R4', N'A-54-11 A+级阻垢炭棒/滤芯'),
      -- PP 复合 ⇒ R1
      (N'T223**TB',     N'R1', N'A-48-41-tb PP复合阻垢炭棒'),
      (N'A-32-32**TB',  N'R1', N'A-48-41-tb PP复合阻垢炭棒'),
      -- 折叠复合 ⇒ R0(唯一有真实清单的同族)
      (N'B-92-05**TB',  N'R0', N'D-02-03**TB 折叠复合阻垢炭棒/滤芯'),
      (N'S071**TB',     N'R0', N'D-02-03**TB 折叠复合阻垢炭棒/滤芯'),
      (N'S102**TB',     N'R0', N'D-02-03**TB 折叠复合阻垢炭棒/滤芯');

    /* ── ⑤ 半成品的《组装物料清单》(混料领料取数源:工序=组装 / 默认BOM=是 / 状态=启用)── */
    INSERT INTO dbo.bs_asm_bom
        (单据编号, 产品编码, 产品名称, 规格型号, 工序, 版本号, 默认BOM, 工艺路线名称, 来源, 状态,
         行序, 子件编码, 子件名称, 子件规格, 计量单位, 标准用量, 用量分子, 用量分母, 损耗量, 行备注,
         asp_user1, asp_time1, asp_cancel)
    SELECT m.半成品 + N'_V0001',
           m.半成品,
           ISNULL(si.存货名称, m.半成品),
           ISNULL(si.规格型号, N''),
           N'组装', N'V0001', N'是', N'',
           N'测试库演示_混料配方套用_20261118', N'启用',
           ROW_NUMBER() OVER (PARTITION BY m.半成品 ORDER BY rc.序号, rc.物料编号),
           rc.物料编号,
           ISNULL(mi.存货名称, rc.物料编号),
           ISNULL(mi.规格型号, N''),
           ISNULL(NULLIF(mi.计量单位, N''), N'kg'),
           ROUND(rc.单支含量g / CASE WHEN ISNULL(mi.计量单位, N'kg') = N'kg' THEN 1000.0 ELSE 1.0 END, 4),
           rc.单支含量g,
           CASE WHEN ISNULL(mi.计量单位, N'kg') = N'kg' THEN 1000.0 ELSE 1.0 END,
           0,
           N'测试库演示:套用「' + m.源配方产品 + N'」的混料配方(单支 ' + CAST(rc.单支含量g AS nvarchar(20))
               + N' ' + CASE WHEN ISNULL(mi.计量单位, N'kg') = N'kg' THEN N'g→kg' ELSE N'g' END + N')',
           N'admin', SYSDATETIME(), N'N'
      FROM @map m
      JOIN @recipe rc ON rc.r = m.r
      LEFT JOIN dbo.bs_inv si ON si.存货编码 = m.半成品
      LEFT JOIN dbo.bs_inv mi ON mi.存货编码 = rc.物料编号;
    PRINT N'[3/6] 写入半成品混料清单:' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行(25 个半成品)';

    /* ── ⑥ 两个「连组装清单都没有」的产品:整份复制同品类清单,只换第 1 行半成品 ── */
    DECLARE @copy TABLE (产品 nvarchar(40), 半成品 nvarchar(50), 模板单号 nvarchar(60));
    INSERT INTO @copy (产品, 半成品, 模板单号) VALUES
      (N'D-01-18', N'D-01-18**TB', N'A-32-06_V0003'),   -- 34*12*24 ← 同品类小炭棒 63*34*39.5(半成品+端盖×2+珍珠棉+PE袋+纸箱,6 行)
      (N'T042-6',  N'T042**TB',    N'B-35-05-3_V0001'); -- 28*12*180 ← 同品类 28*12*175

    INSERT INTO dbo.bs_asm_bom
        (单据编号, 产品编码, 产品名称, 规格型号, 工序, 版本号, 默认BOM, 工艺路线名称, 来源, 状态,
         行序, 子件编码, 子件名称, 子件规格, 计量单位, 标准用量, 用量分子, 用量分母, 损耗量, 行备注,
         asp_user1, asp_time1, asp_cancel)
    SELECT c.产品 + N'_V0001',
           c.产品,
           ISNULL(pi.存货名称, c.产品),
           ISNULL(pi.规格型号, N''),
           N'组装', N'V0001', N'是', ISNULL(src.工艺路线名称, N''),
           N'测试库演示_组装清单套用_20261118', N'启用',
           src.行序,
           CASE WHEN UPPER(ISNULL(src.子件编码, N'')) LIKE N'%**TB' THEN c.半成品 ELSE src.子件编码 END,
           CASE WHEN UPPER(ISNULL(src.子件编码, N'')) LIKE N'%**TB' THEN ISNULL(si.存货名称, src.子件名称) ELSE src.子件名称 END,
           CASE WHEN UPPER(ISNULL(src.子件编码, N'')) LIKE N'%**TB' THEN ISNULL(si.规格型号, N'')        ELSE src.子件规格 END,
           CASE WHEN UPPER(ISNULL(src.子件编码, N'')) LIKE N'%**TB' THEN ISNULL(NULLIF(si.计量单位, N''), src.计量单位) ELSE src.计量单位 END,
           src.标准用量, src.用量分子, src.用量分母, src.损耗量,
           N'测试库演示:复制同品类清单 ' + c.模板单号 + N',第 1 行半成品替换为 ' + c.半成品,
           N'admin', SYSDATETIME(), N'N'
      FROM @copy c
      JOIN dbo.bs_asm_bom src ON src.单据编号 = c.模板单号 AND ISNULL(src.asp_cancel, 'N') <> 'Y'
      LEFT JOIN dbo.bs_inv pi ON pi.存货编码 = c.产品
      LEFT JOIN dbo.bs_inv si ON si.存货编码 = c.半成品;
    PRINT N'[4/6] 复制同品类组装清单:' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行(2 个产品)';

    /* ── ⑦ 成品的《物料清单》mate(扫码混料取数源;26 个未开单产品)──────────────── */
    DECLARE @prod TABLE (产品 nvarchar(40), 半成品 nvarchar(50));
    INSERT INTO @prod (产品, 半成品) VALUES
      (N'A-48-16',  N'A-48-16**TB'),  (N'C-89-04',  N'C-89-04**TB'),
      (N'T223',     N'T223**TB'),     (N'C-95-13',  N'C-95-13**TB'),
      (N'C-95-19',  N'C-95-19**TB'),  (N'T062-2',   N'T062**TB'),
      (N'B-92-05',  N'B-92-05**TB'),  (N'T233',     N'T233**TB'),
      (N'S031-1',   N'S031**TB'),     (N'S042-2',   N'S042**TB'),
      (N'S042-1',   N'S042**TB'),     (N'C-109-05', N'C-109-05**TB'),
      (N'C-109-06', N'C-109-06**TB'), (N'B-81-02',  N'B-81-02**TB'),
      (N'A-48-35',  N'A-48-35**TB'),  (N'T211-2',   N'T211**TB'),
      (N'T073-1',   N'T073**TB'),     (N'S071-2',   N'S071**TB'),
      (N'A-32-27',  N'A-32-27**TB'),  (N'A-32-32',  N'A-32-32**TB'),
      (N'D-01-49',  N'D-01-49**TB'),  (N'S102-1',   N'S102**TB'),
      (N'S062-2',   N'S062**TB'),     (N'S051-4',   N'S051**TB'),
      (N'D-01-18',  N'D-01-18**TB'),  (N'T042-6',   N'T042**TB');

    INSERT INTO dbo.mate
        (m_no, m_date, wzdm1, wzmc1, jldw1, xc, wzdm2, wzmc2, gg2, jldw2, bzl, sl2, bz,
         asp_user1, asp_time1, asp_cancel)
    SELECT p.产品,
           CAST(SYSDATETIME() AS date),
           p.产品, ISNULL(pi.存货名称, p.产品), ISNULL(pi.计量单位, N'支'),
           ROW_NUMBER() OVER (PARTITION BY p.产品 ORDER BY rc.序号, rc.物料编号),
           rc.物料编号,
           ISNULL(mi.存货名称, rc.物料编号),
           ISNULL(mi.规格型号, N''),
           ISNULL(NULLIF(mi.计量单位, N''), N'kg'),
           ROUND(rc.单支含量g / CASE WHEN ISNULL(mi.计量单位, N'kg') = N'kg' THEN 1000.0 ELSE 1.0 END, 4),
           0,
           N'测试库演示·混料配方套用「' + m.源配方产品 + N'」',
           N'admin', SYSDATETIME(), N'N'
      FROM @prod p
      JOIN @map m ON m.半成品 = p.半成品
      JOIN @recipe rc ON rc.r = m.r
      LEFT JOIN dbo.bs_inv pi ON pi.存货编码 = p.产品
      LEFT JOIN dbo.bs_inv mi ON mi.存货编码 = rc.物料编号;
    PRINT N'[5/6] 写入成品物料清单(mate):' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行(26 个产品)';

    /* ── ⑧ 自检(任一项不符就 THROW 回滚)────────────────────────────────── */
    DECLARE @docCnt int, @semiCnt int, @mateProd int, @mateRows int;
    SELECT @docCnt  = COUNT(DISTINCT 单据编号), @semiCnt = COUNT(DISTINCT 产品编码)
      FROM dbo.bs_asm_bom WHERE 来源 = N'测试库演示_混料配方套用_20261118';
    SELECT @mateProd = COUNT(DISTINCT m_no), @mateRows = COUNT(*)
      FROM dbo.mate WHERE bz LIKE N'测试库演示·混料配方套用%';

    IF @docCnt <> 25 OR @semiCnt <> 25 THROW 51001, N'自检失败:半成品清单不是 25 张/25 个半成品。', 1;
    IF @mateProd <> 26 THROW 51002, N'自检失败:mate 覆盖产品数不是 26。', 1;
    IF @mateRows < 100 THROW 51003, N'自检失败:mate 行数偏少(<100),配方没展开全。', 1;

    -- 每个半成品都必须能被 WorkOrderBomService.standardOf 取到(工序=组装/默认BOM=是/状态=启用/未作废)
    IF EXISTS (
        SELECT m.半成品 FROM @map m
         WHERE NOT EXISTS (
            SELECT 1 FROM dbo.bs_asm_bom b
             WHERE b.产品编码 = m.半成品 AND b.工序 = N'组装'
               AND ISNULL(b.asp_cancel,'N') <> 'Y' AND ISNULL(b.状态,N'启用') <> N'停用'
               AND ISNULL(b.子件编码,N'') <> N'')
    ) THROW 51004, N'自检失败:仍有半成品取不到清单。', 1;

    PRINT N'[6/6] 自检通过:半成品清单 ' + CAST(@docCnt AS nvarchar(10)) + N' 张 / 物料清单 '
        + CAST(@mateRows AS nvarchar(10)) + N' 行 / ' + CAST(@mateProd AS nvarchar(10)) + N' 个产品';

    COMMIT TRANSACTION;
    PRINT N'RESULT: OK — 测试库物料清单已补齐(演示数据,勿推正式库)';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT N'RESULT: FAIL — ' + ERROR_MESSAGE();
    THROW;
END CATCH
