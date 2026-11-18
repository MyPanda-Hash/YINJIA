/* ============================================================================
 * migrate-xsinter-formula-fix-20261118.sql
 * X烧结配方工艺管控清单：存量配方表的「小数位」与「空行」修正
 * ----------------------------------------------------------------------------
 * 用户 2026-11-18 报障（截图）：
 *   ① 单支含量g 显示 25.851768 / 33.719698 这种 6 位小数（列窄还被折成两行）；
 *   ② 「写道在配方计算回填的时候没有数据的行自己去掉」，但纸面上仍有 4~10 行空行。
 *
 * 查证结论（证据见部署台账）：
 *   · 小数位 = **旧数据**：`fmt()` 的 2 位收敛是 2026-11-17 15:45（commit 6fdc69ecb）才加的，
 *     此前 `piece` 落到兜底分支 `Math.round(n*1e6)/1e6` ⇒ 6 位。
 *     受影响单据创建时间都早于 15:45（XS-2026-11-0001 11-10、XS-2026-11-0003 11-17 14:31）。
 *     代码侧已修，本次只**订正存量**。
 *   · 空行 = **现行行为**（`blankRows:10` 默认铺 10 行 + 回填把全部行写入），
 *     代码侧已改为「回填只写有物料的行」，本次把存量里的全空行删掉。
 *
 * 只动 `[表区]='配方表'`，修订记录不碰；两账套都执行；幂等。
 * ========================================================================== */

SET NOCOUNT ON;

IF OBJECT_ID('rd_x_sinter_detail') IS NULL
    RAISERROR(N'[xsinter-fix] 缺 rd_x_sinter_detail', 16, 1);
GO

/* ---------- ① 数值列取 2 位小数（只处理小数位 > 2 的行） ---------- */
DECLARE @cols TABLE (name sysname PRIMARY KEY);
INSERT INTO @cols VALUES (N'单支含量g'), (N'添加比例'), (N'设计添加量');

DECLARE @c sysname, @sql nvarchar(max), @n int, @rounded int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM @cols;
OPEN cur;
FETCH NEXT FROM cur INTO @c;
WHILE @@FETCH_STATUS = 0
BEGIN
    -- 值以 nvarchar 存（元数据驱动的列），只对「能转成数字且小数位 >2」的行做四舍五入，
    -- 保留不到 2 位的原样（'45' 不变成 '45.00'，与前端 fmt 的"去尾零"一致）。
    SET @sql = N'UPDATE d SET d.' + QUOTENAME(@c) + N' =
                    CONVERT(nvarchar(50), CAST(ROUND(CAST(d.' + QUOTENAME(@c) + N' AS decimal(18,6)), 2) AS decimal(18,2)))
                  FROM rd_x_sinter_detail d
                  WHERE d.[表区] = N''配方表''
                    AND ISNULL(d.' + QUOTENAME(@c) + N', N'''') <> N''''
                    AND TRY_CAST(d.' + QUOTENAME(@c) + N' AS decimal(18,6)) IS NOT NULL
                    AND CHARINDEX(N''.'', d.' + QUOTENAME(@c) + N') > 0
                    AND LEN(REPLACE(RTRIM(d.' + QUOTENAME(@c) + N'), N''0'', N'''')) > 0
                    AND LEN(SUBSTRING(d.' + QUOTENAME(@c) + N', CHARINDEX(N''.'', d.' + QUOTENAME(@c) + N') + 1, 50)) > 2;';
    EXEC sp_executesql @sql;
    SET @n = @@ROWCOUNT; SET @rounded = @rounded + @n;
    IF @n > 0 PRINT N'[xsinter-fix] ' + @c + N' 取 2 位 = ' + CAST(@n AS nvarchar(10));
    FETCH NEXT FROM cur INTO @c;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[xsinter-fix] 小数位订正合计 = ' + CAST(@rounded AS nvarchar(10));
GO

/* ---------- ② 删除**全空**的配方行（物料编号与物料名称都为空） ---------- */
DELETE d
  FROM rd_x_sinter_detail d
 WHERE d.[表区] = N'配方表'
   AND ISNULL(d.[物料编号], N'') = N''
   AND ISNULL(d.[物料名称], N'') = N'';
PRINT N'[xsinter-fix] 删除全空配方行 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ③ 自检：不该再有 >2 位小数 / 全空行 ---------- */
DECLARE @bad int = 0;
SELECT @bad = COUNT(*) FROM rd_x_sinter_detail
 WHERE [表区] = N'配方表' AND ISNULL([物料编号],N'') = N'' AND ISNULL([物料名称],N'') = N'';
IF @bad > 0 RAISERROR(N'[xsinter-fix] 自检失败：仍有全空配方行', 16, 1);

SELECT @bad = COUNT(*) FROM rd_x_sinter_detail
 WHERE [表区] = N'配方表' AND ISNULL([单支含量g],N'') LIKE N'%.[0-9][0-9][0-9]%';
IF @bad > 0 RAISERROR(N'[xsinter-fix] 自检失败：仍有 >2 位小数的单支含量', 16, 1);
PRINT N'[xsinter-fix] 自检通过。';
GO
