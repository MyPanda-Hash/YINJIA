/* ============================================================
   migrate-plang-no-month-closed-20261021.sql — 2026-10-21
   「9 月单据的已结案工单」工单号月份段 10 → 09(GD-2026-10-xxxx → GD-2026-09-xxxx)

   用户口径(2026-10-21):
     「工单号也需要根据日期来，当前工单号全都是 10 月的工单号，9 月的工单号 GD-2026-09-xxxx，
      就是将中间的 10 修改为 09 即可，单据日期为 9 月的已结案工单才需要修改。」

   范围(正式库 HSDZ_MES，2026-10-21 只读取证):
     · 已结案 = PlangClose.closed(ja∈T,Y 且 入库≥排产>0，或 GD2608* 参考库号段)；
     · 且 单据日期(pl_date) ∈ 2026-09-01 .. 2026-09-30；
     · 且 工单号形如 GD-2026-10-xxxx(实测 298 行 / 155 个工单号，全部符合)；
     · **10 月单据的 86 行、以及未结案行一律不动**；改的是「工单号」这个整体——
       同一工单号下的其它行随之一起改(见下方 ⚠)。
      新号 = N'GD-2026-09-' + RIGHT(旧号,4)，只换月份段，流水号原样保留。

   ⚠ 实测有一处「一号两单」：GD-2026-10-0011 同时挂着
     ① 行1(id=28，订单 ZL-20260916-04，单据日期 2026-09-16，已结案) —— 本次应改；
     ② 行2(id=1132，订单 ZL-20261012-04，单据日期 2026-10-18，**已作废**、ja=N) —— 本不在范围，
        但行号共用同一工单号，按「改工单号」整体口径随号迁到 09(其报工/检验/领料/占用链/日志一并改)。
     若业务要求把这张作废的 10 月行单独留在 10 号段，需另行拆分(见汇报里的说明)。

   同批更新(凡是存有工单号的列，全部按 old→new 映射改；行数取自全库字符列扫描):
     plang.pl_no(299 行) / plang.源工单号·根工单号(0)
     plang_pc.pl_no(299)
     scjl.gldh(899)、scjl.tm(898)
     wo_progress.单据编号(894)
     qc_first_insp_head.工单号(299)、qc_proc_insp_head.工单号(299)、qc_asm_insp_head.工单号(299)
     bd_finish_in.加工单号(298)
     bd_material_out.加工单号(301)、bd_material_out.来源单号(301)
     bl_material_out.加工单号(894)
     wo_process_line.工单号(3)、wo_transfer_log.pl_no(2)
     s_allno.dh + ny(155 行；ny 2026-10 → 2026-09，保持号池与号段一致)
     form_flow_link.source_form_no(3)/target_form_no(299) + source_line_key/target_line_key 前缀(3/299)
     yj_usage_log.doc_no(5 行；排产/取消结案留痕跟着改号)

   **不动的**：
     · scjl.sc_no 有 3 行恰好等于工单号(已作废草稿报工单，2026-10-19 产生)；那是**报工单号**，
       不是工单号，按口径不改(改它会连带 yj_doc_status 等报工单身份)。
     · form_flow_link 行键尾部的批次段(如 `#1#20261014`)是历史键，代码无解析消费者；本次只换前缀。
     · 库存 inh/outh、生产异常、混料、切单日志等实测 0 行引用，不在本脚本内。

   幂等：目标行带 `pl_no LIKE 'GD-2026-10-%'` 且按 old→new 映射，改完不再命中；重跑 0 行。
   两账套都执行(测试库无此批数据 ⇒ 0 行，仅登记)。
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
/* ---------- ① 映射表(后面各批次复用；#temp 同连接跨 GO 存活) ---------- */
IF OBJECT_ID('tempdb..#map') IS NOT NULL DROP TABLE #map;
CREATE TABLE #map (
    old_no nvarchar(56) NOT NULL PRIMARY KEY,
    new_no nvarchar(56) NOT NULL,
    ny_new nvarchar(7)  NOT NULL
);
IF OBJECT_ID(N'dbo.plang', N'U') IS NOT NULL
INSERT #map (old_no, new_no, ny_new)
SELECT DISTINCT p.pl_no,
       N'GD-2026-09-' + RIGHT(p.pl_no, 4),
       N'2026-09'
FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
  AND ISNULL(p.[完工状态],N'') = N'生产完工'
  -- 「已结案」= PlangClose.closed(p) 的 SQL 同源写法
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0))
       OR p.pl_no LIKE N'GD2608%')
  AND CAST(p.pl_date AS date) >= '2026-09-01'
  AND CAST(p.pl_date AS date) <  '2026-10-01'
  AND p.pl_no LIKE N'GD-2026-10-%';
DECLARE @n_map int = (SELECT COUNT(*) FROM #map);
PRINT N'[目标] 9 月已结案工单号 = ' + CAST(@n_map AS nvarchar(10)) + N' 个(0 = 已执行过或本账套无此批数据)';
GO
/* ---------- ② 改号(单事务；任一校验失败整批回滚) ---------- */
DECLARE @u_plang int, @u_pc int, @u_scjl int, @u_scjl_tm int, @u_prog int,
        @u_qcf int, @u_qcp int, @u_qca int, @u_fin int, @u_mo int, @u_blmo int,
        @u_wpl int, @u_wtl int, @u_no int, @u_ff int, @u_ffl int, @u_log int;
DECLARE @bad int, @pre_oct int, @post_oct int;

-- 改前快照：10 月单据(非目标)的工单行数，改完必须不变
SELECT @pre_oct = COUNT(*) FROM dbo.plang
 WHERE CAST(pl_date AS date) >= '2026-10-01'
   AND ISNULL([完工状态],N'') = N'生产完工' AND ISNULL(asp_cancel,'N') <> 'Y';

BEGIN TRANSACTION;

-- 校验 0：新号提前查重(plang 任意行 / 号池)，撞号直接回滚
IF EXISTS (SELECT 1 FROM dbo.plang p JOIN #map m ON p.pl_no = m.new_no)
   BEGIN THROW 50101, N'目标新工单号在 plang 已存在，禁止覆盖', 1; END;
IF EXISTS (SELECT 1 FROM dbo.s_allno a JOIN #map m ON a.dh = m.new_no)
   BEGIN THROW 50102, N'目标新工单号在号池 s_allno 已存在，禁止覆盖', 1; END;

-- ① 工单行
UPDATE p SET p.pl_no = m.new_no, p.asp_user2 = N'migration', p.asp_time2 = GETDATE()
  FROM dbo.plang p JOIN #map m ON p.pl_no = m.old_no;
SET @u_plang = @@ROWCOUNT;
UPDATE p SET p.[源工单号] = m.new_no FROM dbo.plang p JOIN #map m ON p.[源工单号] = m.old_no;
UPDATE p SET p.[根工单号] = m.new_no FROM dbo.plang p JOIN #map m ON p.[根工单号] = m.old_no;

-- ② 排产行
UPDATE pc SET pc.pl_no = m.new_no, pc.asp_user2 = N'migration', pc.asp_time2 = GETDATE()
  FROM dbo.plang_pc pc JOIN #map m ON pc.pl_no = m.old_no;
SET @u_pc = @@ROWCOUNT;

-- ③ 报工行(工单号列 gldh + 条码位 tm)
UPDATE s SET s.gldh = m.new_no, s.asp_user2 = N'migration', s.asp_time2 = GETDATE()
  FROM dbo.scjl s JOIN #map m ON s.gldh = m.old_no;
SET @u_scjl = @@ROWCOUNT;
UPDATE s SET s.tm = m.new_no, s.asp_user2 = N'migration', s.asp_time2 = GETDATE()
  FROM dbo.scjl s JOIN #map m ON s.tm = m.old_no;
SET @u_scjl_tm = @@ROWCOUNT;

-- ④ 工序进度(单据编号 = 工单号)
UPDATE w SET w.[单据编号] = m.new_no, w.asp_user2 = N'migration', w.asp_time2 = GETDATE()
  FROM dbo.wo_progress w JOIN #map m ON w.[单据编号] = m.old_no;
SET @u_prog = @@ROWCOUNT;

-- ⑤ 三张工序检验单
UPDATE h SET h.[工单号] = m.new_no, h.asp_user2 = N'migration', h.asp_time2 = GETDATE()
  FROM dbo.qc_first_insp_head h JOIN #map m ON h.[工单号] = m.old_no;
SET @u_qcf = @@ROWCOUNT;
UPDATE h SET h.[工单号] = m.new_no, h.asp_user2 = N'migration', h.asp_time2 = GETDATE()
  FROM dbo.qc_proc_insp_head h JOIN #map m ON h.[工单号] = m.old_no;
SET @u_qcp = @@ROWCOUNT;
UPDATE h SET h.[工单号] = m.new_no, h.asp_user2 = N'migration', h.asp_time2 = GETDATE()
  FROM dbo.qc_asm_insp_head h JOIN #map m ON h.[工单号] = m.old_no;
SET @u_qca = @@ROWCOUNT;

-- ⑥ 产成品入库单头
UPDATE f SET f.[加工单号] = m.new_no, f.asp_user2 = N'migration', f.asp_time2 = GETDATE()
  FROM dbo.bd_finish_in f JOIN #map m ON f.[加工单号] = m.old_no;
SET @u_fin = @@ROWCOUNT;

-- ⑦ 材料出库(领料)单头 + 行
UPDATE d SET d.[加工单号] = m.new_no,
             d.[来源单号] = CASE WHEN d.[来源单号] = m.old_no THEN m.new_no ELSE d.[来源单号] END,
             d.asp_user2 = N'migration', d.asp_time2 = GETDATE()
  FROM dbo.bd_material_out d JOIN #map m ON d.[加工单号] = m.old_no;
SET @u_mo = @@ROWCOUNT;
UPDATE d SET d.[来源单号] = m.new_no, d.asp_user2 = N'migration', d.asp_time2 = GETDATE()
  FROM dbo.bd_material_out d JOIN #map m ON d.[来源单号] = m.old_no;
SET @u_mo = @u_mo + @@ROWCOUNT;
UPDATE l SET l.[加工单号] = m.new_no, l.asp_user2 = N'migration', l.asp_time2 = GETDATE()
  FROM dbo.bl_material_out l JOIN #map m ON l.[加工单号] = m.old_no;
SET @u_blmo = @@ROWCOUNT;

-- ⑧ 工序预排 / 调拨轨迹
UPDATE l SET l.[工单号] = m.new_no, l.asp_user2 = N'migration', l.asp_time2 = GETDATE()
  FROM dbo.wo_process_line l JOIN #map m ON l.[工单号] = m.old_no;
SET @u_wpl = @@ROWCOUNT;
UPDATE t SET t.pl_no = m.new_no, t.asp_user2 = N'migration', t.asp_time2 = GETDATE()
  FROM dbo.wo_transfer_log t JOIN #map m ON t.pl_no = m.old_no;
SET @u_wtl = @@ROWCOUNT;

-- ⑨ 号池(号与月份段必须一起改)
UPDATE a SET a.dh = m.new_no, a.ny = m.ny_new, a.asp_user2 = N'migration', a.asp_time2 = GETDATE()
  FROM dbo.s_allno a JOIN #map m ON a.dh = m.old_no;
SET @u_no = @@ROWCOUNT;

-- ⑩ 生单占用链(单号 + 行键前缀)
UPDATE f SET f.source_form_no = m.new_no
  FROM dbo.form_flow_link f JOIN #map m ON f.source_form_no = m.old_no;
SET @u_ff = @@ROWCOUNT;
UPDATE f SET f.source_line_key = m.new_no + SUBSTRING(f.source_line_key, LEN(m.old_no) + 1, 4000)
  FROM dbo.form_flow_link f JOIN #map m ON f.source_line_key LIKE m.old_no + N'#%';
SET @u_ffl = @@ROWCOUNT;
UPDATE f SET f.target_form_no = m.new_no
  FROM dbo.form_flow_link f JOIN #map m ON f.target_form_no = m.old_no;
SET @u_ff = @u_ff + @@ROWCOUNT;
UPDATE f SET f.target_line_key = m.new_no + SUBSTRING(f.target_line_key, LEN(m.old_no) + 1, 4000)
  FROM dbo.form_flow_link f JOIN #map m ON f.target_line_key LIKE m.old_no + N'#%';
SET @u_ffl = @u_ffl + @@ROWCOUNT;

-- ⑪ 使用日志留痕里的单号(排产/取消结案等)
UPDATE u SET u.doc_no = m.new_no
  FROM dbo.yj_usage_log u JOIN #map m ON u.doc_no = m.old_no;
SET @u_log = @@ROWCOUNT;

-- ===== 提交前校验(任一不满足即 THROW ⇒ XACT_ABORT 整批回滚) =====
-- A：旧号已清零(主引用表)
SELECT @bad = 0;
SELECT @bad = @bad + COUNT(*) FROM dbo.plang p JOIN #map m ON p.pl_no = m.old_no;
SELECT @bad = @bad + COUNT(*) FROM dbo.plang_pc pc JOIN #map m ON pc.pl_no = m.old_no;
SELECT @bad = @bad + COUNT(*) FROM dbo.scjl s JOIN #map m ON s.gldh = m.old_no OR s.tm = m.old_no;
SELECT @bad = @bad + COUNT(*) FROM dbo.wo_progress w JOIN #map m ON w.[单据编号] = m.old_no;
SELECT @bad = @bad + COUNT(*) FROM dbo.qc_first_insp_head h JOIN #map m ON h.[工单号] = m.old_no;
SELECT @bad = @bad + COUNT(*) FROM dbo.qc_proc_insp_head h JOIN #map m ON h.[工单号] = m.old_no;
SELECT @bad = @bad + COUNT(*) FROM dbo.qc_asm_insp_head h JOIN #map m ON h.[工单号] = m.old_no;
SELECT @bad = @bad + COUNT(*) FROM dbo.bd_finish_in f JOIN #map m ON f.[加工单号] = m.old_no;
SELECT @bad = @bad + COUNT(*) FROM dbo.bd_material_out d JOIN #map m ON d.[加工单号] = m.old_no OR d.[来源单号] = m.old_no;
SELECT @bad = @bad + COUNT(*) FROM dbo.bl_material_out l JOIN #map m ON l.[加工单号] = m.old_no;
SELECT @bad = @bad + COUNT(*) FROM dbo.s_allno a JOIN #map m ON a.dh = m.old_no;
SELECT @bad = @bad + COUNT(*) FROM dbo.form_flow_link f JOIN #map m
   ON f.source_form_no = m.old_no OR f.target_form_no = m.old_no
   OR f.source_line_key LIKE m.old_no + N'#%' OR f.target_line_key LIKE m.old_no + N'#%';
IF @bad > 0 BEGIN THROW 50111, N'校验A失败：仍有旧工单号引用', 1; END;

-- B：每个新号都已落到 plang
SELECT @bad = COUNT(*) FROM #map m
 WHERE NOT EXISTS (SELECT 1 FROM dbo.plang p WHERE p.pl_no = m.new_no AND ISNULL(p.asp_cancel,'N') <> 'Y');
IF @bad > 0 BEGIN THROW 50112, N'校验B失败：有新号未落到 plang', 1; END;

-- C：10 月单据行数不变(未误伤)
SELECT @post_oct = COUNT(*) FROM dbo.plang
 WHERE CAST(pl_date AS date) >= '2026-10-01'
   AND ISNULL([完工状态],N'') = N'生产完工' AND ISNULL(asp_cancel,'N') <> 'Y';
IF @post_oct <> @pre_oct BEGIN THROW 50113, N'校验C失败：10 月工单行数发生变化', 1; END;

COMMIT TRANSACTION;
PRINT N'[已提交] 工单号=' + CAST(@u_plang AS nvarchar(10))
    + N' / 排产=' + CAST(@u_pc AS nvarchar(10))
    + N' / 报工(gldh)=' + CAST(@u_scjl AS nvarchar(10))
    + N' / 报工(tm)=' + CAST(@u_scjl_tm AS nvarchar(10))
    + N' / 工序进度=' + CAST(@u_prog AS nvarchar(10))
    + N' / 首检=' + CAST(@u_qcf AS nvarchar(10))
    + N' / 制检=' + CAST(@u_qcp AS nvarchar(10))
    + N' / 组检=' + CAST(@u_qca AS nvarchar(10))
    + N' / 入库=' + CAST(@u_fin AS nvarchar(10))
    + N' / 领料头=' + CAST(@u_mo AS nvarchar(10))
    + N' / 领料行=' + CAST(@u_blmo AS nvarchar(10))
    + N' / 预排=' + CAST(@u_wpl AS nvarchar(10))
    + N' / 调拨=' + CAST(@u_wtl AS nvarchar(10))
    + N' / 号池=' + CAST(@u_no AS nvarchar(10))
    + N' / 占用链单号=' + CAST(@u_ff AS nvarchar(10))
    + N' / 占用链行键=' + CAST(@u_ffl AS nvarchar(10))
    + N' / 使用日志=' + CAST(@u_log AS nvarchar(10));
GO
/* ---------- ③ 提交后自检(基于 #map，仍在本连接) ---------- */
DECLARE @bad int = 0;
DECLARE @n_done int = (SELECT COUNT(*) FROM #map);
SELECT @bad = @bad + COUNT(*) FROM dbo.plang p JOIN #map m ON p.pl_no = m.old_no;
SELECT @bad = @bad + COUNT(*) FROM dbo.scjl s JOIN #map m ON s.gldh = m.old_no OR s.tm = m.old_no;
SELECT @bad = @bad + COUNT(*) FROM dbo.bd_finish_in f JOIN #map m ON f.[加工单号] = m.old_no;
IF @bad > 0 BEGIN THROW 50121, N'自检失败：旧工单号仍有残留', 1; END;
PRINT N'[自检通过] ' + CAST(@n_done AS nvarchar(10)) + N' 个工单号已迁到 09 月段';
GO
/* ============================================================
   §回滚(仅本批 155 个号)
     UPDATE p SET p.pl_no = N'GD-2026-10-' + RIGHT(p.pl_no,4)
       FROM dbo.plang p
      WHERE p.pl_no LIKE N'GD-2026-09-%'
        AND CAST(p.pl_date AS date) >= '2026-09-01' AND CAST(p.pl_date AS date) < '2026-10-01';
     其余表按回滚后的 plang 号反查(同样只认 9 月已结案行)，号池 s_allno 同步把 ny 拨回 2026-10。
     执行前逐号原值见 tools/archive/_wo-batch-date-20261021/_plno_before.tsv。
   ============================================================ */
