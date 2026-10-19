/* ═══════════════════════════════════════════════════════════════════════════════
   rd_insp_plan_detail.控制方法 加宽 nvarchar(100) → nvarchar(2000)
   (2026-10-19 用户报障「服务异常：将截断字符串或二进制数据」)

   【现象】出货检验计划表保存时报错。开 SQL Server Trace Flag 460 后拿到精确定位:
     字符串或二进制数据将在表"HSDZ_MES.dbo.rd_insp_plan_detail",列"控制方法"中被截断。
     截断值:「将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，
              测试流速0.9±0.1L/min，采用次氯酸钠原液（有效氯≥10％）稀释后进行余氯去除率的
              加标试验，余氯浓度控制在2.0」—— 110+ 字符,而列只有 100。

   【为什么是"孤例错配"而不是"数据太长"】同库同类「方法」列的口径是 1000~2000:
     rd_dom_test_detail.方法         = nvarchar(1000)
     rd_drop_prec_head.测试方法      = nvarchar(2000)
     rd_antibact_head.测试方法       = nvarchar(1000)
     rd_mineral_head.测试方法        = nvarchar(1000)
     rd_insp_plan_detail.控制标准及要求 = nvarchar(2000)   ← 同表兄弟列
   只有 rd_insp_plan_detail.控制方法 = nvarchar(100) —— 建表时按短文本给了,与纸面上
   「检验方法」这一列的实际用法(整段操作步骤)不符。

   【改法】加宽到 nvarchar(2000),与 rd_drop_prec_head.测试方法 及同表「控制标准及要求」对齐。
     只放宽不收紧(幂等:当前已 ≥2000 则跳过);NULL 性保持不变。
     不影响索引/约束(该列无索引依赖)。

   【回退】ALTER TABLE dbo.rd_insp_plan_detail ALTER COLUMN 控制方法 nvarchar(100) NULL;
     ⚠ 回退会再次截断已存的超长行 —— 除非确认没有 >100 的值,否则不要回退。
   ═══════════════════════════════════════════════════════════════════════════════ */
SET NOCOUNT ON;
PRINT N'== rd_insp_plan_detail.控制方法 加宽 ==';

DECLARE @cur int = (
    SELECT c.max_length / 2
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID(N'dbo.rd_insp_plan_detail')
      AND c.name = N'控制方法'
      AND TYPE_NAME(c.user_type_id) = N'nvarchar'
);

IF @cur IS NULL
BEGIN
    RAISERROR(N'[FAIL] 找不到 dbo.rd_insp_plan_detail.控制方法(nvarchar),拒绝继续', 16, 1);
    RETURN;
END

PRINT N'  现状: nvarchar(' + CAST(@cur AS nvarchar(10)) + N')';

IF @cur >= 2000
BEGIN
    PRINT N'  [SKIP] 已经是 nvarchar(' + CAST(@cur AS nvarchar(10)) + N'),无需加宽';
END
ELSE
BEGIN
    ALTER TABLE dbo.rd_insp_plan_detail ALTER COLUMN 控制方法 nvarchar(2000) NULL;
    PRINT N'  [OK] 已加宽到 nvarchar(2000)';
END

/* ── 自检:必须已是 2000 ── */
DECLARE @now int = (
    SELECT c.max_length / 2
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID(N'dbo.rd_insp_plan_detail')
      AND c.name = N'控制方法'
);
IF @now <> 2000
BEGIN
    DECLARE @msg nvarchar(200) = N'[FAIL] 加宽后长度应为 2000,实际 ' + CAST(@now AS nvarchar(10));
    RAISERROR(@msg, 16, 1);
    RETURN;
END
PRINT N'  [自检] 控制方法 = nvarchar(' + CAST(@now AS nvarchar(10)) + N') ✓';
PRINT N'== 完成 ==';
