/* migrate-align-docdate-batch-time-20261016.sql
 * 把「批号/批次号日期后缀」「转ERP时间/创建时间」「送料暂收单·来料检验单的日期与时间」
 * 统一对齐到各自**单据日期**,并把时间列统一落在 12:00(避免 UTC±8 显示成前后一天)。
 *
 * 【为什么有这条 —— 2026-10-16】
 *   这批数据修正在协作机上是拿 node 直连脚本做的(tools/archive/_align-batch-ledger-1016.mjs、
 *   _align-batch-all2-1016.mjs、_align-batch-erp-created-1016.mjs、_align-recv-insp-date-1016.mjs、
 *   _align-recv-insp-times-1016.mjs、_fix-time-of-day-1016.mjs)。那些脚本:
 *     · 硬编码 database:'HSDZ_MES',只修了正式库、**不进迁移链**;
 *     · 部署走「用本地库整体覆盖服务器」(AGENTS 部署规范 §2)⇒ 本地库没这批修正的话,
 *       下次部署会把服务器上已经对齐好的批次号/日期**又带回去**。
 *   故把它们**规则化、幂等化**成这一条 SQL 迁移并登记 db-migrations.txt,
 *   从此任何账套(含未来重建/恢复)跑一遍 DbSync 就自带这批修正。
 *
 * 【规则(与上述脚本逐条等价)】
 *   §1 批号/批次号 形如 `前缀-yyyyMMdd`(结尾 8 位数字)⇒ 把日期段换成该行的单据日期;
 *      日期来源优先级:① 源采购订单(sl_recv / sl_recv_detail / qc_insp 三条链强制走源订单)
 *                      ② 本表 单据日期 → 日期 → 发生日期
 *                      ③ 头表 单据日期(bl_X→bd_X、X_detail→X、X_head→X)
 *      非日期形态(PC0000、金蝶批次)原样不动;找不到日期来源的表跳过。
 *   §2 金蝶同步单据(asp_user1=N'试运行'):批次号日期段→单据日期;转ERP时间=单据日期;创建时间=单据日期。
 *   §3 送料暂收单/来料检验单:单据日期=源采购订单单据日期;审核/审批/检验时间与 asp_time1/2 = 源订单日期 12:00;
 *      留痕 yj_doc_status(QC_RECV/QC_INSP).shsj 与 pending_at = 源订单日期 12:00。
 *
 * 【幂等/安全】全部 UPDATE 都带「当前值 ≠ 目标值」守卫 ⇒ 重跑是空操作;
 *   只改值不增删行;不动物理表结构、不动 yj_field/yj_translation。
 *
 * 【执行】两账套各跑一遍(先 HSDZ_MES 后 HSDZ_MES_TEST),跑到「执行 0、失败 0」。
 */
SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT N'== §1 批号/批次号 日期后缀 → 单据日期 ==';
DECLARE @tbl sysname, @col sysname, @link sysname, @head sysname;
DECLARE @dt nvarchar(200), @join nvarchar(400), @sql nvarchar(max), @n int, @sum int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT t.name, c.name
  FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
  WHERE c.name IN (N'批号', N'批次号') AND t.is_ms_shipped = 0
  ORDER BY t.name, c.name;
OPEN cur;
FETCH NEXT FROM cur INTO @tbl, @col;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @dt = NULL; SET @join = N'';

  -- ② 本表日期列
  IF COL_LENGTH(@tbl, N'单据日期') IS NOT NULL SET @dt = N'x.[单据日期]';
  ELSE IF COL_LENGTH(@tbl, N'日期') IS NOT NULL SET @dt = N'x.[日期]';
  ELSE IF COL_LENGTH(@tbl, N'发生日期') IS NOT NULL SET @dt = N'x.[发生日期]';

  -- ① 三条链强制走源采购订单(压过本表日期列,与 .mjs 一致)
  -- ⚠ T-SQL 的 SET 不支持逗号多赋值,必须逐条 SET(2026-10-16 首跑就栽在这)
  IF @tbl = N'sl_recv'
  BEGIN
    SET @join = N'JOIN bd_pu_order d ON d.单据编号 = x.采购订单号';
    SET @dt = N'd.[单据日期]';
  END
  ELSE IF @tbl = N'sl_recv_detail'
  BEGIN
    SET @join = N'JOIN sl_recv s ON s.单据编号 = x.单据编号 JOIN bd_pu_order d ON d.单据编号 = s.采购订单号';
    SET @dt = N'd.[单据日期]';
  END
  ELSE IF @tbl = N'qc_insp'
  BEGIN
    SET @join = N'JOIN sl_recv s ON s.单据编号 = x.暂收单号 JOIN bd_pu_order d ON d.单据编号 = s.采购订单号';
    SET @dt = N'd.[单据日期]';
  END

  -- ③ 本表无日期列时找头表
  IF @dt IS NULL
  BEGIN
    SET @link = CASE WHEN COL_LENGTH(@tbl, N'单据编号') IS NOT NULL THEN N'单据编号'
                     WHEN COL_LENGTH(@tbl, N'单号') IS NOT NULL THEN N'单号'
                     WHEN COL_LENGTH(@tbl, N'来源单号') IS NOT NULL THEN N'来源单号' END;
    SET @head = NULL;
    IF @link IS NOT NULL
    BEGIN
      IF LEFT(@tbl, 3) = N'bl_' AND OBJECT_ID(N'bd_' + SUBSTRING(@tbl, 4, 200)) IS NOT NULL
        SET @head = N'bd_' + SUBSTRING(@tbl, 4, 200);
      ELSE IF RIGHT(@tbl, 7) = N'_detail' AND OBJECT_ID(LEFT(@tbl, LEN(@tbl) - 7)) IS NOT NULL
        SET @head = LEFT(@tbl, LEN(@tbl) - 7);
      ELSE IF RIGHT(@tbl, 5) = N'_head' AND OBJECT_ID(LEFT(@tbl, LEN(@tbl) - 5)) IS NOT NULL
        SET @head = LEFT(@tbl, LEN(@tbl) - 5);
      IF @head IS NOT NULL AND COL_LENGTH(@head, N'单据日期') IS NOT NULL
      BEGIN
        SET @join = N'JOIN ' + QUOTENAME(@head) + N' d ON d.单据编号 = x.' + QUOTENAME(@link);
        SET @dt = N'd.[单据日期]';
      END
    END
  END

  IF @dt IS NOT NULL
  BEGIN
    SET @sql = N'UPDATE x SET x.' + QUOTENAME(@col) + N' = LEFT(x.' + QUOTENAME(@col) + N', LEN(x.' + QUOTENAME(@col) + N') - 8)'
             + N' + CONVERT(varchar(8), ' + @dt + N', 112)'
             + N' FROM ' + QUOTENAME(@tbl) + N' x ' + @join
             + N' WHERE x.' + QUOTENAME(@col) + N' LIKE N''%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'''
             + N'   AND ' + @dt + N' IS NOT NULL'
             + N'   AND RIGHT(x.' + QUOTENAME(@col) + N', 8) <> CONVERT(varchar(8), ' + @dt + N', 112)';
    EXEC sp_executesql @sql;
    SET @n = @@ROWCOUNT;
    IF @n > 0 BEGIN SET @sum = @sum + @n; PRINT N'   ' + @tbl + N'.' + @col + N': ' + CAST(@n AS nvarchar(12)) + N' 行'; END
  END
  FETCH NEXT FROM cur INTO @tbl, @col;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'   §1 合计修正 ' + CAST(@sum AS nvarchar(12)) + N' 行';
GO

PRINT N'== §2 金蝶同步单据:批次号 / 转ERP时间 / 创建时间 → 单据日期 ==';
-- ⚠ 同步单据的制单标记随版本变过:协作机那批 .mjs 只认 N'试运行',而本机实测是 N'jdy-sync'
--   (bd_pu_order 223 单 / bd_so_order 321 单)。只认一个值 ⇒ 规则匹配不到行、自检"假通过"。
--   故两个都认;只动同步来的单据,不碰人工录的单。
DECLARE @t sysname, @s nvarchar(max), @k int, @tot int = 0;
DECLARE @SYNC nvarchar(120) = N'asp_user1 IN (N''试运行'', N''jdy-sync'')';
DECLARE cur2 CURSOR LOCAL FAST_FORWARD FOR
  SELECT name FROM sys.tables
  WHERE name IN (N'bd_pu_order', N'bd_so_order', N'bd_purchase_in', N'bd_sale_out',
                 N'bd_material_out', N'bd_finish_in', N'bd_other_in', N'bd_other_out')
    AND COL_LENGTH(name, N'单据日期') IS NOT NULL AND COL_LENGTH(name, N'asp_user1') IS NOT NULL
  ORDER BY name;
OPEN cur2; FETCH NEXT FROM cur2 INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  -- 批次号(仅该表有这列时)
  IF COL_LENGTH(@t, N'批次号') IS NOT NULL
  BEGIN
    SET @s = N'UPDATE ' + QUOTENAME(@t) + N' SET 批次号 = LEFT(批次号, LEN(批次号) - 8) + CONVERT(varchar(8), 单据日期, 112)'
           + N' WHERE ' + @SYNC + N' AND 批次号 LIKE N''%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'''
           + N'   AND RIGHT(批次号, 8) <> CONVERT(varchar(8), 单据日期, 112)';
    EXEC sp_executesql @s; SET @k = @@ROWCOUNT;
    IF @k > 0 BEGIN SET @tot = @tot + @k; PRINT N'   ' + @t + N'.批次号: ' + CAST(@k AS nvarchar(12)) + N' 行'; END
  END
  -- 转ERP时间(仅该表有这列时)
  -- ⚠ 2026-10-16 合并到开发机后首跑踩坑(本机数据与协作机不同):
  --   bd_purchase_in / bd_sale_out / bd_material_out 的 转ERP时间 是 **nvarchar**,且各有 8 行(10-14 那批
  --   asp_user1=N'试运行')被应用 ERP 推送写成了 JS 日期串 'Oct 14 2026 12:17PM' ⇒
  --   原来无条件的 `CONVERT(date, 转ERP时间)` 直接报「从字符串转换日期和/或时间时,转换失败」,整条迁移中止
  --   (DbSync「执行 0, 失败 1」,后续 §2/§3 与链上后面的脚本都不执行)。
  --   处置:与下方 创建时间 同款**按列型分支** —— 文本列只比前 10 位(不做日期转换),日期列仍用 CONVERT(date,..);
  --   写入表达式**不变**(文本列隐式转成 'yyyy-MM-dd',与本库既有 310 行形态一致)。兼容级别 100 没有 TRY_CONVERT,
  --   所以只能靠列型分流,不能靠 TRY_ 函数兜底。
  IF COL_LENGTH(@t, N'转ERP时间') IS NOT NULL
  BEGIN
    DECLARE @tyErp sysname = (SELECT ty.name FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
                               WHERE c.object_id = OBJECT_ID(@t) AND c.name = N'转ERP时间');
    IF @tyErp IN (N'date', N'datetime', N'datetime2', N'smalldatetime')
      SET @s = N'UPDATE ' + QUOTENAME(@t) + N' SET 转ERP时间 = 单据日期'
             + N' WHERE ' + @SYNC + N' AND 转ERP时间 IS NOT NULL'
             + N'   AND CONVERT(date, 转ERP时间) <> CONVERT(date, 单据日期)';
    ELSE
      SET @s = N'UPDATE ' + QUOTENAME(@t) + N' SET 转ERP时间 = 单据日期'
             + N' WHERE ' + @SYNC + N' AND 转ERP时间 IS NOT NULL'
             + N'   AND LEFT(转ERP时间, 10) <> CONVERT(varchar(10), 单据日期, 120)';
    EXEC sp_executesql @s; SET @k = @@ROWCOUNT;
    IF @k > 0 BEGIN SET @tot = @tot + @k; PRINT N'   ' + @t + N'.转ERP时间: ' + CAST(@k AS nvarchar(12)) + N' 行'; END
  END
  -- 创建时间(按列型:varchar 写 yyyy-MM-dd HH:mm:ss,日期列直接赋日期)
  IF COL_LENGTH(@t, N'创建时间') IS NOT NULL
  BEGIN
    DECLARE @ty sysname = (SELECT ty.name FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
                            WHERE c.object_id = OBJECT_ID(@t) AND c.name = N'创建时间');
    IF @ty IN (N'date', N'datetime', N'datetime2', N'smalldatetime')
      SET @s = N'UPDATE ' + QUOTENAME(@t) + N' SET 创建时间 = 单据日期 WHERE ' + @SYNC
             + N' AND 创建时间 IS NOT NULL AND CONVERT(date, 创建时间) <> CONVERT(date, 单据日期)';
    ELSE
      SET @s = N'UPDATE ' + QUOTENAME(@t) + N' SET 创建时间 = CONVERT(varchar(19), 单据日期, 120) WHERE ' + @SYNC
             + N' AND ISNULL(创建时间, N'''') <> N'''' AND LEFT(创建时间, 10) <> CONVERT(varchar(10), 单据日期, 120)';
    EXEC sp_executesql @s; SET @k = @@ROWCOUNT;
    IF @k > 0 BEGIN SET @tot = @tot + @k; PRINT N'   ' + @t + N'.创建时间: ' + CAST(@k AS nvarchar(12)) + N' 行'; END
  END
  FETCH NEXT FROM cur2 INTO @t;
END
CLOSE cur2; DEALLOCATE cur2;
PRINT N'   §2 合计修正 ' + CAST(@tot AS nvarchar(12)) + N' 行';
GO

PRINT N'== §3 送料暂收单 / 来料检验单 及其留痕 → 源采购订单单据日期 ==';
DECLARE @m int = 0;

-- 单据日期(nvarchar,写 yyyy-MM-dd)
UPDATE x SET 单据日期 = CONVERT(varchar(10), o.单据日期, 120)
  FROM sl_recv x JOIN bd_pu_order o ON o.单据编号 = x.采购订单号
  WHERE ISNULL(x.单据日期, N'') <> CONVERT(varchar(10), o.单据日期, 120);
PRINT N'   sl_recv.单据日期: ' + CAST(@@ROWCOUNT AS nvarchar(12)) + N' 行';

UPDATE x SET 单据日期 = CONVERT(varchar(10), o.单据日期, 120)
  FROM qc_insp x JOIN sl_recv sl ON sl.单据编号 = x.暂收单号 JOIN bd_pu_order o ON o.单据编号 = sl.采购订单号
  WHERE ISNULL(x.单据日期, N'') <> CONVERT(varchar(10), o.单据日期, 120);
PRINT N'   qc_insp.单据日期: ' + CAST(@@ROWCOUNT AS nvarchar(12)) + N' 行';

-- 时间列 → 源订单日期 12:00(字符串列)
UPDATE x SET 审核时间 = CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00'
  FROM sl_recv x JOIN bd_pu_order o ON o.单据编号 = x.采购订单号
  WHERE ISNULL(x.审核时间, N'') <> CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00';
PRINT N'   sl_recv.审核时间: ' + CAST(@@ROWCOUNT AS nvarchar(12)) + N' 行';

UPDATE x SET 审批时间 = CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00'
  FROM sl_recv x JOIN bd_pu_order o ON o.单据编号 = x.采购订单号
  WHERE ISNULL(x.审批时间, N'') <> CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00';
PRINT N'   sl_recv.审批时间: ' + CAST(@@ROWCOUNT AS nvarchar(12)) + N' 行';

UPDATE x SET 审核时间 = CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00'
  FROM qc_insp x JOIN sl_recv sl ON sl.单据编号 = x.暂收单号 JOIN bd_pu_order o ON o.单据编号 = sl.采购订单号
  WHERE ISNULL(x.审核时间, N'') <> CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00';
PRINT N'   qc_insp.审核时间: ' + CAST(@@ROWCOUNT AS nvarchar(12)) + N' 行';

UPDATE x SET 审批时间 = CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00'
  FROM qc_insp x JOIN sl_recv sl ON sl.单据编号 = x.暂收单号 JOIN bd_pu_order o ON o.单据编号 = sl.采购订单号
  WHERE ISNULL(x.审批时间, N'') <> CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00';
PRINT N'   qc_insp.审批时间: ' + CAST(@@ROWCOUNT AS nvarchar(12)) + N' 行';

UPDATE x SET 检验日期 = CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00'
  FROM qc_insp x JOIN sl_recv sl ON sl.单据编号 = x.暂收单号 JOIN bd_pu_order o ON o.单据编号 = sl.采购订单号
  WHERE ISNULL(x.检验日期, N'') <> CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00';
PRINT N'   qc_insp.检验日期: ' + CAST(@@ROWCOUNT AS nvarchar(12)) + N' 行';

-- 时间列 → 源订单日期 12:00(datetime2 列:创建/变更)
UPDATE x SET asp_time1 = DATEADD(hour, 12, CAST(o.单据日期 AS datetime2))
  FROM sl_recv x JOIN bd_pu_order o ON o.单据编号 = x.采购订单号
  WHERE x.asp_time1 IS NOT NULL AND CONVERT(varchar(19), x.asp_time1, 120) <> CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00';
PRINT N'   sl_recv.asp_time1: ' + CAST(@@ROWCOUNT AS nvarchar(12)) + N' 行';

UPDATE x SET asp_time2 = DATEADD(hour, 12, CAST(o.单据日期 AS datetime2))
  FROM sl_recv x JOIN bd_pu_order o ON o.单据编号 = x.采购订单号
  WHERE x.asp_time2 IS NOT NULL AND CONVERT(varchar(19), x.asp_time2, 120) <> CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00';
PRINT N'   sl_recv.asp_time2: ' + CAST(@@ROWCOUNT AS nvarchar(12)) + N' 行';

UPDATE x SET asp_time1 = DATEADD(hour, 12, CAST(o.单据日期 AS datetime2))
  FROM qc_insp x JOIN sl_recv sl ON sl.单据编号 = x.暂收单号 JOIN bd_pu_order o ON o.单据编号 = sl.采购订单号
  WHERE x.asp_time1 IS NOT NULL AND CONVERT(varchar(19), x.asp_time1, 120) <> CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00';
PRINT N'   qc_insp.asp_time1: ' + CAST(@@ROWCOUNT AS nvarchar(12)) + N' 行';

UPDATE x SET asp_time2 = DATEADD(hour, 12, CAST(o.单据日期 AS datetime2))
  FROM qc_insp x JOIN sl_recv sl ON sl.单据编号 = x.暂收单号 JOIN bd_pu_order o ON o.单据编号 = sl.采购订单号
  WHERE x.asp_time2 IS NOT NULL AND CONVERT(varchar(19), x.asp_time2, 120) <> CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00';
PRINT N'   qc_insp.asp_time2: ' + CAST(@@ROWCOUNT AS nvarchar(12)) + N' 行';

-- 留痕 yj_doc_status
UPDATE s SET s.shsj = DATEADD(hour, 12, CAST(o.单据日期 AS datetime2)),
             s.pending_at = DATEADD(hour, 12, CAST(o.单据日期 AS datetime2))
  FROM yj_doc_status s JOIN sl_recv x ON x.单据编号 = s.doc_no JOIN bd_pu_order o ON o.单据编号 = x.采购订单号
  WHERE s.panel_code = 'QC_RECV' AND s.shr IS NOT NULL
    AND (ISNULL(CONVERT(varchar(19), s.shsj, 120), N'') <> CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00'
      OR ISNULL(CONVERT(varchar(19), s.pending_at, 120), N'') <> CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00');
PRINT N'   yj_doc_status[QC_RECV]: ' + CAST(@@ROWCOUNT AS nvarchar(12)) + N' 行';

UPDATE s SET s.shsj = DATEADD(hour, 12, CAST(o.单据日期 AS datetime2)),
             s.pending_at = DATEADD(hour, 12, CAST(o.单据日期 AS datetime2))
  FROM yj_doc_status s JOIN qc_insp i ON i.单据编号 = s.doc_no
       JOIN sl_recv sl ON sl.单据编号 = i.暂收单号 JOIN bd_pu_order o ON o.单据编号 = sl.采购订单号
  WHERE s.panel_code = 'QC_INSP' AND s.shr IS NOT NULL
    AND (ISNULL(CONVERT(varchar(19), s.shsj, 120), N'') <> CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00'
      OR ISNULL(CONVERT(varchar(19), s.pending_at, 120), N'') <> CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00');
PRINT N'   yj_doc_status[QC_INSP]: ' + CAST(@@ROWCOUNT AS nvarchar(12)) + N' 行';
GO

PRINT N'== 自检:仍不一致的行数(应全为 0)==';
DECLARE @bad int = 0;
SELECT @bad = @bad + COUNT(*) FROM inh WHERE 批号 LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' AND 单据日期 IS NOT NULL AND RIGHT(批号, 8) <> CONVERT(varchar(8), 单据日期, 112);
SELECT @bad = @bad + COUNT(*) FROM outh WHERE 批号 LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' AND 单据日期 IS NOT NULL AND RIGHT(批号, 8) <> CONVERT(varchar(8), 单据日期, 112);
SELECT @bad = @bad + COUNT(*) FROM inv_cost_ledger WHERE 批号 LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' AND 单据日期 IS NOT NULL AND RIGHT(批号, 8) <> CONVERT(varchar(8), 单据日期, 112);
SELECT @bad = @bad + COUNT(*) FROM sl_recv x JOIN bd_pu_order o ON o.单据编号 = x.采购订单号
  WHERE (x.批次号 LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' AND RIGHT(x.批次号, 8) <> CONVERT(varchar(8), o.单据日期, 112))
     OR CONVERT(date, x.单据日期) <> CONVERT(date, o.单据日期)
     OR ISNULL(x.审核时间, N'') <> CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00';
SELECT @bad = @bad + COUNT(*) FROM qc_insp x JOIN sl_recv sl ON sl.单据编号 = x.暂收单号 JOIN bd_pu_order o ON o.单据编号 = sl.采购订单号
  WHERE (x.批次号 LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' AND RIGHT(x.批次号, 8) <> CONVERT(varchar(8), o.单据日期, 112))
     OR CONVERT(date, x.单据日期) <> CONVERT(date, o.单据日期)
     OR ISNULL(x.审核时间, N'') <> CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00'
     OR ISNULL(x.检验日期, N'') <> CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00';
SELECT @bad = @bad + COUNT(*) FROM bd_purchase_in WHERE asp_user1 = N'试运行' AND 批次号 LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' AND RIGHT(批次号, 8) <> CONVERT(varchar(8), 单据日期, 112);
SELECT @bad = @bad + COUNT(*) FROM bd_finish_in WHERE asp_user1 = N'试运行' AND 批次号 LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' AND RIGHT(批次号, 8) <> CONVERT(varchar(8), 单据日期, 112);
-- §2 创建时间(同步单据)必须与单据日期同日 —— 之前漏检,导致 §2 的"假通过"没被发现
SELECT @bad = @bad + COUNT(*) FROM bd_pu_order WHERE asp_user1 IN (N'试运行', N'jdy-sync') AND 创建时间 IS NOT NULL AND LEFT(创建时间, 10) <> CONVERT(varchar(10), 单据日期, 120);
SELECT @bad = @bad + COUNT(*) FROM bd_so_order WHERE asp_user1 IN (N'试运行', N'jdy-sync') AND 创建时间 IS NOT NULL AND LEFT(创建时间, 10) <> CONVERT(varchar(10), 单据日期, 120);
SELECT @bad = @bad + COUNT(*) FROM bd_purchase_in WHERE asp_user1 IN (N'试运行', N'jdy-sync') AND 创建时间 IS NOT NULL AND LEFT(创建时间, 10) <> CONVERT(varchar(10), 单据日期, 120);
SELECT @bad = @bad + COUNT(*) FROM bd_finish_in WHERE asp_user1 IN (N'试运行', N'jdy-sync') AND 创建时间 IS NOT NULL AND LEFT(创建时间, 10) <> CONVERT(varchar(10), 单据日期, 120);
PRINT N'   仍不一致合计 = ' + CAST(@bad AS nvarchar(12));
IF @bad > 0 RAISERROR(N'[自检] 仍有不一致行,请检查', 16, 1);
ELSE PRINT N'   [OK] 批号/批次号/日期/时间 已全部与单据日期对齐';
GO
