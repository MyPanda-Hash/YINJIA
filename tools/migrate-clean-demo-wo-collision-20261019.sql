/* ============================================================
   migrate-clean-demo-wo-collision-20261019.sql
   「同号双客户」清理：作废 2026-10-18 演示造数遗留在 plang 的旧工单行 + 配套演示单据
   （默认只报告，不修改）

   背景（2026-10-19 现场核对）：
     · 正式库里 GD-2026-10-0014 ~ 0023 这 10 个工单号下**各有两组不同客户的行**：
         旧组：批次=20261014、排产=入库、结案=Y、客户=佛山水护盾/青岛伊可普/WaterLine…（31 行）
         新组：2026-10-19 由参考库/小程序新写入、库 0、未排产（32 行，客户=宁波碧纯/东莞优尼雅…）
       ⇒ 工单号+行号 不再唯一，报工/入库/检验/结案全按这个键锚定，会互相串账
         （实测：新组有 19 行"蹭"到了旧组的组装成品检验单，页面因此不标红）。
     · 旧组来历：tools/archive/_wo-flow-20261018/_seed-wo-flow.mjs 在 2026-10-14 21:32~22:03
       一次性把工单推进到「已结案」并插了配套单据，所有行/单都盖了 asp_user1='wo-flow-20261018'。
       全库带该标记的 plang 行共 **418 行 / 216 张工单**，bd_finish_in 418 张、qc_asm_insp_head 418 张。
     · 其中与 2026-10-19 真单撞号的只有 **10 张工单 / 31 行**（配套 31 张入库单 + 31 张组装成品检验单）。

   ⚠ 两个范围，别搞混：
     @scope = N'COLLISION'（默认）：只清这 10 张撞号单 —— 解除串账，不动其它 408 行历史。
     @scope = N'ALL_DEMO'          ：清掉全部 418 行演示账 —— **大手术**，会清空正式库绝大部分
                                     工单历史与配套单据，必须先把 @confirmAll 也改成 1，并先备份。

   处置方式 = **作废**（asp_cancel='Y'），不是物理 DELETE：
     · 物理删除会孤立库存/检验/领料记录，且不可回滚；作废后 MES 各处（列表/池/检验匹配/追溯）
       本来都过滤 asp_cancel='Y'，效果等同删除；
     · 留痕 asp_user2='清理演示撞号(旧单)', asp_time2=GETDATE()，事后可查、可回滚。

   用法：
     ① 直接跑 = dry-run，打印三张清单（工单行 / 入库单 / 检验单）；
     ② 核对无误后把 @apply 改 1 再跑（幂等，可重复执行）。
   ============================================================ */
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.plang', N'U') IS NULL
BEGIN
    PRINT N'[跳过] 无 plang 表';
    RETURN;
END

DECLARE @apply bit = 0;               -- 0 = 只报告 / 1 = 真作废
DECLARE @scope nvarchar(20) = N'COLLISION';   -- COLLISION(默认) / ALL_DEMO
DECLARE @confirmAll bit = 0;          -- ALL_DEMO 必须同时改成 1
DECLARE @MARK nvarchar(50) = N'wo-flow-20261018';   -- 演示造数标记(所有被造数脚本碰过的行都有)
DECLARE @oldBatch nvarchar(20) = N'20261014';       -- 旧组的生产批次

-- 2026-10-19 真单落库时复用掉的工单号（撞号清单）
DECLARE @orders TABLE (pl_no nvarchar(50) PRIMARY KEY);
INSERT INTO @orders (pl_no) VALUES
 (N'GD-2026-10-0014'), (N'GD-2026-10-0015'), (N'GD-2026-10-0016'), (N'GD-2026-10-0017'),
 (N'GD-2026-10-0018'), (N'GD-2026-10-0019'), (N'GD-2026-10-0020'), (N'GD-2026-10-0021'),
 (N'GD-2026-10-0022'), (N'GD-2026-10-0023');

IF @scope NOT IN (N'COLLISION', N'ALL_DEMO')
BEGIN
    RAISERROR(N'@scope 只能是 COLLISION 或 ALL_DEMO', 16, 1);
    RETURN;
END
IF @scope = N'ALL_DEMO' AND @apply = 1 AND @confirmAll <> 1
BEGIN
    RAISERROR(N'ALL_DEMO 是清空大部分历史的操作：先把 @confirmAll 改成 1、并完成备份', 16, 1);
    RETURN;
END

PRINT N'=== 范围:' + @scope + CASE WHEN @apply = 1 THEN N'（会真正作废）' ELSE N'（DRY-RUN，只报告）' END + N' ===';

-- ① 候选清单：工单行
;WITH cand AS (
    SELECT p.id, p.pl_no, ISNULL(p.pl_xc,0) AS pl_xc, ISNULL(p.[批次号],N'') AS 批次号,
           ISNULL(p.khdm,N'') AS 客户代码, ISNULL(p.dm,N'') AS 物料编码, ISNULL(p.mc,N'') AS 产品名称,
           ISNULL(p.scx,N'') AS 生产线, ISNULL(p.pl_sl,0) AS 排产数量, ISNULL(p.rk_sl,0) AS 入库数量,
           ISNULL(p.ja,N'') AS ja, ISNULL(p.asp_user1,N'') AS 建单人,
           CONVERT(varchar(19), p.asp_time1, 120) AS 建单时间
      FROM dbo.plang p
     WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
       AND ISNULL(p.ja,'N') IN (N'T', N'Y')
       AND p.asp_user1 = @MARK
       AND p.[批次号] = @oldBatch
       AND (@scope = N'ALL_DEMO' OR p.pl_no IN (SELECT pl_no FROM @orders))
)
SELECT 工单号 = pl_no, 工单行号 = pl_xc, 批次号, 客户代码, 物料编码, 产品名称, 生产线,
       排产数量, 入库数量, ja, 建单人, 建单时间
  FROM cand ORDER BY pl_no, pl_xc;

-- ② 候选数量
DECLARE @nPlang int = (
    SELECT COUNT(*) FROM dbo.plang p
     WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.ja,'N') IN (N'T',N'Y')
       AND p.asp_user1 = @MARK AND p.[批次号] = @oldBatch
       AND (@scope = N'ALL_DEMO' OR p.pl_no IN (SELECT pl_no FROM @orders)));
DECLARE @nFi int = (
    SELECT COUNT(*) FROM dbo.bd_finish_in f
     WHERE ISNULL(f.asp_cancel,'N') <> 'Y' AND f.asp_user1 = @MARK
       AND (@scope = N'ALL_DEMO' OR f.加工单号 IN (SELECT pl_no FROM @orders)));
DECLARE @nQc int = (
    SELECT COUNT(*) FROM dbo.qc_asm_insp_head h
     WHERE ISNULL(h.asp_cancel,'N') <> 'Y' AND h.asp_user1 = @MARK
       AND (@scope = N'ALL_DEMO' OR h.工单号 IN (SELECT pl_no FROM @orders)));
PRINT N'候选：工单行 ' + CAST(@nPlang AS nvarchar(10)) + N' 行 / 产成品入库单 ' + CAST(@nFi AS nvarchar(10))
    + N' 张 / 组装成品检验单 ' + CAST(@nQc AS nvarchar(10)) + N' 张';

IF @apply = 0
BEGIN
    PRINT N'[DRY-RUN] @apply=0，未修改任何数据。核对清单后把 @apply 改成 1 再跑。';
    PRINT N'[提示] 真要清理演示账全部 418 行，把 @scope 改成 ALL_DEMO 且 @confirmAll 改成 1（先备份）。';
    RETURN;
END

-- ③ 作废工单行
UPDATE p
   SET p.asp_cancel = 'Y', p.asp_user2 = N'清理演示撞号(旧单)', p.asp_time2 = GETDATE()
  FROM dbo.plang p
 WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.ja,'N') IN (N'T',N'Y')
   AND p.asp_user1 = @MARK AND p.[批次号] = @oldBatch
   AND (@scope = N'ALL_DEMO' OR p.pl_no IN (SELECT pl_no FROM @orders));
PRINT N'已作废工单行：' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

-- ④ 作废配套演示单据（入库单：头 + 明细）
DECLARE @fiNos TABLE (doc_no nvarchar(50) PRIMARY KEY);
INSERT INTO @fiNos (doc_no)
SELECT f.[单据编号] FROM dbo.bd_finish_in f
 WHERE ISNULL(f.asp_cancel,'N') <> 'Y' AND f.asp_user1 = @MARK
   AND (@scope = N'ALL_DEMO' OR f.加工单号 IN (SELECT pl_no FROM @orders));

UPDATE f SET f.asp_cancel = 'Y', f.asp_user2 = N'清理演示撞号(旧单)', f.asp_time2 = GETDATE()
  FROM dbo.bd_finish_in f JOIN @fiNos n ON n.doc_no = f.[单据编号];
PRINT N'已作废产成品入库单：' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 张';

UPDATE d SET d.asp_cancel = 'Y'
  FROM dbo.bl_finish_in d JOIN @fiNos n ON n.doc_no = d.[单据编号]
 WHERE ISNULL(d.asp_cancel,'N') <> 'Y';
PRINT N'已作废入库单明细：' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

-- ⑤ 作废配套演示单据（组装成品检验单：头 + 明细 + 单据状态）
DECLARE @qcNos TABLE (doc_no nvarchar(50) PRIMARY KEY);
INSERT INTO @qcNos (doc_no)
SELECT h.[单据编号] FROM dbo.qc_asm_insp_head h
 WHERE ISNULL(h.asp_cancel,'N') <> 'Y' AND h.asp_user1 = @MARK
   AND (@scope = N'ALL_DEMO' OR h.工单号 IN (SELECT pl_no FROM @orders));

UPDATE h SET h.asp_cancel = 'Y', h.asp_user2 = N'清理演示撞号(旧单)', h.asp_time2 = GETDATE()
  FROM dbo.qc_asm_insp_head h JOIN @qcNos n ON n.doc_no = h.[单据编号];
PRINT N'已作废组装成品检验单：' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 张';

UPDATE d SET d.asp_cancel = 'Y'
  FROM dbo.qc_asm_insp_detail d JOIN @qcNos n ON n.doc_no = d.[单据编号]
 WHERE ISNULL(d.asp_cancel,'N') <> 'Y';
PRINT N'已作废检验单明细：' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

UPDATE s SET s.canceled = 'Y', s.update_at = GETDATE()
  FROM dbo.yj_doc_status s JOIN @qcNos n ON n.doc_no = s.doc_no
 WHERE s.panel_code = N'QC_ASM_INSP' AND ISNULL(s.canceled,'N') <> 'Y';
PRINT N'已撤销检验单状态：' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 张';

-- ⑥ 自检：撞号单里不应再有「旧组」未作废行；新组行应不再命中已审检验单
DECLARE @left int = (
    SELECT COUNT(*) FROM dbo.plang p
     WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND p.asp_user1 = @MARK AND p.[批次号] = @oldBatch
       AND (@scope = N'ALL_DEMO' OR p.pl_no IN (SELECT pl_no FROM @orders)));
IF @left = 0 PRINT N'[PASS] 旧组行已全部作废'
ELSE PRINT N'[FAIL] 仍有 ' + CAST(@left AS nvarchar(10)) + N' 行未作废';

DECLARE @dup int = (
    SELECT COUNT(*) FROM (
        SELECT pl_no, ISNULL(pl_xc,0) AS xc
          FROM dbo.plang WHERE ISNULL(asp_cancel,'N') <> 'Y'
         GROUP BY pl_no, ISNULL(pl_xc,0) HAVING COUNT(*) > 1) d);
PRINT N'[参考] 全库仍有 ' + CAST(@dup AS nvarchar(10)) + N' 个「工单号+行号」重复（其它历史批次，不影响本次 10 张）';
