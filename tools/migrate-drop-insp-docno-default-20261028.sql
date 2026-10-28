/* ============================================================
   migrate-drop-insp-docno-default-20261028.sql
   移除 rd_insp_plan_head.文档编号 的数据库默认值 N'YJ-RD001'

   【为什么删】用户口径(2026-10-28,方案 A):
     「这个默认的编号去掉，只保留背景提示词：请填写编号」

   实测事实(正式账套 HSDZ_MES):
     · 四个受控文件**都已经在自动发单据号** —— 规格书 SD-2026-10-0002 /
       成型工艺清单 MP-2026-10-0004 / 组装工艺清单 AP-2026-10-0003 /
       出货检验计划表 **IP-2026-10-0015**(这个号一直在正常生成);
     · 问题只在纸面:该面板的编号格绑的是 yj_field.文档编号,而
       rd_insp_plan_head.文档编号 上挂着 DF_insp_docno DEFAULT N'YJ-RD001'
       ⇒ 全部 10 张单都是同一个 'YJ-RD001',屏幕上看着像"固定编号";
     · 它跟单据号(IP-…)毫无关系,是模板时代留下的固定串。

   【改法】
     ① 本脚本:删掉默认约束(幂等);
     ② 配套迁移 migrate-insp-docno-unregister-20261028.sql:
        yj_field 不再把「文档编号」登记成 RD_INSP_PLAN 的 header 字段
        ⇒ 前端 docNoKeyOf 落到「单据编号」,与成型/组装/规格书三张一致。

   【不动物理列】rd_insp_plan_head.文档编号 保留 —— 历史值(含 'YJ-RD001')
   不丢、可随时查;只是不再上纸、不再有默认值。删除列是不可逆操作,
   本任务没有授权也没有必要。

   【幂等】先查 sys.default_constraints 存在才删,可重复执行。
   【两账套】HSDZ_MES 与 HSDZ_MES_TEST 都执行(DbSync 会按清单跑)。
   ============================================================ */

SET NOCOUNT ON;

PRINT '=== 迁移前:rd_insp_plan_head 上的默认约束 ===';
SELECT dc.name AS 约束名, c.name AS 列名, dc.definition AS 默认值
FROM sys.default_constraints dc
JOIN sys.columns c
  ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID(N'dbo.rd_insp_plan_head');

/* ── 删约束(幂等:按名字查,存在才删) ── */
IF EXISTS (
    SELECT 1 FROM sys.default_constraints
     WHERE name = N'DF_insp_docno'
       AND parent_object_id = OBJECT_ID(N'dbo.rd_insp_plan_head')
)
BEGIN
    ALTER TABLE dbo.rd_insp_plan_head DROP CONSTRAINT DF_insp_docno;
    PRINT '已删除默认约束 DF_insp_docno';
END
ELSE
BEGIN
    PRINT '默认约束 DF_insp_docno 不存在(已删过或本库从未创建),跳过';
END
GO

/* ── 兜底:约束名不同但"文档编号列上还挂着默认值"的情况也一并清掉 ──
   为什么按列找而不是只按名字:不同账套/不同年代的建表脚本可能给了别的约束名,
   只按 DF_insp_docno 找会漏。这里逐个删,仍然幂等。 */
DECLARE @cname sysname, @cnt int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT dc.name
      FROM sys.default_constraints dc
     WHERE dc.parent_object_id = OBJECT_ID(N'dbo.rd_insp_plan_head')
       AND dc.parent_column_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.rd_insp_plan_head'), N'文档编号', 'ColumnId');
OPEN cur;
FETCH NEXT FROM cur INTO @cname;
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC('ALTER TABLE dbo.rd_insp_plan_head DROP CONSTRAINT [' + @cname + ']');
    PRINT '已删除默认约束(按列兜底): ' + @cname;
    SET @cnt = @cnt + 1;
    FETCH NEXT FROM cur INTO @cname;
END
CLOSE cur;
DEALLOCATE cur;
PRINT '按列兜底共删除: ' + CAST(@cnt AS varchar(10));
GO

/* ── 自检:该列不再有默认约束 ── */
PRINT '=== 自检:文档编号列剩余默认约束(应为 0 行) ===';
SELECT dc.name AS 约束名, dc.definition AS 默认值
FROM sys.default_constraints dc
WHERE dc.parent_object_id = OBJECT_ID(N'dbo.rd_insp_plan_head')
  AND dc.parent_column_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.rd_insp_plan_head'), N'文档编号', 'ColumnId');

SELECT CASE WHEN COUNT(*) = 0 THEN N'[PASS] 文档编号列已无默认约束'
            ELSE N'[FAIL] 仍有默认约束,请检查上面的约束名'
       END AS 自检结论
FROM sys.default_constraints dc
WHERE dc.parent_object_id = OBJECT_ID(N'dbo.rd_insp_plan_head')
  AND dc.parent_column_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.rd_insp_plan_head'), N'文档编号', 'ColumnId');

PRINT '=== 确认物理列仍在(历史值不丢) ===';
SELECT CASE WHEN COUNT(*) = 1 THEN N'[PASS] rd_insp_plan_head.文档编号 物理列保留'
            ELSE N'[FAIL] 物理列不见了 —— 本脚本不该删列,请排查'
       END AS 列存在自检
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = N'rd_insp_plan_head' AND COLUMN_NAME = N'文档编号';
GO
