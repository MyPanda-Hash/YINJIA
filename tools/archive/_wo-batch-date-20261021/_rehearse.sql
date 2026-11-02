/* ============================================================
   migrate-plang-batch-date-closed-20261021.sql — 2026-10-21
   「已结案工单」批次号 = 单据日期 + 3 天；转单时间 = 单据日期；
   链路单据的批次号同步改成同一新批次号。

   用户口径(2026-10-21，口头原文整理):
     「修改当前已完成的工单，针对当前的工单修改批次号对应当前的单据日期，往后推 3 天作为
      批次号；转单时间和单据日期对应；在当前工单链路的其他单据也进行这个修改。」
     追加：「只修改当前已结案的数据，未结案的不处理。」

   事实(正式库 HSDZ_MES，2026-10-21 只读取证):
     · 状态=生产完工 的工单行 384 行，全部 ja='Y' 且 入库≥排产 ⇒ 按 PlangClose.closed 口径
       **全部是已结案**；
     · 这 384 行的 [批次号] 全是 '20261014'，转单时间(asp_time1)全是 2026-10-14(导入时间)；
     · 每一行的 [完工时间] 恰好 = 单据日期(pl_date) + 3 天，且链路单据日期严格对齐：
       报工 成型=+1/切炭=+2/组装=+3，首件检验=+1，制程检验=+1，组装检验=+3，产成品入库=+3；
     · 另有 45 行工单行批次号也是 '20261014'，但**未完工/未结案** ⇒ 按用户口径一律不动。

   本脚本做什么(只动「已结案 + 批次号=20261014 + 日期尚未对齐」的行):
     ① plang.[批次号] = CONVERT(varchar(8), DATEADD(day,3,CAST(pl_date AS date)), 112)
        (即完工日期，如 单据日期 2026-09-14 ⇒ 批次号 20260917)
     ② plang.asp_time1 = pl_date(转单时间与单据日期同日；原值为导入时间，无业务意义)
     ③ 链路同批号列全部同步成 ① 的新批次号：
        plang_pc.[批次号]、scjl.[批次号]、wo_progress.[批次号]、
        qc_first_insp_head.[批次号]、qc_proc_insp_head.[批次号]、qc_asm_insp_head.[批次号]、
        bd_finish_in.[批次号]、bl_finish_in.[批号]
     ④ 顺带同步两个「导入时被写成批次号」的同名列(仅在值恰等于旧批次号时):
        scjl.lot_no、plang_pc.lot_no —— 报工单面板 WO_REPORT 有两个都叫「批次号」的字段
        (seq 35 绑 [批次号]、seq 56 绑 lot_no)，不同步会出现同一行两个批号。
        ⚠ plang.lot_no(产品批号)保持不动：它是另一套号，且这批数据本来就是空。

   **不动**：
     · 45 行未结案工单(批次号仍是 20261014)与其链路单据；
     · 链路单据自身的单据日期(报工/检验/入库日期已与 pl_date+1/+2/+3 严格对齐，无需重排)；
     · 库存(inventory)：这 384 张产成品入库单**没有**写 inh/outh/kucun(实测按 批号=20261014
       仅命中 1 行今天的 FI-2026-10-0003，与本批无关)，故不碰库存三表。

   幂等：目标行带「批次号=20261014 且(批次号≠新批次 或 转单日期≠单据日期)」窄条件，
         执行后不再命中；重跑 = 0 行。两账套都执行(测试库无此批数据 ⇒ 0 行，仅登记)。
   回滚：见文件末尾 §回滚(批次号回 20261014、转单时间回 2026-10-14 原时刻组)。
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
/* ---------- ① 目标行(先建临时表，后面各批次都复用；#temp 同连接跨 GO 存活) ---------- */
IF OBJECT_ID('tempdb..#target') IS NOT NULL DROP TABLE #target;
CREATE TABLE #target (
    id        int          NOT NULL PRIMARY KEY,
    pl_no     nvarchar(56) NOT NULL,
    pl_xc     int          NULL,
    old_batch nvarchar(12) NOT NULL,
    new_batch varchar(8)   NOT NULL,
    pl_date   datetime     NOT NULL
);
IF OBJECT_ID(N'dbo.plang', N'U') IS NOT NULL
INSERT #target (id, pl_no, pl_xc, old_batch, new_batch, pl_date)
SELECT p.id, p.pl_no, ISNULL(p.pl_xc,0),
       ISNULL(p.[批次号],N''),
       CONVERT(varchar(8), DATEADD(day,3,CAST(p.pl_date AS date)), 112),
       p.pl_date
FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
  AND ISNULL(p.[完工状态],N'') = N'生产完工'
  -- 「已结案」= PlangClose.closed(p) 的 SQL 同源写法(ja∈T,Y 且 (入库≥排产>0 或 参考库号段))
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0))
       OR p.pl_no LIKE N'GD2608%')
  AND p.pl_date IS NOT NULL
  AND ISNULL(p.[批次号],N'') = N'20261014'          -- 本批导入的旧批次号
  AND (ISNULL(p.[批次号],N'') <> CONVERT(varchar(8), DATEADD(day,3,CAST(p.pl_date AS date)), 112)
       OR CAST(ISNULL(p.asp_time1,'19000101') AS date) <> CAST(p.pl_date AS date));
DECLARE @n_target int = (SELECT COUNT(*) FROM #target);
PRINT N'[目标] 已结案且待修正的工单行 = ' + CAST(@n_target AS nvarchar(10))
    + N' 行(0 = 已执行过或本账套无此批数据)';
GO
/* ---------- ② 改工单行 + 链路同批号列(单事务，任一校验失败整批回滚) ---------- */
DECLARE @u_plang int, @u_pc int, @u_scjl int, @u_prog int,
        @u_qcf int, @u_qcp int, @u_qca int, @u_fin int, @u_blfin int;
DECLARE @pre int, @post int, @bad int;

-- 未结案(不在目标集里)的旧批次号行数：改完必须一个不少(证明没误伤)
DECLARE @keep_plang int, @keep_pc int, @keep_scjl int, @keep_prog int,
        @keep_qcf int, @keep_qcp int, @keep_qca int, @keep_fin int, @keep_blfin int;
SELECT @keep_plang = COUNT(*) FROM dbo.plang WHERE ISNULL([批次号],N'')=N'20261014' AND id NOT IN (SELECT id FROM #target);
SELECT @keep_pc    = COUNT(*) FROM dbo.plang_pc WHERE ISNULL([批次号],N'')=N'20261014' AND ISNULL(plang_id,0) NOT IN (SELECT id FROM #target);
SELECT @keep_scjl  = COUNT(*) FROM dbo.scjl s WHERE ISNULL(s.[批次号],N'')=N'20261014'
                       AND NOT EXISTS (SELECT 1 FROM dbo.plang_pc pc JOIN #target t ON t.id=pc.plang_id WHERE pc.id=s.gd_id)
                       AND NOT EXISTS (SELECT 1 FROM #target t WHERE t.pl_no=s.gldh AND t.pl_xc=ISNULL(s.[工单行号],0));
SELECT @keep_prog  = COUNT(*) FROM dbo.wo_progress w WHERE ISNULL([批次号],N'')=N'20261014' AND ISNULL([工单行id],0) NOT IN (SELECT id FROM #target);
SELECT @keep_qcf   = COUNT(*) FROM dbo.qc_first_insp_head h WHERE ISNULL([批次号],N'')=N'20261014'
                       AND NOT EXISTS (SELECT 1 FROM #target t WHERE t.pl_no=h.[工单号] AND t.pl_xc=ISNULL(h.[工单行号],0));
SELECT @keep_qcp   = COUNT(*) FROM dbo.qc_proc_insp_head h WHERE ISNULL([批次号],N'')=N'20261014'
                       AND NOT EXISTS (SELECT 1 FROM #target t WHERE t.pl_no=h.[工单号] AND t.pl_xc=ISNULL(h.[工单行号],0));
SELECT @keep_qca   = COUNT(*) FROM dbo.qc_asm_insp_head h WHERE ISNULL([批次号],N'')=N'20261014'
                       AND NOT EXISTS (SELECT 1 FROM #target t WHERE t.pl_no=h.[工单号] AND t.pl_xc=ISNULL(h.[工单行号],0));
SELECT @keep_fin   = COUNT(*) FROM dbo.bd_finish_in f WHERE ISNULL([批次号],N'')=N'20261014'
                       AND NOT EXISTS (SELECT 1 FROM #target t WHERE t.pl_no=f.[加工单号] AND t.pl_xc=ISNULL(f.[工单行号],0));
SELECT @keep_blfin = COUNT(*) FROM dbo.bl_finish_in l WHERE ISNULL([批号],N'')=N'20261014'
                       AND NOT EXISTS (SELECT 1 FROM dbo.bd_finish_in f JOIN #target t
                                        ON t.pl_no=f.[加工单号] AND t.pl_xc=ISNULL(f.[工单行号],0)
                                      WHERE f.[单据编号]=l.[单据编号]);

BEGIN TRANSACTION;

-- ① 工单行：批次号 = 单据日期+3 天；转单时间 = 单据日期
UPDATE p
   SET p.[批次号]  = t.new_batch,
       p.asp_time1 = t.pl_date,
       p.asp_user2 = N'migration', p.asp_time2 = GETDATE()
  FROM dbo.plang p JOIN #target t ON t.id = p.id;
SET @u_plang = @@ROWCOUNT;

-- ② 排产行(权威键 plang_id；同批 lot_no 镜像列同步)
UPDATE pc
   SET pc.[批次号] = t.new_batch,
       pc.lot_no   = CASE WHEN ISNULL(pc.lot_no,N'') = t.old_batch THEN t.new_batch ELSE pc.lot_no END,
       pc.asp_user2 = N'migration', pc.asp_time2 = GETDATE()
  FROM dbo.plang_pc pc JOIN #target t ON t.id = pc.plang_id;
SET @u_pc = @@ROWCOUNT;

-- ③ 报工行(权威键 gd_id→plang_pc.plang_id；草稿期 gd_id=0 再按 工单号+工单行号 补一轮)
UPDATE s
   SET s.[批次号] = t.new_batch,
       s.lot_no   = CASE WHEN ISNULL(s.lot_no,N'') = t.old_batch THEN t.new_batch ELSE s.lot_no END,
       s.asp_user2 = N'migration', s.asp_time2 = GETDATE()
  FROM dbo.scjl s
  JOIN dbo.plang_pc pc ON pc.id = s.gd_id
  JOIN #target t ON t.id = pc.plang_id;
SET @u_scjl = @@ROWCOUNT;
UPDATE s
   SET s.[批次号] = t.new_batch,
       s.lot_no   = CASE WHEN ISNULL(s.lot_no,N'') = t.old_batch THEN t.new_batch ELSE s.lot_no END,
       s.asp_user2 = N'migration', s.asp_time2 = GETDATE()
  FROM dbo.scjl s JOIN #target t ON t.pl_no = s.gldh AND t.pl_xc = ISNULL(s.[工单行号],0)
 WHERE ISNULL(s.gd_id,0) = 0;
SET @u_scjl = @u_scjl + @@ROWCOUNT;

-- ④ 工序进度(行键 工单行id = plang.id)
UPDATE w
   SET w.[批次号] = t.new_batch,
       w.asp_user2 = N'migration', w.asp_time2 = GETDATE()
  FROM dbo.wo_progress w JOIN #target t ON t.id = w.[工单行id];
SET @u_prog = @@ROWCOUNT;

-- ⑤ 三张工序检验单(行键 工单号+工单行号；本批 384 行全部有行号)
UPDATE h SET h.[批次号]=t.new_batch, h.asp_user2=N'migration', h.asp_time2=GETDATE()
  FROM dbo.qc_first_insp_head h JOIN #target t ON t.pl_no=h.[工单号] AND t.pl_xc=ISNULL(h.[工单行号],0);
SET @u_qcf = @@ROWCOUNT;
UPDATE h SET h.[批次号]=t.new_batch, h.asp_user2=N'migration', h.asp_time2=GETDATE()
  FROM dbo.qc_proc_insp_head h JOIN #target t ON t.pl_no=h.[工单号] AND t.pl_xc=ISNULL(h.[工单行号],0);
SET @u_qcp = @@ROWCOUNT;
UPDATE h SET h.[批次号]=t.new_batch, h.asp_user2=N'migration', h.asp_time2=GETDATE()
  FROM dbo.qc_asm_insp_head h JOIN #target t ON t.pl_no=h.[工单号] AND t.pl_xc=ISNULL(h.[工单行号],0);
SET @u_qca = @@ROWCOUNT;

-- ⑥ 产成品入库单头(行键 加工单号+工单行号)
UPDATE f SET f.[批次号]=t.new_batch, f.asp_user2=N'migration', f.asp_time2=GETDATE()
  FROM dbo.bd_finish_in f JOIN #target t ON t.pl_no=f.[加工单号] AND t.pl_xc=ISNULL(f.[工单行号],0);
SET @u_fin = @@ROWCOUNT;

-- ⑦ 入库单行(经单头；批号只在等于旧批次号时替换)
UPDATE l SET l.[批号]=f.[批次号], l.asp_user2=N'migration', l.asp_time2=GETDATE()
  FROM dbo.bl_finish_in l
  JOIN dbo.bd_finish_in f ON f.[单据编号]=l.[单据编号]
  JOIN #target t ON t.pl_no=f.[加工单号] AND t.pl_xc=ISNULL(f.[工单行号],0)
 WHERE ISNULL(l.[批号],N'') = t.old_batch;
SET @u_blfin = @@ROWCOUNT;

-- ===== 提交前校验(任一不满足即 THROW ⇒ XACT_ABORT 整批回滚) =====
-- 校验 A：目标工单行的批次号/转单日期都已到位
SELECT @bad = COUNT(*) FROM dbo.plang p JOIN #target t ON t.id=p.id
 WHERE p.[批次号] <> t.new_batch OR CAST(p.asp_time1 AS date) <> CAST(t.pl_date AS date);
IF @bad > 0 BEGIN THROW 50011, N'校验A失败：目标工单行仍有批次号/转单日期未到位', 1; END

-- 校验 B：链路各表的批号都已等于新批次号
SELECT @bad = 0;
SELECT @bad = @bad + COUNT(*) FROM dbo.plang_pc pc JOIN #target t ON t.id=pc.plang_id WHERE ISNULL(pc.[批次号],N'') <> t.new_batch;
SELECT @bad = @bad + COUNT(*) FROM dbo.scjl s
  JOIN dbo.plang_pc pc ON pc.id=s.gd_id JOIN #target t ON t.id=pc.plang_id
 WHERE ISNULL(s.[批次号],N'') <> t.new_batch;
SELECT @bad = @bad + COUNT(*) FROM dbo.wo_progress w JOIN #target t ON t.id=w.[工单行id]
 WHERE ISNULL(w.[批次号],N'') <> t.new_batch;
SELECT @bad = @bad + COUNT(*) FROM dbo.qc_first_insp_head h JOIN #target t ON t.pl_no=h.[工单号] AND t.pl_xc=ISNULL(h.[工单行号],0)
 WHERE ISNULL(h.[批次号],N'') <> t.new_batch;
SELECT @bad = @bad + COUNT(*) FROM dbo.qc_proc_insp_head h JOIN #target t ON t.pl_no=h.[工单号] AND t.pl_xc=ISNULL(h.[工单行号],0)
 WHERE ISNULL(h.[批次号],N'') <> t.new_batch;
SELECT @bad = @bad + COUNT(*) FROM dbo.qc_asm_insp_head h JOIN #target t ON t.pl_no=h.[工单号] AND t.pl_xc=ISNULL(h.[工单行号],0)
 WHERE ISNULL(h.[批次号],N'') <> t.new_batch;
SELECT @bad = @bad + COUNT(*) FROM dbo.bd_finish_in f JOIN #target t ON t.pl_no=f.[加工单号] AND t.pl_xc=ISNULL(f.[工单行号],0)
 WHERE ISNULL(f.[批次号],N'') <> t.new_batch;
SELECT @bad = @bad + COUNT(*) FROM dbo.bl_finish_in l
  JOIN dbo.bd_finish_in f ON f.[单据编号]=l.[单据编号]
  JOIN #target t ON t.pl_no=f.[加工单号] AND t.pl_xc=ISNULL(f.[工单行号],0)
 WHERE ISNULL(l.[批号],N'') <> t.new_batch;
IF @bad > 0 BEGIN THROW 50012, N'校验B失败：链路单据仍有批号未同步', 1; END

-- 校验 C：未结案行一个不少(旧批次号行数保持原样)——证明没误伤未结案数据
SELECT @pre = @keep_plang + @keep_pc + @keep_scjl + @keep_prog + @keep_qcf + @keep_qcp + @keep_qca + @keep_fin + @keep_blfin;
SELECT @post = 0;
SELECT @post = @post + COUNT(*) FROM dbo.plang WHERE ISNULL([批次号],N'')=N'20261014' AND id NOT IN (SELECT id FROM #target);
SELECT @post = @post + COUNT(*) FROM dbo.plang_pc WHERE ISNULL([批次号],N'')=N'20261014' AND ISNULL(plang_id,0) NOT IN (SELECT id FROM #target);
SELECT @post = @post + COUNT(*) FROM dbo.scjl s WHERE ISNULL(s.[批次号],N'')=N'20261014'
   AND NOT EXISTS (SELECT 1 FROM dbo.plang_pc pc JOIN #target t ON t.id=pc.plang_id WHERE pc.id=s.gd_id)
   AND NOT EXISTS (SELECT 1 FROM #target t WHERE t.pl_no=s.gldh AND t.pl_xc=ISNULL(s.[工单行号],0));
SELECT @post = @post + COUNT(*) FROM dbo.wo_progress w WHERE ISNULL([批次号],N'')=N'20261014' AND ISNULL([工单行id],0) NOT IN (SELECT id FROM #target);
SELECT @post = @post + COUNT(*) FROM dbo.qc_first_insp_head h WHERE ISNULL([批次号],N'')=N'20261014'
   AND NOT EXISTS (SELECT 1 FROM #target t WHERE t.pl_no=h.[工单号] AND t.pl_xc=ISNULL(h.[工单行号],0));
SELECT @post = @post + COUNT(*) FROM dbo.qc_proc_insp_head h WHERE ISNULL([批次号],N'')=N'20261014'
   AND NOT EXISTS (SELECT 1 FROM #target t WHERE t.pl_no=h.[工单号] AND t.pl_xc=ISNULL(h.[工单行号],0));
SELECT @post = @post + COUNT(*) FROM dbo.qc_asm_insp_head h WHERE ISNULL([批次号],N'')=N'20261014'
   AND NOT EXISTS (SELECT 1 FROM #target t WHERE t.pl_no=h.[工单号] AND t.pl_xc=ISNULL(h.[工单行号],0));
SELECT @post = @post + COUNT(*) FROM dbo.bd_finish_in f WHERE ISNULL([批次号],N'')=N'20261014'
   AND NOT EXISTS (SELECT 1 FROM #target t WHERE t.pl_no=f.[加工单号] AND t.pl_xc=ISNULL(f.[工单行号],0));
SELECT @post = @post + COUNT(*) FROM dbo.bl_finish_in l WHERE ISNULL([批号],N'')=N'20261014'
   AND NOT EXISTS (SELECT 1 FROM dbo.bd_finish_in f JOIN #target t
                    ON t.pl_no=f.[加工单号] AND t.pl_xc=ISNULL(f.[工单行号],0)
                  WHERE f.[单据编号]=l.[单据编号]);
IF @post <> @pre BEGIN THROW 50013, N'校验C失败：未结案行的旧批次号数量发生变化（疑似误伤）', 1; END

ROLLBACK TRANSACTION;  -- 演练：不落库
PRINT N'[演练已回滚] plang=' + CAST(@u_plang AS nvarchar(10))
    + N' / plang_pc=' + CAST(@u_pc AS nvarchar(10))
    + N' / scjl=' + CAST(@u_scjl AS nvarchar(10))
    + N' / wo_progress=' + CAST(@u_prog AS nvarchar(10))
    + N' / 首检=' + CAST(@u_qcf AS nvarchar(10))
    + N' / 制检=' + CAST(@u_qcp AS nvarchar(10))
    + N' / 组检=' + CAST(@u_qca AS nvarchar(10))
    + N' / 入库头=' + CAST(@u_fin AS nvarchar(10))
    + N' / 入库行=' + CAST(@u_blfin AS nvarchar(10))
    + N'；未结案保持原样(' + CAST(@pre AS nvarchar(10)) + N' 行)';
GO

