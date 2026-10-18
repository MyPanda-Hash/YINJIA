/* ============================================================
   migrate-whloc-unique-20261018.sql
   ------------------------------------------------------------
   仓位档案(面板 WHLOC / 表 dbo.bs_wh_loc)**仓内唯一**:
   同一「仓库编码 + 仓位编码」只允许一行存活记录。

   用户口径(2026-10-18):
     · 不需要全局唯一 —— 不同仓库可以有相同仓位编码;
     · 只需要「当前仓库编码 + 仓位编码」唯一;
     · 仓位地址含中文且是自由文本,不再进二维码 ⇒
       二维码由 仓库编码@仓位地址@仓位编码 改为 仓库编码@仓位编码
       (前端 print-formats.locationCardQrText;本脚本只做库层约束与元数据声明)。

   为什么必须有:
     · 此前 bs_wh_loc 只有主键,没有 (仓库编码, 仓位编码) 唯一约束;
     · 前端 qrRowKey、二维码首段都假设"仓内唯一",但库存里重复码仍可进入;
     · yj_panel.config 也未声明 uniqueKeys,保存前预检/即时查重都没生效。

   三层校验(本脚本只做数据库那层 + 元数据声明):
     ① 数据库:过滤唯一索引 ux_bs_wh_loc_wh_code
        ON bs_wh_loc(仓库编码, 仓位编码) WHERE [asp_cancel]='N'
        —— 只约束存活行,作废行不占码(同 ux_bs_op_code / ux_rd_spec_assign_doc 口径);
     ② 后端:ButtonService.saveArchive 按 yj_panel.config 的 uniqueKeys 做保存前预检;
     ③ 前端:PanelxList.validateArchiveUniqueKeys 按 metadata.uniqueKeys 即时查重。

   本脚本五件事(全部幂等,两账套均执行):
     ① asp_cancel 规范化:NULL → 'N' 并置 NOT NULL(过滤索引只认 'N',NULL 会溜出索引);
     ② 预检存活行重复 / 空仓库编码 / 空仓位编码;有则 RAISERROR 并停止(不静默删业务数据);
     ③ 建过滤唯一索引 ux_bs_wh_loc_wh_code;
     ④ yj_panel.config 写 "uniqueKeys":[["仓库","仓位编码"]](合并进既有 config,不覆盖别的键);
     ⑤ 自检:存活重复=0 / 索引在 / config 已声明,任一不满足即 RAISERROR 16。

   回滚(如需):
     DROP INDEX ux_bs_wh_loc_wh_code ON dbo.bs_wh_loc;
     UPDATE yj_panel SET config = NULL WHERE panel_code = N'WHLOC';  -- 仅当本脚本之前 config 为空
   ============================================================ */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

PRINT N'== 仓位编码仓内唯一(bs_wh_loc) ==';

/* ① asp_cancel 规范化:NULL → 'N';列置 NOT NULL(默认约束已存在则不重加) */
UPDATE dbo.bs_wh_loc SET asp_cancel = 'N' WHERE asp_cancel IS NULL;
PRINT N'  asp_cancel 由 NULL 归一为 N 的行数:' + CAST(@@ROWCOUNT AS nvarchar(10));

IF EXISTS (SELECT 1 FROM sys.columns
            WHERE object_id = OBJECT_ID('dbo.bs_wh_loc') AND name = 'asp_cancel' AND is_nullable = 1)
BEGIN
    ALTER TABLE dbo.bs_wh_loc ALTER COLUMN asp_cancel nvarchar(1) NOT NULL;
    PRINT N'  asp_cancel 已置 NOT NULL';
END
ELSE PRINT N'  asp_cancel 已是 NOT NULL,跳过';

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints
                WHERE parent_object_id = OBJECT_ID('dbo.bs_wh_loc')
                  AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.bs_wh_loc'), 'asp_cancel', 'ColumnId'))
BEGIN
    ALTER TABLE dbo.bs_wh_loc ADD CONSTRAINT df_bs_wh_loc_asp_cancel DEFAULT ('N') FOR asp_cancel;
    PRINT N'  已补默认约束 df_bs_wh_loc_asp_cancel';
END
GO

/* ② 预检:存活行不能有重复的 (仓库编码, 仓位编码),也不能有空仓库/空仓位编码 */
DECLARE @dup int, @empty int;
SELECT @dup = COUNT(*) FROM (
    SELECT 仓库编码, 仓位编码
    FROM dbo.bs_wh_loc
    WHERE ISNULL(asp_cancel, 'N') <> 'Y'
    GROUP BY 仓库编码, 仓位编码
    HAVING COUNT(*) > 1
) d;
SELECT @empty = COUNT(*) FROM dbo.bs_wh_loc
 WHERE ISNULL(asp_cancel, 'N') <> 'Y'
   AND (仓库编码 IS NULL OR LTRIM(RTRIM(仓库编码)) = N''
        OR 仓位编码 IS NULL OR LTRIM(RTRIM(仓位编码)) = N'');

IF @dup > 0 OR @empty > 0
BEGIN
    RAISERROR(N'PRE-CHECK FAIL: 存活行重复(仓库编码+仓位编码) %d 组 / 空仓库或空仓位编码 %d 行;请先清理数据再重跑', 16, 1, @dup, @empty);
    RETURN;
END
PRINT N'  预检通过:存活行无重复、无空仓库/空仓位编码';
GO

/* ③ 过滤唯一索引:存活行 (仓库编码, 仓位编码) 唯一;作废行不占码 */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID('dbo.bs_wh_loc') AND name = N'ux_bs_wh_loc_wh_code')
BEGIN
    CREATE UNIQUE INDEX ux_bs_wh_loc_wh_code
        ON dbo.bs_wh_loc(仓库编码, 仓位编码)
        WHERE [asp_cancel] = 'N';
    PRINT N'  已建唯一索引 ux_bs_wh_loc_wh_code(仓库编码, 仓位编码) WHERE asp_cancel=''N''';
END
ELSE PRINT N'  ux_bs_wh_loc_wh_code 已存在,跳过';
GO

/* ④ 元数据声明:WHLOC 面板的 (仓库编码, 仓位编码) 唯一(合并进既有 config,不覆盖别的键) */
DECLARE @cfg nvarchar(max);
SELECT @cfg = CONVERT(nvarchar(max), config) FROM yj_panel WHERE panel_code = N'WHLOC';
IF @cfg IS NULL OR LTRIM(RTRIM(@cfg)) = N''
    SET @cfg = N'{"uniqueKeys":[["仓库","仓位编码"]]}';
ELSE IF @cfg NOT LIKE N'%uniqueKeys%' AND RIGHT(LTRIM(RTRIM(@cfg)), 1) = N'}'
    SET @cfg = LEFT(LTRIM(RTRIM(@cfg)), LEN(LTRIM(RTRIM(@cfg))) - 1) + N',"uniqueKeys":[["仓库","仓位编码"]]}';
UPDATE yj_panel SET config = @cfg WHERE panel_code = N'WHLOC';
PRINT N'  WHLOC.config = ' + ISNULL(@cfg, N'(null)');
GO

/* ⑤ 自检 */
DECLARE @bad int = 0, @dupLeft int = 0;
SELECT @dupLeft = COUNT(*) FROM (
    SELECT 仓库编码, 仓位编码
    FROM dbo.bs_wh_loc
    WHERE ISNULL(asp_cancel, 'N') <> 'Y'
    GROUP BY 仓库编码, 仓位编码
    HAVING COUNT(*) > 1
) d;
IF @dupLeft > 0 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID('dbo.bs_wh_loc') AND name = N'ux_bs_wh_loc_wh_code'
                  AND is_unique = 1 AND has_filter = 1)
    SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel
                WHERE panel_code = N'WHLOC'
                  AND CONVERT(nvarchar(max), config) LIKE N'%uniqueKeys%'
                  AND CONVERT(nvarchar(max), config) LIKE N'%仓库%'
                  AND CONVERT(nvarchar(max), config) LIKE N'%仓位编码%')
    SET @bad = @bad + 1;
IF @bad > 0
    RAISERROR(N'SELFCHECK FAIL: 仓位仓内唯一迁移未达标(存活重复 %d 组 / 自检失败项 %d)', 16, 1, @dupLeft, @bad);
ELSE
    PRINT N'SELFCHECK OK: 存活行 (仓库编码, 仓位编码) 无重复;ux_bs_wh_loc_wh_code 就位;WHLOC.config 已声明 uniqueKeys';
GO

/* ⑥ 结果一览 */
SELECT CASE WHEN EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.bs_wh_loc') AND name = N'ux_bs_wh_loc_wh_code')
            THEN N'OK' ELSE N'MISSING' END AS 唯一索引,
       (SELECT COUNT(*) FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel, 'N') <> 'Y') AS 存活行,
       (SELECT COUNT(DISTINCT 仓库编码 + N'|' + 仓位编码) FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel, 'N') <> 'Y') AS 存活仓库仓位组合数,
       (SELECT CONVERT(nvarchar(200), config) FROM yj_panel WHERE panel_code = N'WHLOC') AS WHLOC配置;
GO