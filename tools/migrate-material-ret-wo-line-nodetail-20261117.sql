/* ============================================================
   migrate-material-ret-wo-line-nodetail-20261117.sql — 2026-11-17
   生产退料单(MATERIAL_RET)报错修复:「工单行号」不能再声明成**明细(行表)**字段

   现象(用户 2026-11-17 报障,两个账套同样报):
       打开「WMS管理 → 库存核算 → 生产退料单」整页 500,
       `SQL state [S0001]; error code [207]; 列名 '工单行号' 无效`
       SQL: SELECT t.id AS __id, t.[单据编号] AS __no, t.[加工单号] AS [工单号],
                   t.[工单行号] AS [工单行号], ... FROM bl_material_ret t

   根因(元数据声明与物理表不一致):
       yj_field[MATERIAL_RET.工单行号].place = `query,header,detail`
       ⇒ 取数时既进**头表**(bd_material_ret)、也进**行表**(bl_material_ret)的 SELECT 列;
       而物理列 `工单行号` 只存在于头表:
         · bd_material_ret.工单行号  int              ← 存在(COL_LENGTH=4)
         · bl_material_ret.工单行号  不存在            ← 本次报错点
         · bl_material_out.工单行号  也不存在(退料行表是照它克隆的)
       顺序上也讲得通:手机扫码退料(MobilePickController.submitReturn)把
       「工单号(物理列 加工单号)+ 工单行号」写在**单据头**,一行退料不单独持有工单行号
       ⇒ 这个字段本来就不该出现在行表上。

   处置(纯元数据,零改表、零改代码):place `query,header,detail` → `query,header`。
       · 列表页照旧显示(place 含 query,列表列取 header+query 字段);
       · 表单页照旧可填/可看(place 含 header,写头表);
       · 明细表格不再选这一列 ⇒ 与行表结构对齐,报错消失。
       口径与先例完全一致:材料出库单的同名字段见
       tools/migrate-material-out-wo-line-query-col-20261015.sql(place=query,header)。

   ⚠ 只改 place,不动 label/col_name/seq/visible/editable —— 数据键与写入路径不变。
   ⚠ 守卫:头表物理列仍在(COL_LENGTH 非空)且行表确实没有该列时才改,
     避免将来行表补了该列后本脚本重跑把明细列误删。

   幂等可重跑;两账套均执行(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
   执行:cd tools && java -cp lib\mssql-jdbc.jar DbSync.java run migrate-material-ret-wo-line-nodetail-20261117.sql
   ============================================================ */
SET NOCOUNT ON;
GO
/* ── ① 前置事实核对:头表有、行表没有 ⇒ 才改 ─────────────────────────── */
DECLARE @headHas bit = CASE WHEN COL_LENGTH(N'dbo.bd_material_ret', N'工单行号') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @lineHas bit = CASE WHEN COL_LENGTH(N'dbo.bl_material_ret', N'工单行号') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @cur nvarchar(60) = (SELECT RTRIM(place) FROM yj_field
                              WHERE panel_code = N'MATERIAL_RET' AND label = N'工单行号');
PRINT N'[核对] bd_material_ret.工单行号=' + CAST(@headHas AS nvarchar(2))
    + N' / bl_material_ret.工单行号=' + CAST(@lineHas AS nvarchar(2))
    + N' / 现 place=' + ISNULL(@cur, N'(无该字段)');

IF @headHas = 0
    THROW 51000, N'bd_material_ret 上没有「工单行号」列 —— 面板字段失去落点,请先核对表结构,本脚本不改。', 1;

/* ── ② 改 place(只在「含 detail 且行表无该列」时动手;幂等) ───────────── */
IF @lineHas = 0
   AND EXISTS (SELECT 1 FROM yj_field
               WHERE panel_code = N'MATERIAL_RET' AND label = N'工单行号'
                 AND CHARINDEX(N'detail', place) > 0)
BEGIN
    UPDATE yj_field
       SET place = N'query,header'
     WHERE panel_code = N'MATERIAL_RET' AND label = N'工单行号'
       AND CHARINDEX(N'detail', place) > 0;
    IF @@ROWCOUNT <> 1 THROW 51000, N'MATERIAL_RET.工单行号 的 place 更新行数异常(应为 1)。', 1;
    PRINT N'[OK] MATERIAL_RET.工单行号 place: query,header,detail → query,header(明细不再选该列)';
END
ELSE
    PRINT N'[SKIP] MATERIAL_RET.工单行号 无需变更(已是 query,header;或行表已有该列)';
GO
/* ── ③ 自检:字段还在、place 含 query+header、不再含 detail ───────────── */
DECLARE @bad int = 0;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND label = N'工单行号')
    SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND label = N'工单行号'
               AND CHARINDEX(N'query', place) > 0 AND CHARINDEX(N'header', place) > 0)
    SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND label = N'工单行号'
           AND CHARINDEX(N'detail', place) > 0)
    SET @bad = @bad + 1;
IF @bad > 0
    RAISERROR(N'生产退料单「工单行号」place 自检失败(%d 项)—— 列表会再次整页 500', 16, 1, @bad);
ELSE
    PRINT N'[自检] 生产退料单.工单行号 = query,header(列表+表单显示,不再进明细 SQL)';
GO
