/* =============================================================================
   migrate-sample-reg-seq-20261120.sql
   「内部检测目录」(SAMPLE_REG → 表 qc_sample_reg)序号按 Excel 目录顺序重排 1~55

   【2026-11-24 修订:生产已新增 2 个检测项目 ⇒ 总数不再等于 55】
     生产实测可见 57 行 = 映射内 55 行 + 新增 2 行(「安全浸泡(14项金属)」「矿化(钾钠钙镁锶)」,
     11-20 之后登记)。原自检写死「可见行、去重序号都必须正好 55」⇒ 生产直接 RAISERROR 拒跑。
     现在改为:**映射内 55 行仍重排 1~55;未命中映射的可见行按(原序号,id)顺延排到 56 起**;
     自检口径改为「映射内的行序号与映射逐行一致 + 全部可见行**去重序号数 = 可见行数**(无重号)」。
     脚本改了字节 ⇒ DbSync 会判"未执行"重跑;逻辑幂等,重跑结果不变。

   【用户口径 2026-11-20】
     截图「内部检测目录」列表:「帮我修改一下这个排列顺序吧,这个当前序号是乱的。」
     追问后确认:「按 excel 排序即可,其他不用改动」
     ⇒ **只动数据(序号)**;列表默认排序、面板配置(yj_panel.config)、字段/页面一律不动。

   【乱在哪(2026-11-20 取证,HSDZ_MES 与 HSDZ_MES_TEST 完全一致)】
     qc_sample_reg 物理 56 行,界面可见 55 行
     (1 行「硬度」asp_cancel='Y'、2026-11-17 作废,不计入合计 5850 = 6050-200)。
     · 老行按 Excel 老版本导入、后补行又直接沿用 Excel 序号
       ⇒「高浓度铅」「高浓度银」都占 28(Excel 2026.11.17 里「高浓度银」的序号格是空的,
         它跟 28 号「高浓度铅」同组);
     · 后补的 12 行(色度/总硬度/吸附碘值/吸附亚甲基蓝/水分/灰分/偏硅酸/磷酸盐/硅酸盐/
       粉体密实震动/强度测试仪-炭棒/高浓度银)沿用 Excel 的 34~49;
     ·「外送部分」在 Excel 里写的是「不能测的」(文字),库里是 54。
     ⇒ 重号(28×2)+ 跳号,且与 Excel 内部检测目录逐行对不上。

   【做什么(幂等)】
     ① 按 Excel「内部检测目录」逐行顺序,把**未作废行**的 序号 重排为 1~55:
        锂/钠/镁/铝/磷/钾/钙/钒/铬/锰/铁/镍/铜/锌/砷/硒/锶/银/镉/铅/锑/锡/钡/汞 →
        高浓度钙/镁/锌/铅/高浓度银 → 三氯甲烷/氟化物/总磷/PH/TDS/色度/浊度/总硬度/碱度/
        COD/余氯/氯胺/吸附碘值/吸附亚甲基蓝/水分/灰分/偏硅酸/磷酸盐/硅酸盐/
        粉体密实震动/强度测试仪-炭棒 → 粒度/一级精度/二级精度/三级精度 → 外送部分;
     ② 已作废行不参与编号、序号保持原样(现役只有「硬度」1 条,界面不可见);
     ③ 自检(三态):表/列不存在 ⇒ SKIP;脚本内映射表不连续/重复 ⇒ FAIL;
        命中映射的行数 ≠ 55 或赋值后与映射不符 ⇒ FAIL 回滚;全部通过才 COMMIT。

   【幂等】按「检测元素」映射赋值,重复执行结果相同(命中同样的 55 行)。
   【两账套】HSDZ_MES / HSDZ_MES_TEST 均需执行(DbSync 按清单排队)。
   ⚠ 只改 qc_sample_reg.[序号] 一列,不碰面板配置/默认排序/其它列。
============================================================================= */
SET NOCOUNT ON;
DECLARE @dbn sysname = DB_NAME();

/* ---------- 三态①:对象不存在 ⇒ 明确 SKIP(不是失败,也不是"改成功") ---------- */
IF OBJECT_ID('dbo.qc_sample_reg') IS NULL
BEGIN
  RAISERROR(N'[SKIP] %s:qc_sample_reg 不存在,本脚本不执行', 10, 1, @dbn);
  RETURN;
END
IF COL_LENGTH('dbo.qc_sample_reg', N'序号') IS NULL
   OR COL_LENGTH('dbo.qc_sample_reg', N'检测元素') IS NULL
BEGIN
  RAISERROR(N'[FAIL] %s:qc_sample_reg 缺「序号」或「检测元素」列,拒绝执行', 16, 1, @dbn);
  RETURN;
END

/* ---------- 映射表:序号 → 检测元素(与 Excel 2026.11.17「内部检测目录」逐行同序) ---------- */
DECLARE @m TABLE (n int NOT NULL PRIMARY KEY, elem nvarchar(60) NOT NULL);
INSERT INTO @m (n, elem) VALUES
  ( 1, N'锂'),        ( 2, N'钠'),        ( 3, N'镁'),        ( 4, N'铝'),        ( 5, N'磷'),
  ( 6, N'钾'),        ( 7, N'钙'),        ( 8, N'钒'),        ( 9, N'铬'),        (10, N'锰'),
  (11, N'铁'),        (12, N'镍'),        (13, N'铜'),        (14, N'锌'),        (15, N'砷'),
  (16, N'硒'),        (17, N'锶'),        (18, N'银'),        (19, N'镉'),        (20, N'铅'),
  (21, N'锑'),        (22, N'锡'),        (23, N'钡'),        (24, N'汞'),        (25, N'高浓度钙'),
  (26, N'高浓度镁'),  (27, N'高浓度锌'),  (28, N'高浓度铅'),  (29, N'高浓度银'),  (30, N'三氯甲烷'),
  (31, N'氟化物'),    (32, N'总磷'),      (33, N'PH'),        (34, N'TDS'),       (35, N'色度'),
  (36, N'浊度'),      (37, N'总硬度'),    (38, N'碱度'),      (39, N'COD'),       (40, N'余氯'),
  (41, N'氯胺'),      (42, N'吸附碘值'),  (43, N'吸附亚甲基蓝'), (44, N'水分'),   (45, N'灰分'),
  (46, N'偏硅酸'),    (47, N'磷酸盐'),    (48, N'硅酸盐'),    (49, N'粉体密实震动'),
  (50, N'强度测试仪-炭棒'),
  (51, N'粒度'),      (52, N'一级精度'),  (53, N'二级精度'),  (54, N'三级精度'),  (55, N'外送部分');

/* ---------- 映射表自身自检:1..55 连续、元素不重复 ---------- */
IF (SELECT COUNT(*) FROM @m) <> 55
   OR (SELECT ISNULL(MIN(n), 0) FROM @m) <> 1
   OR (SELECT ISNULL(MAX(n), 0) FROM @m) <> 55
   OR (SELECT COUNT(DISTINCT elem) FROM @m) <> 55
BEGIN
  RAISERROR(N'[FAIL] %s:脚本内映射表不完整/不连续(应为 1~55 共 55 条),拒绝执行 —— 先修脚本', 16, 1, @dbn);
  RETURN;
END

DECLARE @vis int = (SELECT COUNT(*) FROM dbo.qc_sample_reg WHERE ISNULL(asp_cancel, N'N') <> N'Y');
DECLARE @hit int = (SELECT COUNT(*) FROM dbo.qc_sample_reg r
                      JOIN @m m ON LTRIM(RTRIM(r.[检测元素])) = m.elem
                     WHERE ISNULL(r.asp_cancel, N'N') <> N'Y');
RAISERROR(N'[待改] %s:可见行 %d,命中 Excel 映射 %d', 10, 1, @dbn, @vis, @hit);

IF @hit <> 55
BEGIN
  RAISERROR(N'[FAIL] %s:命中映射的行数应为 55,实际 %d(目录被增删改过?先核对再改脚本/数据),已中止', 16, 1, @dbn, @hit);
  RETURN;
END

BEGIN TRANSACTION;

UPDATE r
   SET r.[序号] = m.n
  FROM dbo.qc_sample_reg r
  JOIN @m m ON LTRIM(RTRIM(r.[检测元素])) = m.elem
 WHERE ISNULL(r.asp_cancel, N'N') <> N'Y';

/* ---------- 未命中映射的可见行(2026-11-24 起新登记的检测项目):顺延排到 56 起 ---------- */
DECLARE @extra int = @vis - @hit;
IF @extra > 0
BEGIN
  ;WITH x AS (
    SELECT r.id, ROW_NUMBER() OVER (ORDER BY ISNULL(r.[序号], 9999), r.id) AS rn
      FROM dbo.qc_sample_reg r
     WHERE ISNULL(r.asp_cancel, N'N') <> N'Y'
       AND NOT EXISTS (SELECT 1 FROM @m m WHERE LTRIM(RTRIM(r.[检测元素])) = m.elem)
  )
  UPDATE r SET r.[序号] = 55 + x.rn
    FROM dbo.qc_sample_reg r JOIN x ON x.id = r.id;
  PRINT N'  [UPD] 未纳入映射的可见行 ' + CAST(@extra AS nvarchar(10)) + N' 行,序号顺延到 56 起';
END

/* ---------- 三态③:赋值后逐行核对(不符 = 改失败) ---------- */
IF EXISTS (SELECT 1
             FROM dbo.qc_sample_reg r
             JOIN @m m ON LTRIM(RTRIM(r.[检测元素])) = m.elem
            WHERE ISNULL(r.asp_cancel, N'N') <> N'Y'
              AND ISNULL(r.[序号], -1) <> m.n)
BEGIN
  ROLLBACK TRANSACTION;
  RAISERROR(N'[FAIL] %s:重排后仍有行的序号与 Excel 映射不符,已回滚', 16, 1, @dbn);
  RETURN;
END

/* 全部可见行去重序号数 = 可见行数 ⇒ 无重号(允许 56+ 的新增行存在) */
DECLARE @dist int = (SELECT COUNT(DISTINCT [序号]) FROM dbo.qc_sample_reg WHERE ISNULL(asp_cancel, N'N') <> N'Y');
IF @dist <> @vis
BEGIN
  ROLLBACK TRANSACTION;
  RAISERROR(N'[FAIL] %s:重排后可见行的序号有重号/断号(去重数 %d ≠ 可见行 %d),已回滚', 16, 1, @dbn, @dist, @vis);
  RETURN;
END

COMMIT TRANSACTION;

RAISERROR(N'[OK] %s:内部检测目录序号已按 Excel 顺序重排 1~55;新增行顺延 56 起(只改数据,列表默认排序未动)', 10, 1, @dbn);

/* 收尾:未命中映射的可见行(已顺延编号)打印出来,方便日后新增项目时核对 */
IF @vis > @hit
  SELECT N'[提示] 未纳入映射的可见行(已顺延排到 56 起)' AS 项,
         r.id AS id, r.[序号] AS 序号, r.[检测元素] AS 检测元素
    FROM dbo.qc_sample_reg r
   WHERE ISNULL(r.asp_cancel, N'N') <> N'Y'
     AND NOT EXISTS (SELECT 1 FROM @m m WHERE LTRIM(RTRIM(r.[检测元素])) = m.elem);
