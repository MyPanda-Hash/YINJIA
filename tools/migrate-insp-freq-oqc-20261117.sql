/* ============================================================
   migrate-insp-freq-oqc-20261117.sql
   出货检验计划表(RD_INSP_PLAN)「检查频率」改成本面板专属标准库(2026-11-17 用户口径)

   用户原话:「出货检验计划表下拉框的数据过多,修改为下面的修改,
              1%/一个生产批次、1PCS/一个生产批次、1PCS/一个工单、型式检验。下拉款中内容可自行增加。」

   为什么**另开一个库 INSP_FREQ_OQC**,而不是把共用库 INSP_FREQ 砍短:
     · INSP_FREQ 是**四张检验单共用**的(RD_INSP_PLAN / QC_ASM_INSP / QC_FIRST_INSP / QC_PROC_INSP),
       见 migrate-insp-freq-stdlib-20261019.sql;库里 16 条里「每2小时1PCS / 每班1PCS / 每班2PCS」
       是**制程巡检口径** —— 实测 QC_PROC_INSP 明细已有 2502 行用的是「每2小时」,
       为出货口径把共用库砍掉,等于把制程/首件检验的单选也一起砍了(那是另一套业务口径)。
     · 出货检验本来就是**抽样方案口径**(1%/批次、1PCS/批次、1PCS/工单、型式检验),与巡检不同源。

   做法:
     ① yj_std_lib 铺 INSP_FREQ_OQC 种子 = 用户点名的 4 条(按用户顺序)+ 型式检验半年/一年一次 = 6 条;
        用户说「下拉款中内容可自行增加」⇒ 面板列头的 ⌄「标准库维护」随时可增删改,本脚本只定初始集。
     ② RD_INSP_PLAN 的「检测频率」字段 dict_sql 由 INSP_FREQ 改指 INSP_FREQ_OQC
        (物理列名、数据键、已录入单据的文本一律不动 —— 改的只是"候选下拉来自哪个库")。

   幂等:种子按 lib+item 判重(含已作废则重新启用不重复插);字段 UPDATE 带 panel_code+col_name
         窄条件 + 行数守卫(应恰为 1 行)。
   两个账套都要执行(先 HSDZ_MES,后 HSDZ_MES_TEST)。
   ============================================================ */
SET NOCOUNT ON;
GO

/* ---------- 1. 标准库种子(库编码 INSP_FREQ_OQC) ---------- */
DECLARE @lib nvarchar(50) = N'INSP_FREQ_OQC';
DECLARE @items TABLE (content nvarchar(200), seq int);
INSERT INTO @items (content, seq) VALUES
 (N'1%/一个生产批次', 10),
 (N'1PCS/一个生产批次', 20),
 (N'1PCS/一个工单', 30),
 (N'型式检验', 40),
 (N'型式检验半年一次', 50),
 (N'型式检验一年一次', 60);

INSERT INTO yj_std_lib (lib_code, item_code, content, enabled, seq, asp_user1, asp_time1)
SELECT @lib, i.content, i.content, 1, i.seq, N'migration', SYSDATETIME()
FROM @items i
WHERE NOT EXISTS (SELECT 1 FROM yj_std_lib x
                  WHERE x.lib_code = @lib AND x.item_code = i.content
                    AND ISNULL(x.asp_cancel, N'N') <> N'Y');
PRINT N'[OK] INSP_FREQ_OQC 种子:' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 条新增(应为 6 或 0)';
GO

/* ---------- 2. 出货检验计划表的检查频率字段改指新库 ---------- */
DECLARE @n int;
UPDATE yj_field
   SET data_type = N'标准库', dict_sql = N'INSP_FREQ_OQC'
 WHERE panel_code = N'RD_INSP_PLAN'
   AND col_name = N'检测频率';
SET @n = @@ROWCOUNT;
PRINT N'[OK] RD_INSP_PLAN.检测频率 改指 INSP_FREQ_OQC:' + CAST(@n AS nvarchar(4)) + N' 行(应为 1)';
IF @n <> 1 PRINT N'[WARN] 行数不是 1,请核对 yj_field(panel_code=RD_INSP_PLAN, col_name=检测频率)';
GO

/* ---------- 3. 自检 ---------- */
DECLARE @f int = (SELECT COUNT(*) FROM yj_field
                   WHERE panel_code = N'RD_INSP_PLAN' AND col_name = N'检测频率'
                     AND data_type = N'标准库' AND dict_sql = N'INSP_FREQ_OQC');
DECLARE @s int = (SELECT COUNT(*) FROM yj_std_lib
                   WHERE lib_code = N'INSP_FREQ_OQC' AND ISNULL(asp_cancel, N'N') <> N'Y' AND enabled = 1);
DECLARE @keep int = (SELECT COUNT(*) FROM yj_std_lib
                      WHERE lib_code = N'INSP_FREQ' AND ISNULL(asp_cancel, N'N') <> N'Y' AND enabled = 1);
IF @f = 1 AND @s >= 6 AND @keep >= 16
  PRINT N'[OK] 自检通过:RD_INSP_PLAN 字段 1/1 指向 INSP_FREQ_OQC;新库启用条目 '
        + CAST(@s AS nvarchar(3)) + N' 条;共用库 INSP_FREQ 仍保留 ' + CAST(@keep AS nvarchar(4)) + N' 条(制程/首件/组装成品照旧)';
ELSE
  PRINT N'[WARN] 自检异常:字段 ' + CAST(@f AS nvarchar(3)) + N'/1、新库 ' + CAST(@s AS nvarchar(3))
        + N' 条、共用库 ' + CAST(@keep AS nvarchar(4)) + N' 条';
GO
