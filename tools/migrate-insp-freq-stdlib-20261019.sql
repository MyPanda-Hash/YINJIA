/* ============================================================
   migrate-insp-freq-stdlib-20261019.sql
   「检查频率」改为下拉标准库(2026-10-19 用户口径)

   用户原话:「出货检验计划表的检查频率字段的内容填写改为一个下拉标准库,
              可以通过标准库维护这个字段的下拉填写内容」

   做法(复用现役「标准库」机制,不新造概念):
     · yj_field.data_type = '标准库' + dict_sql = 库编码 'INSP_FREQ'
       —— PanelConfigService.stdLibOptions(dictSql) 会把 yj_std_lib 里该库的启用条目当下拉候选下发;
     · yj_std_lib 铺 INSP_FREQ 种子(把各面板原来的硬编码三项 + 库里实际用过的写法一起收进来);
     · 前端 RecordSheetPanels 的列配置加 type:'select', stdLib:'INSP_FREQ',表头 ⌄ 可增删改条目
       (StdLibManager 复用,改库只影响以后的填写,已录入单据文本原样不动)。

   影响字段(4 个,label 分别是「检查频率」/「检测频率」,物理列同名):
     RD_INSP_PLAN(出货检验计划表) / QC_ASM_INSP(组装成品检验单) /
     QC_FIRST_INSP(首件检验单) / QC_PROC_INSP(成型检验单)

   幂等:种子按 lib+item 判重;字段 UPDATE 带窄条件 + 只看这 4 个面板(行数守卫打印)。
   两个账套都要执行(先 HSDZ_MES,后 HSDZ_MES_TEST)。
   ============================================================ */
SET NOCOUNT ON;
GO

/* ---------- 1. 标准库种子(库编码 INSP_FREQ) ---------- */
DECLARE @lib nvarchar(50) = N'INSP_FREQ';
DECLARE @items TABLE (content nvarchar(200), seq int);
INSERT INTO @items (content, seq) VALUES
 (N'每批次', 10),
 (N'1PCS/一个生产批次', 20),
 (N'2PCS/一个生产批次', 30),
 (N'生产量*1%', 40),
 (N'每2小时1PCS', 50),
 (N'每班1PCS', 60),
 (N'每班2PCS', 70),
 (N'每天1PCS', 80),
 (N'每周1PCS', 90),
 (N'每月1PCS', 100),
 (N'每季度1PCS', 110),
 (N'型式检验', 120),
 (N'型式检验半年一次', 130),
 (N'型式检验一年一次', 140),
 (N'全检', 150),
 (N'免检', 160);

INSERT INTO yj_std_lib (lib_code, item_code, content, enabled, seq, asp_user1, asp_time1)
SELECT @lib, i.content, i.content, 1, i.seq, N'migration', SYSDATETIME()
FROM @items i
WHERE NOT EXISTS (SELECT 1 FROM yj_std_lib x
                  WHERE x.lib_code = @lib AND x.item_code = i.content
                    AND ISNULL(x.asp_cancel, N'N') <> N'Y');
PRINT N'[OK] INSP_FREQ 种子:' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 条新增';
GO

/* ---------- 2. 四个面板的检查频率字段改成「标准库」下拉 ---------- */
DECLARE @n int;
UPDATE yj_field
   SET data_type = N'标准库', dict_sql = N'INSP_FREQ'
 WHERE panel_code IN (N'RD_INSP_PLAN', N'QC_ASM_INSP', N'QC_FIRST_INSP', N'QC_PROC_INSP')
   AND col_name IN (N'检查频率', N'检测频率');
SET @n = @@ROWCOUNT;
PRINT N'[OK] 检查频率字段改为标准库下拉:' + CAST(@n AS nvarchar(4)) + N' 行(应为 4)';
IF @n = 0 PRINT N'[WARN] 未更新任何字段,请核对 panel_code / col_name';
GO

/* ---------- 3. 自检 ---------- */
DECLARE @f int = (SELECT COUNT(*) FROM yj_field
                   WHERE panel_code IN (N'RD_INSP_PLAN', N'QC_ASM_INSP', N'QC_FIRST_INSP', N'QC_PROC_INSP')
                     AND col_name IN (N'检查频率', N'检测频率')
                     AND data_type = N'标准库' AND dict_sql = N'INSP_FREQ');
DECLARE @s int = (SELECT COUNT(*) FROM yj_std_lib WHERE lib_code = N'INSP_FREQ' AND ISNULL(asp_cancel, N'N') <> N'Y');
IF @f = 4 AND @s >= 16
  PRINT N'[OK] 自检通过:字段 ' + CAST(@f AS nvarchar(3)) + N'/4、标准库条目 ' + CAST(@s AS nvarchar(4)) + N' 条';
ELSE
  PRINT N'[WARN] 自检异常:字段 ' + CAST(@f AS nvarchar(3)) + N'/4、标准库条目 ' + CAST(@s AS nvarchar(4)) + N' 条';
GO
