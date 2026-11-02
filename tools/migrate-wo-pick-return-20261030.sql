/* ============================================================
   migrate-wo-pick-return-20261030.sql — 生产退料改为「已完成领料单上按需退料」

   用户口径(2026-10-30 第三轮):
     「还有关于生产退料我有别的想法,就是退料直接在生产领料界面。可以点开已完成的生产领料数据
       再次进行扫码。这样就可以来退料了。然后退料的单据做一个退料的标志。」
   四问确认:
     ① **只有已完成**的领料单可以点开退料;
     ② 累计可退 = **已领数量 − 已退数量**(同一物料可分多次退);
     ③ 退料标志 = 业务类型「生产退料」**+ 单据头加一个「退料」标志列**;
     ④ 领料单状态**保持「已完成」**(写着含退料即可,不改语义)。

   ------------------------------------------------------------
   ★ 为什么推翻上一版「生单时同时生成退料单」
   ------------------------------------------------------------
   上一版按用户首轮口径「对应生成一条生产领料单和生产退料单的数据」,在生单时就建一张
   **数量全 0 的退料单草稿**,不做退料就整单作废。跑通后用户改了主意,新口径更合理:
     · 数量 0 的退料草稿是**空单**:它会出现在其他入库单列表里、被当成"待处理"、还要专门作废;
       一张领料单如果从来没人退料,账上就多一张废单 —— 噪声;
     · 退料是**领完之后的后续动作**,天然属于"已完成"的单据;提前生成等于猜它一定会有退料。
   ⇒ 新模型:**退料不再预生成**。点开已完成的领料单 → 扫码 → 退多少生多少,
     每次退料生成一张真的「其他入库单」并审核入账。

   ------------------------------------------------------------
   ★ 本脚本做四件事
   ------------------------------------------------------------
   ① `bd_other_in` 加 **`退料标志`** 列(nvarchar(10),NULL)——退料单盖「生产退料」,
      领用表;查询/报表按它一眼筛出"这是退料,不是普通其他入库":
        · 为什么不只用「业务类型=生产退料」:业务类型是**可被人工改的下拉值**,
          标志列是单据属性、不随下拉变化;两者并存:标志列用于系统判定,业务类型用于显示;
   ② 新表 **`wo_pick_return`**(退料台账):一行 = 一次退料;
      记录 领料单号 / 工单号+行号 / 物料 / 退料数量 / 生成的退料单号 ——
      这是"已退数量"的**唯一真源**(累计可退 = 已领 − 已退 靠它算);
   ③ 清理上一版留下的**数量全 0 的空退料单**(它们已被本方案取代):
      只作废 `业务类型='生产退料'` **且**所有明细数量都为 0 的单,并核对影响行数;
      有数量的(说明现场真退过)一律不动;
   ④ 台账 `wo_pick_doc` 的 `退料单号` 列**保留但不再写入**(历史行里可能还有旧单号)。

   幂等:加列判存在、建表判存在、清理判行数;可重复执行。
   两账套都执行,已登记 tools/db-migrations.txt。
   ============================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

/* ---------- ① 单据头加「退料标志」列 ---------- */
IF COL_LENGTH('dbo.bd_other_in', '退料标志') IS NULL
BEGIN
    ALTER TABLE dbo.bd_other_in ADD 退料标志 nvarchar(10) NULL;
    PRINT N'[OK] bd_other_in + 退料标志';
END
ELSE PRINT N'[SKIP] bd_other_in.退料标志 已存在';
GO

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.bd_other_in')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'退料标志', 'ColumnId')
                  AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'退料标志(非空=这是一张生产退料单;由手机扫码·生产领料退料生成,用于与普通其他入库单区分)',
       N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'退料标志';
GO

/* ---------- ② 退料台账(一行 = 一次退料) ---------- */
IF OBJECT_ID('dbo.wo_pick_return','U') IS NULL
CREATE TABLE dbo.wo_pick_return (
  id          int IDENTITY(1,1) NOT NULL CONSTRAINT PK_wo_pick_return PRIMARY KEY,
  -- 退的是哪张领料单(材料出库单 bd_material_out.单据编号)
  领料单号    nvarchar(60)   NOT NULL,
  -- 工单键(与 plang/wo_pick_doc 同口径,便于按工单追溯)
  工单号      nvarchar(60)   NULL,
  工单行号    int            NOT NULL CONSTRAINT DF_wo_pick_return_xc DEFAULT 0,
  -- 退的是哪个物料、多少(物料 + 数量 是累计可退的计算单位)
  物料编码    nvarchar(120)  NOT NULL,
  物料名称    nvarchar(200)  NULL,
  计量单位    nvarchar(50)   NULL,
  仓库        nvarchar(100)  NULL,
  批号        nvarchar(100)  NULL,
  退料数量    decimal(18,4)  NOT NULL CONSTRAINT DF_wo_pick_return_qty DEFAULT 0,
  -- 这次退料生成的退料单(= bd_other_in.单据编号)
  退料单号    nvarchar(60)   NULL,
  退料人      nvarchar(50)   NULL,
  退料时间    datetime2      NULL CONSTRAINT DF_wo_pick_return_at DEFAULT SYSDATETIME(),
  备注        nvarchar(1000) NULL,
  asp_user1   nvarchar(50)   NULL,
  asp_time1   datetime2      NULL,
  asp_user2   nvarchar(50)   NULL,
  asp_time2   datetime2      NULL,
  asp_cancel  char(1)        NOT NULL CONSTRAINT DF_wo_pick_return_cancel DEFAULT 'N'
);
GO

-- 查"这张领料单已退多少 / 这个物料退过几次"是最高频查询(每次退料都要算累计可退)
IF OBJECT_ID('dbo.wo_pick_return','U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wo_pick_return_out' AND object_id = OBJECT_ID('dbo.wo_pick_return'))
  CREATE INDEX IX_wo_pick_return_out ON dbo.wo_pick_return(领料单号, 物料编码);
GO
IF OBJECT_ID('dbo.wo_pick_return','U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wo_pick_return_doc' AND object_id = OBJECT_ID('dbo.wo_pick_return'))
  CREATE INDEX IX_wo_pick_return_doc ON dbo.wo_pick_return(退料单号);
GO

/* 中文注明(表级 + 列级) */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.wo_pick_return') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'手机扫码·生产领料 退料台账:一行 = 一次退料(领料单 + 物料 + 本次退多少 + 生成的退料单号);是「已退数量」的唯一真源,不参与库存增减',
       N'SCHEMA', N'dbo', N'TABLE', N'wo_pick_return';

DECLARE @c TABLE (col sysname, descr nvarchar(500));
INSERT INTO @c (col, descr) VALUES
 (N'id',         N'主键(自增;一行 = 一次退料)'),
 (N'领料单号',   N'被退的领料单号(材料出库单 bd_material_out.单据编号)'),
 (N'工单号',     N'工单号(与 plang.pl_no 同口径,便于按工单追溯)'),
 (N'工单行号',   N'工单行号(与 plang.pl_xc 同口径)'),
 (N'物料编码',   N'退的是哪个物料(累计可退按 领料单号 + 物料编码 计算)'),
 (N'物料名称',   N'物料名称(退料当时的快照)'),
 (N'计量单位',   N'计量单位(退料当时的快照)'),
 (N'仓库',       N'退料入的仓库'),
 (N'批号',       N'批号(有批次时按批次核销)'),
 (N'退料数量',   N'本次退料数量(>0;累计可退 = 已领 − 本表同物料退料合计)'),
 (N'退料单号',   N'本次退料生成的其他入库单号(bd_other_in.单据编号)'),
 (N'退料人',     N'退料操作人'),
 (N'退料时间',   N'退料时间'),
 (N'备注',       N'备注'),
 (N'asp_user1',  N'创建人(审计列)'),
 (N'asp_time1',  N'创建时间(审计列)'),
 (N'asp_user2',  N'最后修改人(审计列)'),
 (N'asp_time2',  N'最后修改时间(审计列)'),
 (N'asp_cancel', N'作废标记(N=有效;Y=作废;作废后该笔退料不再计入已退数量)');

DECLARE @col sysname, @d nvarchar(500);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, descr FROM @c;
OPEN cur;
FETCH NEXT FROM cur INTO @col, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                  WHERE major_id = OBJECT_ID(N'dbo.wo_pick_return')
                    AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.wo_pick_return'), @col, 'ColumnId')
                    AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @d,
         N'SCHEMA', N'dbo', N'TABLE', N'wo_pick_return', N'COLUMN', @col;
  FETCH NEXT FROM cur INTO @col, @d;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ---------- ③ 给已有的退料单盖标志(历史里业务类型已是「生产退料」的) ----------
   ⚠ 这一步在**字段登记脚本**跑之前做是无效的(只改物理列,没登记进 yj_field);
     放在这里是因为它针对的是"历史单据",与字段登记脚本的先后无关 ——
     两脚本都是幂等的,谁先谁后都能把历史行补齐(2026-10-30 实测:先跑本脚本时
     三张历史退料单不回填,后跑回填脚本才补上;为免记顺序,直接两处都写)。 */
UPDATE dbo.bd_other_in
   SET 退料标志 = N'生产退料'
 WHERE 退料标志 IS NULL
   AND 业务类型 = N'生产退料';
GO

/* ---------- ④ 清理上一版留下的「数量全 0 空退料单」 ----------
   本方案不再预生成退料单,故那些 0 数量草稿全部作废。
   判据:业务类型=生产退料 且 **所有明细数量都是 0** 且 还没被作废。
   有数量的(现场真退过)一律不动 —— 只用 PRINT 报个数,人工核。 */
DECLARE @voided int = 0;
DECLARE @hasQty int;

SELECT @hasQty = COUNT(DISTINCT h.单据编号)
  FROM dbo.bd_other_in h
  JOIN dbo.bl_other_in l ON l.单据编号 = h.单据编号 AND ISNULL(l.asp_cancel,'N') <> 'Y'
 WHERE h.业务类型 = N'生产退料'
   AND ISNULL(h.asp_cancel,'N') <> 'Y'
   AND ISNULL(l.数量,0) <> 0;

UPDATE h
   SET h.asp_cancel = 'Y'
  FROM dbo.bd_other_in h
 WHERE h.业务类型 = N'生产退料'
   AND ISNULL(h.asp_cancel,'N') <> 'Y'
   -- 该单没有任何数量非 0 的明细
   AND NOT EXISTS (SELECT 1 FROM dbo.bl_other_in l
                    WHERE l.单据编号 = h.单据编号
                      AND ISNULL(l.asp_cancel,'N') <> 'Y'
                      AND ISNULL(l.数量,0) <> 0);
SET @voided = @@ROWCOUNT;

UPDATE dbo.bl_other_in
   SET asp_cancel = 'Y'
 WHERE ISNULL(asp_cancel,'N') <> 'Y'
   AND 单据编号 IN (SELECT 单据编号 FROM dbo.bd_other_in
                     WHERE 业务类型 = N'生产退料' AND ISNULL(asp_cancel,'N') = 'Y');

PRINT N'[清理] 作废了 ' + CAST(@voided AS nvarchar(10)) + N' 张数量全 0 的空退料单'
    + N'(有数量的退料单 ' + CAST(ISNULL(@hasQty,0) AS nvarchar(10)) + N' 张,保留未动)';
GO

/* ---------- ⑤ 自检 ---------- */
DECLARE @colOk int, @tblOk int, @idxOk int, @descOk int;
SELECT @colOk = CASE WHEN COL_LENGTH('dbo.bd_other_in','退料标志') IS NOT NULL THEN 1 ELSE 0 END;
SELECT @tblOk = CASE WHEN OBJECT_ID('dbo.wo_pick_return','U') IS NOT NULL THEN 1 ELSE 0 END;
SELECT @idxOk = COUNT(*) FROM sys.indexes
 WHERE object_id = OBJECT_ID(N'dbo.wo_pick_return')
   AND name IN (N'IX_wo_pick_return_out', N'IX_wo_pick_return_doc');
SELECT @descOk = COUNT(*) FROM sys.extended_properties
 WHERE major_id = OBJECT_ID(N'dbo.wo_pick_return') AND minor_id > 0 AND name = N'MS_Description';

IF @colOk = 0   RAISERROR(N'[FAIL] bd_other_in 缺「退料标志」列', 16, 1);
IF @tblOk = 0   RAISERROR(N'[FAIL] wo_pick_return 表没建出来', 16, 1);
IF @idxOk <> 2  RAISERROR(N'[FAIL] wo_pick_return 索引 %d/2', 16, 1, @idxOk);
IF @descOk < 19 RAISERROR(N'[FAIL] wo_pick_return 列级中文注明 %d/19(AGENTS:新表必须逐列注明)', 16, 1, @descOk);

IF @colOk = 1 AND @tblOk = 1 AND @idxOk = 2 AND @descOk >= 19
   PRINT N'[PASS] 退料标志列 + 退料台账(19 列 / 2 索引 / 19 条注明)齐备';
GO
