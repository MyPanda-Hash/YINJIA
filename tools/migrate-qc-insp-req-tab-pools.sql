-- migrate-qc-insp-req-tab-pools.sql — 来料检验要求:扩展池改为「每张表(页签)各 20 个备用列」
--
-- 用户口径(2026-10-04 第三轮):「字段的扩展池应该是每个表 20 个」——
--   来料检验要求一张表一个页签,8 个页签就该有 8 × 20 = 160 个扩展位,而不是 8 张表共用 20 个。
--
-- 落地:qc_insp_req 备用列补齐到 备用1..备用160,按**页签顺序**分段(每段 20 个):
--   ① 折叠棉      备用1..20      ⑤ PP管        备用81..100
--   ② 垫片        备用21..40     ⑥ 端盖        备用101..120
--   ③ 无纺布      备用41..60     ⑦ PP棉        备用121..140
--   ④ 网套        备用61..80     ⑧ 自定义检验要求 备用141..160
--   段序必须与 yj_field.物料类别 词表顺序(= 前端 qcInspReqConfig.js 页签顺序)一致 —— 三者一起改。
--
-- 与《动态字段扩展-备用列池-V1.0.md》的关系:该规格的池是「每物理表 20 列,池耗尽扩列」;
--   本表是**分页签列存**的特例(mode=archive 的宽表当多张表用),故按页签分段扩位 —— 同一安全模式(只加列,运行时零 DDL)。
--
-- 幂等:列已存在跳过;注明每次重写(随绑定状态);已绑定字段若落在别的页签区间则**搬列**(连同数据)。
-- 两账套都要执行:
--   正式 java -cp lib\mssql-jdbc.jar DbSync.java run migrate-qc-insp-req-tab-pools.sql
--   测试 YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\mssql-jdbc.jar DbSync.java run migrate-qc-insp-req-tab-pools.sql
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库时不得被切走)
GO

-- ═════════════ 1. 补齐 备用1..备用160 ═════════════
DECLARE @i int = 1, @sql nvarchar(300);
WHILE @i <= 160
BEGIN
  SET @sql = N'IF COL_LENGTH(''qc_insp_req'', N''备用' + CAST(@i AS nvarchar(3)) + N''') IS NULL '
           + N'ALTER TABLE qc_insp_req ADD [备用' + CAST(@i AS nvarchar(3)) + N'] nvarchar(500) NULL;';
  EXEC sp_executesql @sql;
  SET @i = @i + 1;
END
PRINT N'[OK] 备用列已补齐至 备用160';
GO

-- ═════════════ 2. 列级中文注明(页签扩展池 序号/20;已绑定的按其标签写) ═════════════
DECLARE @j int = 1, @c nvarchar(20), @tab nvarchar(50), @desc nvarchar(300), @bound nvarchar(200);
DECLARE @tabs TABLE (idx int PRIMARY KEY, tab nvarchar(50));
INSERT INTO @tabs VALUES (1,N'折叠棉'),(2,N'垫片'),(3,N'无纺布'),(4,N'网套'),
                         (5,N'PP管'),(6,N'端盖'),(7,N'PP棉'),(8,N'自定义检验要求');
WHILE @j <= 160
BEGIN
  SET @c = N'备用' + CAST(@j AS nvarchar(3));
  SET @tab = (SELECT tab FROM @tabs WHERE idx = ((@j - 1) / 20) + 1);
  -- 已绑定的列(有 yj_field 行的)保留"绑定"字样的注明,其余写"未绑定"
  SET @bound = (SELECT TOP 1 label FROM yj_field WHERE panel_code = 'QC_INSP_REQ' AND col_name = @c);
  SET @desc = CASE WHEN @bound IS NULL
                   THEN @tab + N'扩展池 ' + CAST(((@j - 1) % 20) + 1 AS nvarchar(3)) + N'/20(未绑定)'
                   ELSE @bound + N'(动态字段,' + @tab + N',绑定' + @c + N')' END;
  IF EXISTS (SELECT 1 FROM sys.extended_properties ep
             WHERE ep.major_id = OBJECT_ID('qc_insp_req')
               AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('qc_insp_req'), @c, 'ColumnId')
               AND ep.name = 'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @desc, N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_req', N'COLUMN', @c;
  ELSE
    EXEC sp_addextendedproperty N'MS_Description', @desc, N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_req', N'COLUMN', @c;
  SET @j = @j + 1;
END
PRINT N'[OK] 160 个备用列的注明已按页签分段写好';
GO

-- ═════════════ 3. 已绑定的动态字段:落到本页签区间(越界则搬列,数据一起搬) ═════════════
-- 背景:改动前所有动态字段共用 备用1..20,可能落在别的页签区间(如"平整度"属自定义检验要求却占 备用1)。
-- 本段把它们迁到各自页签的区间里,保证"每张表 20 个"的账目对得上。
-- ⚠ GO 分批 ⇒ 表变量声明不跨批,本批必须重新声明 @tabs。
DECLARE @tabs TABLE (idx int PRIMARY KEY, tab nvarchar(50));
INSERT INTO @tabs VALUES (1,N'折叠棉'),(2,N'垫片'),(3,N'无纺布'),(4,N'网套'),
                         (5,N'PP管'),(6,N'端盖'),(7,N'PP棉'),(8,N'自定义检验要求');
DECLARE @moved int = 0;
DECLARE @sql nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT f.id, f.label, f.col_name, ISNULL(f.tab_key, N'自定义检验要求')
    FROM yj_field f
   WHERE f.panel_code = 'QC_INSP_REQ' AND f.col_name LIKE N'备用%'
   ORDER BY f.seq, f.id;
DECLARE @fid int, @label nvarchar(200), @col nvarchar(20), @ftab nvarchar(50);
DECLARE @start int, @end int, @idx int, @num int, @target nvarchar(20);
OPEN cur;
FETCH NEXT FROM cur INTO @fid, @label, @col, @ftab;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @idx = (SELECT idx FROM @tabs WHERE tab = @ftab);
  IF @idx IS NOT NULL
  BEGIN
    SET @start = (@idx - 1) * 20 + 1;
    SET @end = @idx * 20;
    SET @num = TRY_CAST(REPLACE(@col, N'备用', N'') AS int);
    IF @num IS NULL OR @num < @start OR @num > @end
    BEGIN
      -- 在本页签区间里找第一个没被本面板任何字段占用的列
      SET @target = NULL;
      SELECT TOP 1 @target = N'备用' + CAST(n AS nvarchar(3))
        FROM (SELECT TOP (@end - @start + 1) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) + @start - 1 AS n
                FROM sys.all_objects) t
       WHERE NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_INSP_REQ' AND col_name = N'备用' + CAST(n AS nvarchar(3)))
       ORDER BY n;
      IF @target IS NOT NULL
      BEGIN
        SET @sql = N'UPDATE qc_insp_req SET [' + @target + N'] = [' + @col + N'], [' + @col + N'] = NULL '
                 + N'WHERE [' + @col + N'] IS NOT NULL;';
        EXEC sp_executesql @sql;
        UPDATE yj_field SET col_name = @target WHERE id = @fid;
        SET @moved = @moved + 1;
        PRINT N'  [搬列] ' + @label + N':' + @col + N' → ' + @target + N'(页签 ' + @ftab + N')';
      END
      ELSE PRINT N'  [跳过] ' + @label + N':页签 ' + @ftab + N' 的 20 个扩展位已满';
    END
  END
  FETCH NEXT FROM cur INTO @fid, @label, @col, @ftab;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[OK] 搬列 ' + CAST(@moved AS nvarchar(10)) + N' 个动态字段';
GO

-- ═════════════ 自检 ═════════════
SELECT N'备用列总数' AS k, COUNT(*) AS n FROM sys.columns
 WHERE object_id = OBJECT_ID('qc_insp_req') AND name LIKE N'备用%';
SELECT N'qc_insp_req 总列数' AS k, COUNT(*) AS n FROM sys.columns WHERE object_id = OBJECT_ID('qc_insp_req');
SELECT N'已绑定动态字段' AS k, f.label, f.col_name, ISNULL(f.tab_key, N'(未标)') AS 页签,
       (TRY_CAST(REPLACE(f.col_name, N'备用', N'') AS int) - 1) / 20 + 1 AS 列所在段
  FROM yj_field f WHERE f.panel_code = N'QC_INSP_REQ' AND f.col_name LIKE N'备用%' ORDER BY f.seq, f.id;
SELECT N'分段占用(段=页签顺序)' AS k, ((TRY_CAST(REPLACE(col_name, N'备用', N'') AS int) - 1) / 20) + 1 AS 段,
       COUNT(*) AS 已绑 FROM yj_field WHERE panel_code = N'QC_INSP_REQ' AND col_name LIKE N'备用%' GROUP BY ((TRY_CAST(REPLACE(col_name, N'备用', N'') AS int) - 1) / 20) + 1;
GO
