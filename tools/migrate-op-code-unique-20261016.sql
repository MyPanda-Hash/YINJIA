/* ============================================================
   migrate-op-code-unique-20261016.sql
   ------------------------------------------------------------
   工序档案(面板 OP / 表 dbo.bs_op)**工序编码唯一**:相同工序编码不允许出现重复。

   用户口径(2026-10-16):「工序档案表要增加校验,相同工序编码不允许出现重复,
   修改当前基础档案的工序实现,并把旧的留存数据进行处理」。

   为什么必须有(2026-10-16 逐账套实测):
     · bs_op 此前**没有任何唯一性校验** —— 面板保存走通用档案 upsert
       (ButtonService.saveArchive 逐行 insert/update),同一编码可存任意多行;
     · 下游全是按 工序编码 取值:ROUTE.工序编码 / ROUTE.工序名称 参照 OP、
       DISPATCH.工序编码、OP_TIME.gxdm、WO_ORDER.工序、wo_progress.工序 ……
       同码多行时"选中哪一行"只由 ORDER BY 决定 ⇒ 同一编码可能对应两种工序属性;
     · 存量确实是脏的:演示种子被灌了两次(PROD id 1..5 与 11..15 各一份),
       测试库三份(id 1 已作废 + 11 + 16)。

   三层校验(各司其职,本脚本只做数据库那层 + 元数据声明):
     ① 后端:ButtonService.saveArchive 按元数据声明做"同码"预检,报业务话术
        (声明来源 = yj_panel.config 的 "uniqueKeys",见本脚本 ④);
     ② 数据库(本脚本 ③):过滤唯一索引 ux_bs_op_code —— 只约束**存活行**,
        作废行不占码 ⇒「作废 → 重建同码」照常可用(与 ux_rd_spec_assign_doc /
        uq_bl_pu_label_doc_line 同款写法:WHERE [asp_cancel]='N');
     ③ 前端:保存前在已载入的全量行里查重,即时提示(不必等后端报错)。

   本脚本五件事(全部幂等,两账套均执行):
     ① 旧留存数据:同一 工序编码 的**存活**行只保留 id 最小的一行,其余软删
        (asp_cancel='Y' + asp_user2='op-code-dedupe',与界面「删除」同语义、可回溯,
         不物理删 —— 全库无任何表按 bs_op.id 外键引用,编码引用不受影响);
     ② asp_cancel 规范化:NULL → 'N' 并置 NOT NULL(默认约束 'N' 本来就在)。
        理由:过滤索引只能写 [asp_cancel]='N',**NULL 行会溜出索引**⇒ 漏判;
        与 rd_dev_task / rd_spec_assign 同款(两表都是 NOT NULL + 该过滤索引);
     ③ 建过滤唯一索引 ux_bs_op_code:bs_op(工序编码) WHERE [asp_cancel]='N';
     ④ yj_panel.config 写 "uniqueKeys":["工序编码"] —— 把"哪个面板哪几列唯一"
        变成元数据:以后别的档案要加,只插一行 config,不动代码;
     ⑤ 自检:存活重复数=0 / 索引在 / config 已声明,任一不满足即 RAISERROR 16。

   回滚(如需):DROP INDEX ux_bs_op_code ON dbo.bs_op;被软删的行按 asp_user2='op-code-dedupe' 找回。
   ============================================================ */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

PRINT N'== 工序编码唯一(bs_op) ==';

/* ① 旧留存数据:同码只留 id 最小的存活行,其余软删 */
DECLARE @dupeCodes int, @killed int = 0;
SELECT @dupeCodes = COUNT(*) FROM (
    SELECT 工序编码 FROM dbo.bs_op WHERE ISNULL(asp_cancel,'N') <> 'Y'
    GROUP BY 工序编码 HAVING COUNT(*) > 1) d;
PRINT N'  处理前:有重复的 工序编码 ' + CAST(ISNULL(@dupeCodes,0) AS nvarchar(10)) + N' 个';

;WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY 工序编码 ORDER BY id) AS rn
    FROM dbo.bs_op WHERE ISNULL(asp_cancel,'N') <> 'Y'
)
UPDATE o
   SET o.asp_cancel = 'Y', o.asp_user2 = N'op-code-dedupe', o.asp_time2 = SYSDATETIME()
  FROM dbo.bs_op o JOIN ranked r ON r.id = o.id
 WHERE r.rn > 1;
SET @killed = @@ROWCOUNT;
PRINT N'  已软删重复存活行 ' + CAST(@killed AS nvarchar(10)) + N' 行(各编码保留 id 最小的一行)';
GO

/* ② asp_cancel 规范化:NULL → 'N';列置 NOT NULL(默认约束 'N' 已存在则不重加) */
UPDATE dbo.bs_op SET asp_cancel = 'N' WHERE asp_cancel IS NULL;
PRINT N'  asp_cancel 由 NULL 归一为 N 的行数:' + CAST(@@ROWCOUNT AS nvarchar(10));
IF EXISTS (SELECT 1 FROM sys.columns
            WHERE object_id = OBJECT_ID('dbo.bs_op') AND name = 'asp_cancel' AND is_nullable = 1)
BEGIN
    ALTER TABLE dbo.bs_op ALTER COLUMN asp_cancel char(1) NOT NULL;
    PRINT N'  asp_cancel 已置 NOT NULL';
END
ELSE PRINT N'  asp_cancel 已是 NOT NULL,跳过';
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints
                WHERE parent_object_id = OBJECT_ID('dbo.bs_op')
                  AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.bs_op'), 'asp_cancel', 'ColumnId'))
BEGIN
    ALTER TABLE dbo.bs_op ADD CONSTRAINT df_bs_op_asp_cancel DEFAULT ('N') FOR asp_cancel;
    PRINT N'  已补默认约束 df_bs_op_asp_cancel';
END
GO

/* ③ 过滤唯一索引:存活行 工序编码 唯一(作废行不占码) */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.bs_op') AND name = N'ux_bs_op_code')
BEGIN
    CREATE UNIQUE INDEX ux_bs_op_code ON dbo.bs_op(工序编码) WHERE [asp_cancel] = 'N';
    PRINT N'  已建唯一索引 ux_bs_op_code(工序编码) WHERE asp_cancel=''N''';
END
ELSE PRINT N'  ux_bs_op_code 已存在,跳过';
GO

/* ④ 元数据声明:OP 面板的 工序编码 唯一(合并进既有 config,不覆盖别的键) */
DECLARE @cfg nvarchar(max);
SELECT @cfg = CONVERT(nvarchar(max), config) FROM yj_panel WHERE panel_code = N'OP';
IF @cfg IS NULL OR LTRIM(RTRIM(@cfg)) = N''
    SET @cfg = N'{"uniqueKeys":["工序编码"]}';
ELSE IF CONVERT(nvarchar(max), @cfg) NOT LIKE N'%uniqueKeys%' AND RIGHT(LTRIM(RTRIM(@cfg)), 1) = N'}'
    SET @cfg = LEFT(LTRIM(RTRIM(@cfg)), LEN(LTRIM(RTRIM(@cfg))) - 1) + N',"uniqueKeys":["工序编码"]}';
UPDATE yj_panel SET config = @cfg WHERE panel_code = N'OP';
PRINT N'  OP.config = ' + ISNULL(@cfg, N'(null)');
GO

/* ⑤ 自检 */
DECLARE @bad int = 0, @dupLeft int = 0;
SELECT @dupLeft = COUNT(*) FROM (
    SELECT 工序编码 FROM dbo.bs_op WHERE ISNULL(asp_cancel,'N') <> 'Y'
    GROUP BY 工序编码 HAVING COUNT(*) > 1) d;
IF @dupLeft > 0 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID('dbo.bs_op') AND name = N'ux_bs_op_code'
                  AND is_unique = 1 AND has_filter = 1)
    SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel
                WHERE panel_code = N'OP' AND CONVERT(nvarchar(max), config) LIKE N'%uniqueKeys%')
    SET @bad = @bad + 1;
IF @bad > 0
    RAISERROR(N'SELFCHECK FAIL: 工序编码唯一迁移未达标(存活重复 %d 个 / 自检失败项 %d)', 16, 1, @dupLeft, @bad);
ELSE
    PRINT N'SELFCHECK OK: 存活行 工序编码 无重复;ux_bs_op_code 就位;OP.config 已声明 uniqueKeys';
GO

/* ⑥ 结果一览 */
SELECT id, 工序编码, 工序名称, 状态, asp_cancel, asp_user2 FROM dbo.bs_op ORDER BY 工序编码, id;
GO
SELECT CASE WHEN EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.bs_op') AND name = N'ux_bs_op_code')
            THEN N'OK' ELSE N'MISSING' END AS 唯一索引,
       (SELECT COUNT(*) FROM dbo.bs_op WHERE ISNULL(asp_cancel,'N') <> 'Y') AS 存活行,
       (SELECT COUNT(DISTINCT 工序编码) FROM dbo.bs_op WHERE ISNULL(asp_cancel,'N') <> 'Y') AS 存活编码数,
       (SELECT CONVERT(nvarchar(200), config) FROM yj_panel WHERE panel_code = N'OP') AS OP配置;
GO
