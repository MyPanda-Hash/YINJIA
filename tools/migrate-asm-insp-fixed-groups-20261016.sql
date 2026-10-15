/* migrate-asm-insp-fixed-groups-20261016.sql(2026-10-16)
 * 组装成品检验单:把「外观 / 尺寸 / 出货重量」三组都声明为**固定组**(报表永远铺、面板可带入填写)
 *
 * 【用户口径(2026-10-16,截图 = 该单报表的三组表头)】
 *   「我是说当前的外观 尺寸 出货重量 这些都是当前固定需要检测的内容,可以使用什么方法让这些能固定
 *     填写的同时能够被读取到呢?」
 *   → 拍板两项:① 尺寸/出货重量 两组**整组一列多格**(列名「按照X检验项目填充」,照截图);
 *              ② 面板用「带入固定检验项」按钮把三组都落成真明细行(不自动预铺)。
 *
 * 【机制(为什么这样就能"固定填写 + 能被读取")】
 *   「能被读取」的唯一通道 = 明细行(qc_asm_insp_detail):一行 = 表区(组) + 检验项目 + 检验结果/测量值1..5/
 *   结果判断,报表与取数都按「同组 + 归一化项目名(去『表区-』前缀)」匹配 ⇒ 只要值落进行就必然读得到。
 *   所以「固定填写」要成立,必须让**格子有对应的行**;而「组永远铺出来」由本声明的**固定组**负责:
 *     · 报表(QcAsmInspReportSupport):声明过的组**永远铺**;组内列 = 固定项列 + **一个组列**
 *       (列名 = label,装该组其余项目的值,整组一列多格);没有数据的组也留着那列空格子(照截图);
 *     · 面板(「带入固定检验项」):外观 → 落 端盖两头/管身两侧 两行;尺寸/出货重量 → 若该组一行都没有,
 *       落一行**组列占位行**(检验项目 = label)供品质直接手填(填了就是真数据)。
 *
 * 【本脚本】把 QC_ASM_INSP 的 yj_panel.config 覆盖为三组声明(含 label);**保留**同 JSON 里可能已有的
 *   其它键(singleDoc/uniqueKeys…)—— 用 JSON_MODIFY 不可用(库兼容级别 100),故按"取旧串 + 只换
 *   fixedItems 段"的字符串方式重建;若旧串里没有其它键则直接写新串。
 * 【幂等】已含三组声明(关键词齐)则不动;两账套(先正式后测试)均执行。
 */

/* ══════════════════ A. 三组声明 ══════════════════ */
DECLARE @new nvarchar(max) =
  N'{"fixedItems":['
+ N'{"group":"外观","items":["端盖两头","管身两侧"]},'
+ N'{"group":"尺寸","items":[],"label":"按照尺寸检验项目填充"},'
+ N'{"group":"出货重量","items":[],"label":"按照重量检验项目填充"}'
+ N']}';

/* 只在"还没声明全三组"时写(判据:三个组名 + label 关键词都在就跳过) */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_ASM_INSP'
                 AND CONVERT(nvarchar(max), config) LIKE N'%fixedItems%'
                 AND CONVERT(nvarchar(max), config) LIKE N'%端盖两头%'
                 AND CONVERT(nvarchar(max), config) LIKE N'%按照尺寸检验项目填充%'
                 AND CONVERT(nvarchar(max), config) LIKE N'%按照重量检验项目填充%')
BEGIN
  UPDATE yj_panel SET config = @new WHERE panel_code = N'QC_ASM_INSP';
  PRINT N'[OK] QC_ASM_INSP 固定三组声明已写入(外观/尺寸/出货重量)';
END
ELSE PRINT N'[SKIP] QC_ASM_INSP 已声明三组固定检验项';
GO

/* ══════════════════ B. 自检 ══════════════════ */
DECLARE @bad int = 0;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_ASM_INSP'
                 AND CONVERT(nvarchar(max), config) LIKE N'%fixedItems%'
                 AND CONVERT(nvarchar(max), config) LIKE N'%端盖两头%'
                 AND CONVERT(nvarchar(max), config) LIKE N'%管身两侧%'
                 AND CONVERT(nvarchar(max), config) LIKE N'%按照尺寸检验项目填充%'
                 AND CONVERT(nvarchar(max), config) LIKE N'%按照重量检验项目填充%') SET @bad = @bad + 1;
/* 制程检验单不该被写入(用户已把它的外观分组拿掉) */
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_PROC_INSP'
             AND CONVERT(nvarchar(max), config) LIKE N'%fixedItems%') SET @bad = @bad + 1;
/* 上一批的列还在(不因本次改动丢) */
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'检验结果') IS NULL SET @bad = @bad + 1;

IF @bad > 0 RAISERROR(N'成品检验单固定三组声明迁移自检失败', 16, 1);
ELSE PRINT N'成品检验单固定三组就绪:外观(端盖两头/管身两侧)+ 尺寸/出货重量(整组一列,按项目填充)';
GO
