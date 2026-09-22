/* ============================================================================
   库存报表面板数据库性能修复(2026-09-22)
   ----------------------------------------------------------------------------
   现象:库存报表面板偶发 axios `timeout of 15000ms exceeded`;实测
        `SELECT COUNT(*) FROM v_stock_balance` 65,290 ms(最坏 190 s),
        接口 queryFormDataList STOCK_BALANCE 190,325 ms。

   ★ 根因(与初判不同,已实测确认):**不是视图慢,是坏缓存计划**。
     同一条 SQL、同一个库、同一份数据、同一时刻:
        v_stock_movement  缓存计划 23,466 ms   vs   OPTION (RECOMPILE) 36 ms
        v_stock_balance   缓存计划 65,021 ms   vs   OPTION (RECOMPILE) 42 ms
     差 600 倍。把 RECOMPILE 跑过一轮(顺带把自动统计信息建出来)之后,
     连不带 hint 的原查询也降到 v_stock_movement 5 ms / v_stock_balance 7 ms,
     复刻后端参数化取数(OFFSET ? FETCH NEXT ?)四个面板实测 53/79/55/104 ms。

     为什么会有坏计划:v_stock_movement 是 8 路 UNION 收敛 16 张表,而这
     **16 张表全部 idx_n = 0**(纯堆表,无任何索引)。无索引 → 无可靠统计信息 →
     兼容级别 100 的基数估算把一个 UNION 产物估成 1 行 → 选嵌套循环反复重算 →
     放大约 600 倍。坏计划一旦进计划缓存就**永不重优化**,所以现象稳定在 65 s。
     (同库只有 bs_wh 1 个索引、inv_cost_ledger 2 个索引 —— 恰好就是不慢的两张表。)

   ★ 本脚本做什么:给参与表补索引 + 补显式统计信息,让优化器拿得到真实基数、
   ★ 从而不再选出那个坏计划。**不动任何视图定义、不动任何金额口径、不动软删语义。**

   ★ 配套代码(同提交):QueryService.queryFlat 给这 4 张报表取数加 OPTION (RECOMPILE)。
     必要性:视图**不能带 hint**,而索引只能降低坏计划的概率、不能消除"旧计划残留"
     (数据库还原不会清计划缓存,这正是本次事故最可能的触发器)。这几张报表数据量
     极小(最大 247 行),单次编译成本约 ms 级,用 RECOMPILE 换掉整类事故是划算的。

   ★ 口径自证(未变):SUM(结存金额) = 3,099,936.6387 ≈ 任务单记录值 3,099,936.64 ✓
   ★ 幂等:全部 IF NOT EXISTS 先判后建,可重复执行。自检段输出新建对象清单。
   ========================================================================= */
SET NOCOUNT ON;
GO

/* ── 1. 索引:16 张单据头/行表的 [单据编号](8 路 UNION 的全部 JOIN 键)+ 2 张单列索引 ── */
DECLARE @idx TABLE (seq int IDENTITY, tbl sysname, col sysname, nm sysname, uniq bit, descr nvarchar(400));

-- bl_ = 行表, bd_ = 头表;v_stock_movement 的 8 个分支都是 l JOIN h ON l.单据编号 = h.单据编号
INSERT INTO @idx(tbl,col,nm,uniq,descr) VALUES
 (N'bl_purchase_in',      N'单据编号', N'IX_bl_purchase_in_单据编号',      0, N'采购入库单行→头表连接键(v_stock_movement 第1路);原表为无索引堆表,缺它导致基数估算退化、选出坏计划'),
 (N'bd_purchase_in',      N'单据编号', N'IX_bd_purchase_in_单据编号',      0, N'采购入库单头表连接键(v_stock_movement 第1路)'),
 (N'bl_finish_in',        N'单据编号', N'IX_bl_finish_in_单据编号',        0, N'产成品入库单行→头表连接键(v_stock_movement 第2路)'),
 (N'bd_finish_in',        N'单据编号', N'IX_bd_finish_in_单据编号',        0, N'产成品入库单头表连接键(v_stock_movement 第2路)'),
 (N'bl_other_in',         N'单据编号', N'IX_bl_other_in_单据编号',         0, N'其他入库单行→头表连接键(v_stock_movement 第3路)'),
 (N'bd_other_in',         N'单据编号', N'IX_bd_other_in_单据编号',         0, N'其他入库单头表连接键(v_stock_movement 第3路)'),
 (N'bl_outsource_in',     N'单据编号', N'IX_bl_outsource_in_单据编号',     0, N'委外入库单行→头表连接键(v_stock_movement 第4路)'),
 (N'bd_outsource_in',     N'单据编号', N'IX_bd_outsource_in_单据编号',     0, N'委外入库单头表连接键(v_stock_movement 第4路)'),
 (N'bl_sale_out',         N'单据编号', N'IX_bl_sale_out_单据编号',         0, N'销售出库单行→头表连接键(v_stock_movement 第5路)'),
 (N'bd_sale_out',         N'单据编号', N'IX_bd_sale_out_单据编号',         0, N'销售出库单头表连接键(v_stock_movement 第5路)'),
 (N'bl_material_out',     N'单据编号', N'IX_bl_material_out_单据编号',     0, N'材料出库单行→头表连接键(v_stock_movement 第6路)'),
 (N'bd_material_out',     N'单据编号', N'IX_bd_material_out_单据编号',     0, N'材料出库单头表连接键(v_stock_movement 第6路)'),
 (N'bl_other_out',        N'单据编号', N'IX_bl_other_out_单据编号',        0, N'其他出库单行→头表连接键(v_stock_movement 第7路)'),
 (N'bd_other_out',        N'单据编号', N'IX_bd_other_out_单据编号',        0, N'其他出库单头表连接键(v_stock_movement 第7路)'),
 (N'bl_outsource_issue',  N'单据编号', N'IX_bl_outsource_issue_单据编号',  0, N'委外发料单行→头表连接键(v_stock_movement 第8路)'),
 (N'bd_outsource_issue',  N'单据编号', N'IX_bd_outsource_issue_单据编号',  0, N'委外发料单头表连接键(v_stock_movement 第8路)'),
 -- v_stock_movement 末尾 LEFT JOIN bs_wh ON w.仓库名称 = m.仓库名称(仓库键三级兜底的第 2 级)
 (N'bs_wh',               N'仓库名称', N'IX_bs_wh_仓库名称',               0, N'v_stock_movement 仓库键兜底用 LEFT JOIN 键(按名称找仓库编码);原表只有 外部数据ID 索引'),
 -- STOCK_STATUS 库存状况面板的 line_table(kucun 为 31 行堆表,原无任何索引)
 -- 面板取数 = WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC OFFSET ? FETCH NEXT ?
 -- kucun.id 实测 31 行 / 31 distinct / 0 NULL → 可用 UNIQUE,顺带给优化器最准的基数
 (N'kucun',               N'id',       N'UX_kucun_id',                    1, N'库存状况面板(kucun)ORDER BY id + OFFSET/FETCH 分页键;id 实测唯一,故建唯一索引');

DECLARE @i int = 1, @n int, @tbl sysname, @col sysname, @nm sysname, @uniq bit, @d nvarchar(400), @sql nvarchar(max);
SELECT @n = MAX(seq) FROM @idx;
WHILE @i <= @n
BEGIN
    SELECT @tbl = tbl, @col = col, @nm = nm, @uniq = uniq, @d = descr FROM @idx WHERE seq = @i;
    IF OBJECT_ID(N'dbo.' + @tbl) IS NULL OR COL_LENGTH(N'dbo.' + @tbl, @col) IS NULL
        PRINT N'[跳过] dbo.' + @tbl + N'.' + @col + N' 不存在(本库无此单据类型)';
    ELSE IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.' + @tbl) AND name = @nm)
        PRINT N'[已存在] ' + @nm;
    ELSE
    BEGIN
        SET @sql = N'CREATE ' + CASE WHEN @uniq = 1 THEN N'UNIQUE ' ELSE N'' END
                 + N'NONCLUSTERED INDEX ' + QUOTENAME(@nm) + N' ON dbo.' + QUOTENAME(@tbl)
                 + N'(' + QUOTENAME(@col) + N')';
        EXEC sp_executesql @sql;
        EXEC sp_addextendedproperty N'MS_Description', @d,
             N'SCHEMA', N'dbo', N'TABLE', @tbl, N'INDEX', @nm;
        PRINT N'[新建索引] ' + @nm + N' ON dbo.' + @tbl + N'(' + @col + N')';
    END
    SET @i += 1;
END
GO

/* ── 2. 统计信息:各分支 WHERE 用的过滤列(全扫描,立刻给出准确直方图) ──
   WHERE 条件决定优化器对每个分支输出行数的估算;估错就会把 UNION 产物估成 1 行、
   进而选嵌套循环反复重算。显式 FULLSCAN 统计不依赖"首次查询时才自动创建"的时机,
   数据库还原后也能立刻拿到准确基数(本次事故最可能的触发器正是还原)。          */
DECLARE @st TABLE (seq int IDENTITY, tbl sysname, col sysname, nm sysname, descr nvarchar(400));

INSERT INTO @st(tbl,col,nm,descr) VALUES
 (N'bd_purchase_in',     N'单据状态',  N'ST_bd_purchase_in_单据状态',     N'采购入库单头表审核状态过滤统计(v_stock_movement 分支1 WHERE 单据状态)'),
 (N'bd_purchase_in',     N'单据状态2', N'ST_bd_purchase_in_单据状态2',    N'采购入库单头表第二状态过滤统计(金蝶侧关闭标记,分支1 WHERE)'),
 (N'bd_finish_in',       N'单据状态',  N'ST_bd_finish_in_单据状态',       N'产成品入库单头表审核状态过滤统计(分支2)'),
 (N'bd_other_in',        N'单据状态',  N'ST_bd_other_in_单据状态',        N'其他入库单头表审核状态过滤统计(分支3)'),
 (N'bd_outsource_in',    N'单据状态',  N'ST_bd_outsource_in_单据状态',    N'委外入库单头表审核状态过滤统计(分支4)'),
 (N'bd_sale_out',        N'单据状态',  N'ST_bd_sale_out_单据状态',        N'销售出库单头表审核状态过滤统计(分支5)'),
 (N'bd_sale_out',        N'单据状态2', N'ST_bd_sale_out_单据状态2',       N'销售出库单头表第二状态过滤统计(金蝶侧关闭标记,分支5 WHERE)'),
 (N'bd_material_out',    N'单据状态',  N'ST_bd_material_out_单据状态',    N'材料出库单头表审核状态过滤统计(分支6)'),
 (N'bd_other_out',       N'单据状态',  N'ST_bd_other_out_单据状态',       N'其他出库单头表审核状态过滤统计(分支7)'),
 (N'bd_outsource_issue', N'单据状态',  N'ST_bd_outsource_issue_单据状态', N'委外发料单头表审核状态过滤统计(分支8)'),
 (N'kucun',              N'asp_cancel',N'ST_kucun_asp_cancel',            N'库存状况(kucun)软删过滤统计;面板 WHERE 恒为 ISNULL(asp_cancel,''N'')<>''Y''');

DECLARE @j int = 1, @m int, @stb sysname, @scol sysname, @snm sysname, @sd nvarchar(400), @ssql nvarchar(max);
SELECT @m = MAX(seq) FROM @st;
WHILE @j <= @m
BEGIN
    SELECT @stb = tbl, @scol = col, @snm = nm, @sd = descr FROM @st WHERE seq = @j;
    IF OBJECT_ID(N'dbo.' + @stb) IS NULL OR COL_LENGTH(N'dbo.' + @stb, @scol) IS NULL
        PRINT N'[跳过] dbo.' + @stb + N'.' + @scol + N' 不存在';
    ELSE IF EXISTS (SELECT 1 FROM sys.stats WHERE object_id = OBJECT_ID(N'dbo.' + @stb) AND name = @snm)
        PRINT N'[已存在] ' + @snm;
    ELSE
    BEGIN
        SET @ssql = N'CREATE STATISTICS ' + QUOTENAME(@snm) + N' ON dbo.' + QUOTENAME(@stb)
                  + N'(' + QUOTENAME(@scol) + N') WITH FULLSCAN';
        EXEC sp_executesql @ssql;
        -- 注:统计信息**不支持**扩展属性(sp_addextendedproperty 的 @level2type 词表里
        -- 没有 STATISTICS —— 实测报「指定的参数或选项无效」),故 @sd 只作 PRINT 留痕,
        -- 不上写 MS_Description;建表/建列才必须写(本脚本未新建任何表/列)。
        PRINT N'[新建统计] ' + @snm + N' ON dbo.' + @stb + N'(' + @scol + N') —— ' + @sd;
    END
    SET @j += 1;
END
GO

/* ── 3. 自检:参与表索引覆盖度 + 报表视图耗时(以结果集返回;SqlRunner 不回显 PRINT) ── */
SELECT N'A.参与表索引覆盖' AS k, t.name AS tbl,
       (SELECT COUNT(*) FROM sys.indexes i WHERE i.object_id = t.object_id AND i.type > 0) AS idx_n,
       SUM(p.rows) AS rows_n
  FROM sys.tables t JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
 WHERE t.name IN ('bl_purchase_in','bd_purchase_in','bl_finish_in','bd_finish_in','bl_other_in','bd_other_in',
                  'bl_outsource_in','bd_outsource_in','bl_sale_out','bd_sale_out','bl_material_out','bd_material_out',
                  'bl_other_out','bd_other_out','bl_outsource_issue','bd_outsource_issue','bs_wh','kucun')
 GROUP BY t.object_id, t.name ORDER BY t.name;
GO
SELECT N'B.本次新建对象' AS k, OBJECT_NAME(p.major_id) AS obj, p.name AS prop, CONVERT(nvarchar(200), p.value) AS val
  FROM sys.extended_properties p
 WHERE p.name = N'MS_Description' AND OBJECT_NAME(p.major_id) IN
       ('bl_purchase_in','bd_purchase_in','bl_finish_in','bd_finish_in','bl_other_in','bd_other_in',
        'bl_outsource_in','bd_outsource_in','bl_sale_out','bd_sale_out','bl_material_out','bd_material_out',
        'bl_other_out','bd_other_out','bl_outsource_issue','bd_outsource_issue','bs_wh','kucun')
 ORDER BY 2,3;
GO
DECLARE @t1 datetime2, @t2 datetime2, @t3 datetime2, @c1 int, @c2 int, @c3 int;
SET @t1 = SYSDATETIME(); SELECT @c1 = COUNT(*) FROM v_stock_movement;
SET @t2 = SYSDATETIME(); SELECT @c2 = COUNT(*) FROM v_stock_balance;
SET @t3 = SYSDATETIME(); SELECT @c3 = COUNT(*) FROM v_stock_ledger;
SELECT N'C.视图耗时(ms)' AS k, @c1 AS movement_rows, DATEDIFF(ms,@t1,@t2) AS movement_ms,
       @c2 AS balance_rows, DATEDIFF(ms,@t2,@t3) AS balance_ms,
       @c3 AS ledger_rows, DATEDIFF(ms,@t3,SYSDATETIME()) AS ledger_ms;
GO
SELECT N'D.口径自证 SUM(结存金额)' AS k, COUNT(*) AS rows_n, SUM(结存金额) AS total FROM v_stock_balance;
GO
