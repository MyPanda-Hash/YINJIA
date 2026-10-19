/* ============================================================
   migrate-clean-demo-wo-collision-20261019.sql
   「演示造数」清理：作废 2026-10-18 造数脚本(_wo-flow-20261018)遗留的整条工单链
   （默认只报告，不修改）

   背景（2026-10-19 全库扫描）：
     · 造数脚本把工单推进到「已结案」时,一共碰了 **9 张表**,都盖了 asp_user1='wo-flow-20261018':
         plang 418 · plang_pc 418 · bd_finish_in 418 · bl_finish_in 418
         qc_asm_insp_head 418 · qc_asm_insp_detail 836 · scjl 1254 · wo_progress 1254 · s_allno 2090
       ⇒ 正式库里的"已结案 + 入库齐 + 检验齐"有相当一部分是**演示单据**,不是真实生产。
     · 其中与 2026-10-19 真单撞号的只有 11 张工单(GD-2026-10-0013~0023),
       这些号下同时存在两组不同客户的行 ⇒ 工单号+行号不再唯一,报工/入库/检验/结案会互相串账
       (实测新组 19 行"蹭"到旧组的已审组装成品检验单)。

   两个范围：
     @scope = N'COLLISION'（默认）：只清这 11 张撞号单的旧组 —— 解除串账,不动其它 408 行历史。
     @scope = N'ALL_DEMO'          ：清掉全部演示链 —— **大手术**,正式库绝大部分工单历史与配套单据,
                                     必须 @confirmAll=1 且先备份。

   处置方式 = **作废**（asp_cancel='Y'）+ 留痕,不是物理 DELETE：
     作废后 MES 各处(列表/池/检验匹配/追溯/明细)本来就过滤作废行,效果等同删除;
     但保留可回滚、不会让库存/检验记录变孤儿。

   用法：
     ① 直接跑 = dry-run，打印 9 张表的候选数；
     ② 核对后把 @apply 改 1 再跑（幂等，可重复执行）。
   ============================================================ */
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.plang', N'U') IS NULL
BEGIN
    PRINT N'[跳过] 无 plang 表';
    RETURN;
END

DECLARE @apply bit = 0;                        -- 0 = 只报告 / 1 = 真作废
DECLARE @scope nvarchar(20) = N'COLLISION';    -- COLLISION(默认) / ALL_DEMO
DECLARE @confirmAll bit = 0;                   -- ALL_DEMO 必须同时改成 1
DECLARE @MARK nvarchar(50) = N'wo-flow-20261018';
DECLARE @oldBatch nvarchar(20) = N'20261014';

DECLARE @orders TABLE (pl_no nvarchar(50) PRIMARY KEY);
INSERT INTO @orders (pl_no) VALUES
 (N'GD-2026-10-0013'),
 (N'GD-2026-10-0014'), (N'GD-2026-10-0015'), (N'GD-2026-10-0016'), (N'GD-2026-10-0017'),
 (N'GD-2026-10-0018'), (N'GD-2026-10-0019'), (N'GD-2026-10-0020'), (N'GD-2026-10-0021'),
 (N'GD-2026-10-0022'), (N'GD-2026-10-0023');

IF @scope NOT IN (N'COLLISION', N'ALL_DEMO')
BEGIN RAISERROR(N'@scope 只能是 COLLISION 或 ALL_DEMO', 16, 1); RETURN; END
IF @scope = N'ALL_DEMO' AND @apply = 1 AND @confirmAll <> 1
BEGIN RAISERROR(N'ALL_DEMO 会清空大部分工单历史：先改 @confirmAll=1 并完成备份', 16, 1); RETURN; END

PRINT N'=== 范围:' + @scope + CASE WHEN @apply = 1 THEN N'（会真正作废）' ELSE N'（DRY-RUN，只报告）' END + N' ===';

-- 候选工单行 id
DECLARE @plangIds TABLE (id bigint PRIMARY KEY);
INSERT INTO @plangIds (id)
SELECT p.id FROM dbo.plang p
 WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
   AND p.asp_user1 = @MARK
   AND (@scope = N'ALL_DEMO' OR (p.[批次号] = @oldBatch AND p.pl_no IN (SELECT pl_no FROM @orders)));

-- 关联的排产薄记录 / 单据号
DECLARE @pcIds TABLE (id bigint PRIMARY KEY);
INSERT INTO @pcIds (id) SELECT pc.id FROM dbo.plang_pc pc WHERE pc.plang_id IN (SELECT id FROM @plangIds);

DECLARE @fiNos TABLE (doc_no nvarchar(50) PRIMARY KEY);
INSERT INTO @fiNos (doc_no)
SELECT f.[单据编号] FROM dbo.bd_finish_in f
 WHERE ISNULL(f.asp_cancel,'N') <> 'Y' AND f.asp_user1 = @MARK
   AND (@scope = N'ALL_DEMO' OR f.加工单号 IN (SELECT pl_no FROM @orders));

DECLARE @qcNos TABLE (doc_no nvarchar(50) PRIMARY KEY);
INSERT INTO @qcNos (doc_no)
SELECT h.[单据编号] FROM dbo.qc_asm_insp_head h
 WHERE ISNULL(h.asp_cancel,'N') <> 'Y' AND h.asp_user1 = @MARK
   AND (@scope = N'ALL_DEMO' OR h.工单号 IN (SELECT pl_no FROM @orders));

-- ① 候选清单（数量先落到变量：PRINT 里不允许子查询）
DECLARE @nP int = (SELECT COUNT(*) FROM @plangIds);
DECLARE @nPc int = (SELECT COUNT(*) FROM @pcIds);
DECLARE @nFi int = (SELECT COUNT(*) FROM @fiNos);
DECLARE @nQc int = (SELECT COUNT(*) FROM @qcNos);
PRINT N'候选工单行 ' + CAST(@nP AS nvarchar(10))
    + N' 行 / 排产记录 ' + CAST(@nPc AS nvarchar(10))
    + N' 行 / 产成品入库单 ' + CAST(@nFi AS nvarchar(10))
    + N' 张 / 组装成品检验单 ' + CAST(@nQc AS nvarchar(10)) + N' 张';

SELECT 表 = N'plang', 候选 = (SELECT COUNT(*) FROM @plangIds)
UNION ALL SELECT N'plang_pc', (SELECT COUNT(*) FROM @pcIds)
UNION ALL SELECT N'bd_finish_in', (SELECT COUNT(*) FROM @fiNos)
UNION ALL SELECT N'bl_finish_in', (SELECT COUNT(*) FROM dbo.bl_finish_in d
            WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND d.[单据编号] IN (SELECT doc_no FROM @fiNos))
UNION ALL SELECT N'qc_asm_insp_head', (SELECT COUNT(*) FROM @qcNos)
UNION ALL SELECT N'qc_asm_insp_detail', (SELECT COUNT(*) FROM dbo.qc_asm_insp_detail d
            WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND d.[单据编号] IN (SELECT doc_no FROM @qcNos))
UNION ALL SELECT N'scjl', (SELECT COUNT(*) FROM dbo.scjl s
            WHERE ISNULL(s.asp_cancel,'N')<>'Y'
              AND (s.gd_id IN (SELECT id FROM @pcIds)
                   OR ((s.gldh IN (SELECT pl_no FROM @orders) AND ISNULL(s.[批次号],N'')=@oldBatch))
                   OR (@scope = N'ALL_DEMO' AND s.asp_user1 = @MARK)))
UNION ALL SELECT N'wo_progress', (SELECT COUNT(*) FROM dbo.wo_progress w
            WHERE ISNULL(w.asp_cancel,'N')<>'Y'
              AND (w.[工单行id] IN (SELECT id FROM @plangIds)
                   OR (@scope = N'ALL_DEMO' AND w.asp_user1 = @MARK)))
UNION ALL SELECT N's_allno', (SELECT COUNT(*) FROM dbo.s_allno n
            WHERE ISNULL(n.asp_cancel,'N')<>'Y' AND n.asp_user1 = @MARK
              AND n.dh IN (SELECT doc_no FROM @fiNos UNION SELECT doc_no FROM @qcNos));

IF @apply = 0
BEGIN
    PRINT N'[DRY-RUN] @apply=0，未修改任何数据。核对后把 @apply 改成 1 再跑。';
    RETURN;
END

-- ② 作废（先细节/子表，后头表/主表）
UPDATE d SET d.asp_cancel='Y', d.asp_user2=N'清理演示造数(旧单)', d.asp_time2=GETDATE()
  FROM dbo.qc_asm_insp_detail d JOIN @qcNos n ON n.doc_no=d.[单据编号]
 WHERE ISNULL(d.asp_cancel,'N')<>'Y';
PRINT N'作废 组装成品检验明细: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

UPDATE h SET h.asp_cancel='Y', h.asp_user2=N'清理演示造数(旧单)', h.asp_time2=GETDATE()
  FROM dbo.qc_asm_insp_head h JOIN @qcNos n ON n.doc_no=h.[单据编号]
 WHERE ISNULL(h.asp_cancel,'N')<>'Y';
PRINT N'作废 组装成品检验单: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 张';

UPDATE s SET s.canceled='Y', s.update_at=GETDATE()
  FROM dbo.yj_doc_status s JOIN @qcNos n ON n.doc_no=s.doc_no
 WHERE s.panel_code=N'QC_ASM_INSP' AND ISNULL(s.canceled,'N')<>'Y';

UPDATE d SET d.asp_cancel='Y', d.asp_user2=N'清理演示造数(旧单)', d.asp_time2=GETDATE()
  FROM dbo.bl_finish_in d JOIN @fiNos n ON n.doc_no=d.[单据编号]
 WHERE ISNULL(d.asp_cancel,'N')<>'Y';
PRINT N'作废 入库单明细: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

UPDATE f SET f.asp_cancel='Y', f.asp_user2=N'清理演示造数(旧单)', f.asp_time2=GETDATE()
  FROM dbo.bd_finish_in f JOIN @fiNos n ON n.doc_no=f.[单据编号]
 WHERE ISNULL(f.asp_cancel,'N')<>'Y';
PRINT N'作废 产成品入库单: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 张';

UPDATE s SET s.asp_cancel='Y', s.asp_user2=N'清理演示造数(旧单)', s.asp_time2=GETDATE()
  FROM dbo.scjl s
 WHERE ISNULL(s.asp_cancel,'N')<>'Y'
   AND (s.gd_id IN (SELECT id FROM @pcIds)
        OR ((s.gldh IN (SELECT pl_no FROM @orders) AND ISNULL(s.[批次号],N'')=@oldBatch))
        OR (@scope = N'ALL_DEMO' AND s.asp_user1 = @MARK));
PRINT N'作废 报工行: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

UPDATE w SET w.asp_cancel='Y', w.asp_user2=N'清理演示造数(旧单)', w.asp_time2=GETDATE()
  FROM dbo.wo_progress w
 WHERE ISNULL(w.asp_cancel,'N')<>'Y'
   AND (w.[工单行id] IN (SELECT id FROM @plangIds)
        OR (@scope = N'ALL_DEMO' AND w.asp_user1 = @MARK));
PRINT N'作废 工序进度: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

UPDATE pc SET pc.asp_cancel='Y', pc.asp_user2=N'清理演示造数(旧单)', pc.asp_time2=GETDATE()
  FROM dbo.plang_pc pc
 WHERE pc.plang_id IN (SELECT id FROM @plangIds) AND ISNULL(pc.asp_cancel,'N')<>'Y';
PRINT N'作废 排产记录: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

UPDATE p SET p.asp_cancel='Y', p.asp_user2=N'清理演示造数(旧单)', p.asp_time2=GETDATE()
  FROM dbo.plang p WHERE p.id IN (SELECT id FROM @plangIds) AND ISNULL(p.asp_cancel,'N')<>'Y';
PRINT N'作废 工单行: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

UPDATE n SET n.asp_cancel='Y'
  FROM dbo.s_allno n
 WHERE ISNULL(n.asp_cancel,'N')<>'Y' AND n.asp_user1=@MARK
   AND n.dh IN (SELECT doc_no FROM @fiNos UNION SELECT doc_no FROM @qcNos);
PRINT N'作废 号池记录: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

-- ③ 自检
DECLARE @leftP int = (SELECT COUNT(*) FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y'
    AND p.asp_user1=@MARK AND (@scope=N'ALL_DEMO' OR (p.[批次号]=@oldBatch AND p.pl_no IN (SELECT pl_no FROM @orders))));
DECLARE @leftFi int = (SELECT COUNT(*) FROM dbo.bd_finish_in f WHERE ISNULL(f.asp_cancel,'N')<>'Y'
    AND f.asp_user1=@MARK AND (@scope=N'ALL_DEMO' OR f.加工单号 IN (SELECT pl_no FROM @orders)));
DECLARE @leftQc int = (SELECT COUNT(*) FROM dbo.qc_asm_insp_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
    AND h.asp_user1=@MARK AND (@scope=N'ALL_DEMO' OR h.工单号 IN (SELECT pl_no FROM @orders)));
IF @leftP=0 AND @leftFi=0 AND @leftQc=0 PRINT N'[PASS] 候选已全部作废（工单行/入库单/检验单 均为 0）'
ELSE PRINT N'[FAIL] 仍有 工单行 ' + CAST(@leftP AS nvarchar(10)) + N' / 入库单 ' + CAST(@leftFi AS nvarchar(10))
         + N' / 检验单 ' + CAST(@leftQc AS nvarchar(10)) + N' 未作废';

DECLARE @dup int = (SELECT COUNT(*) FROM (SELECT p.pl_no, ISNULL(p.pl_xc,0) x FROM dbo.plang p
    WHERE ISNULL(p.asp_cancel,'N')<>'Y' GROUP BY p.pl_no, ISNULL(p.pl_xc,0) HAVING COUNT(*)>1) d);
PRINT N'[参考] 全库仍有 ' + CAST(@dup AS nvarchar(10)) + N' 个「工单号+行号」重复';
