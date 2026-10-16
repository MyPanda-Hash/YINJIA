-- ═══════════════════════════════════════════════════════════════════════════════════
-- _fill-insp-plan-content-20261015.sql —— 给出货检验计划表 RD_INSP_PLAN 的**已存在单据**
--   填一组内容(表头空档补齐 + 表体 13 行检验项目:必测项 7 + 型式检验 6)。
--
-- 为什么是一次性数据脚本而不是迁移:内容是**单据数据**,不是 schema;不能进 tools/db-migrations.txt
-- (迁移链按内容哈希判"要不要重跑",会把这份数据灌到别的账套/服务器上;且它按单号写入,
-- 在部署全量覆盖后重跑只会覆盖人工改动)。故放 archive/ 按任务产物留档。
--
-- 「按当前实现逻辑」的落点(改这份之前先读这几处):
--   · 版面:frontend/src/core/views/recordSheetConfigs.js → RD_INSP_PLAN
--     表头三行(产品编号|客户项目名称|使用范围 / 产品功能类别|产品整体尺寸|版本号 / 编写人|审核人)
--     + 表体**一张表 7 列**(序号|检验项目|检验要求|检验方法|不合格应对措施|检查频率|备注),
--     设计原名由 yj_field.alias 承载(控制项目→检验项目、控制标准及要求→检验要求、
--     控制方法→检验方法、检测频率→检查频率)。
--   · 内容真源:yj_std_lib 的 lib_code='insp.plan'(必测项 7 条 + 型式检验 6 条,item_code=表区名),
--     行内各列就是 testItemLib.toInspRow() 的投影(控制项目/质量控制内容/检测仪器/控制标准及要求/
--     检验/不合格应对措施/检测频率/取样方式/检验内容/控制方法)。本脚本**照抄库里的正文**,
--     只把 [检验内容] 这一格按既有单据口径写成**短表区名**(外观/重要尺寸/重量/…):
--     该列在面板上是 hiddenCol(不上纸),但下游「取出货检验计划」把它当 [表区] 用
--     (QcInspPlanController.fromShipPlan:检验内容→表区),写整句会让每行各成一组。
--     同口径参照:IP-TEST-0001 与 tools/archive/_probe-asm-ship-plan-fixture.sql。
--   · 下游映射(2026-10-13/15 口径,backend .../QcInspPlanController.fromShipPlan):
--     控制项目→检验项目 · 控制标准及要求→检验要求 · 控制方法→检验方法 · 检测频率→检查频率 ·
--     检测仪器→检验仪器 · 不合格应对措施→同名 · 检验内容→表区 · 检验类别→必测项/型式检验分组。
--   · 序号写 10/20/…/130:下游按 TRY_CAST([序号] AS int) 排序取数,写数字串才排得对。
--
-- 覆盖哪几张单(按账套各取所需,不存在的跳过):
--   · HSDZ_MES      → IP-2026-10-0002(产品编号 111,人工新录、表体只有 1 行占位垃圾)
--   · HSDZ_MES_TEST → DEMO-IP-002(碱性炭棒滤芯(演示),表体只有 1 行「外观」)
--   两单的产品口径都是碱性炭棒,与 insp.plan 库正文同源。DEMO-IP-001(除重金属炭棒滤芯(演示))
--   **不动** —— 该产品不是碱性炭棒口径,套这份内容属张冠李戴。
--
-- 幂等:先按单号删明细再插;表头只补**空档**(已有值一律不动 —— 那些是人工录的,脚本不越权改写。
--   实测 产品编号/客户项目名称/产品功能类别/产品整体尺寸/使用范围/编写人 在本单都已有值,故
--   本脚本对表头通常只补 [标题] 一格)。
-- 用法(tools/ 目录下,两个账套各跑一次):
--   java -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" yinjia env archive/_fill-insp-plan-content-20261015.sql
--   java -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true" yinjia env archive/_fill-insp-plan-content-20261015.sql
-- ═══════════════════════════════════════════════════════════════════════════════════

SET NOCOUNT ON;

DECLARE @cand TABLE (seq int IDENTITY(1,1), doc nvarchar(60), note nvarchar(50));
INSERT INTO @cand (doc, note) VALUES
    (N'IP-2026-10-0002', N'正式账套'),
    (N'DEMO-IP-002',     N'测试账套演示单');

DECLARE @measure nvarchar(1000) =
    N'1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序' + CHAR(10) +
    N'2. 复核检验方法、量具、标准，确认是否误判' + CHAR(10) +
    N'3. 扩大抽检比例，判定问题是偶发还是批量性';

DECLARE @i int = 1, @n int = (SELECT COUNT(*) FROM @cand), @doc nvarchar(60), @note nvarchar(50), @filled int = 0;

WHILE @i <= @n
BEGIN
    SELECT @doc = doc, @note = note FROM @cand WHERE seq = @i;

    IF EXISTS (SELECT 1 FROM dbo.rd_insp_plan_head WHERE [单据编号] = @doc AND ISNULL(asp_cancel,'N') <> 'Y')
    BEGIN
        -- ① 表头:只补空档(有值的不动)
        UPDATE dbo.rd_insp_plan_head SET
            [标题]         = CASE WHEN ISNULL([标题],N'')         = N'' THEN N'出货检验项目控制计划（碱性炭棒）' ELSE [标题] END,
            [产品功能类别] = CASE WHEN ISNULL([产品功能类别],N'') = N'' THEN N'碱性炭棒' ELSE [产品功能类别] END,
            [产品整体尺寸] = CASE WHEN ISNULL([产品整体尺寸],N'') = N'' THEN N'外径 46±0.5mm × 内径 9.5±0.5mm × 长度 23±0.5mm（外包无纺布）' ELSE [产品整体尺寸] END,
            [使用范围]     = CASE WHEN ISNULL([使用范围],N'')     = N'' THEN N'家用/商用净水器炭棒滤芯（伊可普碱性炭棒工装配套）' ELSE [使用范围] END,
            [编写人]       = CASE WHEN ISNULL([编写人],N'')       = N'' THEN N'冯敏' ELSE [编写人] END,
            asp_user2 = N'admin', asp_time2 = SYSDATETIME()
        WHERE [单据编号] = @doc;

        -- ② 表体:清掉该单原有明细(占位垃圾行),按库内容重铺 13 行
        DELETE FROM dbo.rd_insp_plan_detail WHERE [单据编号] = @doc;

        INSERT INTO dbo.rd_insp_plan_detail
            ([单据编号],[检验类别],[序号],[控制项目],[质量控制内容],[检测仪器],[控制标准及要求],[检验],
             [不合格应对措施],[检测频率],[取样方式],[检验内容],[控制方法],[备注],[asp_user1],[asp_time1])
        VALUES
        -- ── 必测项 7 条(yj_std_lib item_code='必测项') ──
        (@doc, N'必测项', N'10', N'*外观', N'外观', N'目视',
         N'清洁、无破损无压痕，无裂纹,无倾斜等缺陷；切面平整无锯齿纹路，无明显缺角；切面无残留炭渣',
         N'IQC', @measure, N'每批次', N'生产量*1%', N'外观', N'常规抽检', N'首件+巡检', N'admin', SYSDATETIME()),

        (@doc, N'必测项', N'20', N'*整体尺寸(外包无纺布)', N'尺寸', N'游标卡尺',
         N'外径：46±0.5mm' + CHAR(10) + N'内径：9.5±0.5mm' + CHAR(10) + N'长度：23±0.5mm',
         N'IQC', @measure, N'每批次', N'生产量*1%', N'重要尺寸', N'常规抽检', N'首件+巡检', N'admin', SYSDATETIME()),

        (@doc, N'必测项', N'30', N'*出货重量', N'炭棒重量', N'电子秤',
         N'>22g', N'IQC', @measure, N'每批次', N'生产量*1%', N'重量', N'常规抽检', NULL, N'admin', SYSDATETIME()),

        (@doc, N'必测项', N'40', N'*抗压强度（裸棒）', N'强度', N'普研PY-880',
         N'将炭棒水平放置在水平面板上，设置下压速度5mm/min，按测试键，仪器自动下压，断裂后读取压断时最大力压力值。' + CHAR(10) + N'控制标准：>50kgf',
         N'IQC', @measure, N'每批次', N'1PCS/一个生产批次', N'强度', N'常规抽检', N'破坏性试验', N'admin', SYSDATETIME()),

        (@doc, N'必测项', N'50', N'*压降测试', N'压降', N'数显压力表',
         N'将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分管直接连接，测试流速0.24L/min，滤前前后接装压力表，压力表距离滤芯接口位置长度50mm，通水10min后记录压差值（滤芯前压-后压）。' + CHAR(10) + N'控制标准：≤25kpa',
         N'IQC', @measure, N'每批次', N'1PCS/一个生产批次', N'压降', N'常规抽检', NULL, N'admin', SYSDATETIME()),

        (@doc, N'必测项', N'60', N'*黑水及颗粒物测试（无黑后）', N'黑水测试', N'烧杯，哈希2100q',
         N'将炭棒组装好装入滤瓶（透明大T），按进水方向通水，测试流速0.24±0.05L/min' + CHAR(10) +
         N'1.用烧杯接第一杯水250ml，观察出水及测试浊度值；' + CHAR(10) +
         N'2.冲水5min后，浸泡24H，陶瓷杯接出水100ml，观察出水情况及测试浊度值；' + CHAR(10) +
         N'控制标准：1.初始：轻微黑水，浊度≤20NTU' + CHAR(10) + N'2.浸泡24H：无肉眼可见黑水，浊度≤3NTU',
         N'IQC', @measure, N'每批次', N'1PCS/一个生产批次', N'黑水测试', N'常规抽检', N'冲水 5min 后测初始，浸泡 24H 后复测', N'admin', SYSDATETIME()),

        (@doc, N'必测项', N'70', N'*黑水及颗粒物测试（无黑后）', N'浸泡颗粒物', N'烧杯',
         N'将炭棒组装好装入滤瓶（可旋盖大T），按进水方向通水，测试流速0.24±0.05L/min，' + CHAR(10) +
         N'完成黑水测试后，炭棒静置浸泡24H，用陶瓷杯接出水100ml，正常照明下，用肉眼观察杯底部颗粒物，颗粒物≤4颗' + CHAR(10) +
         N'控制标准：浸泡4H颗粒物≤4颗',
         N'IQC', @measure, N'每批次', N'1PCS/一个生产批次', N'颗粒物', N'常规抽检', NULL, N'admin', SYSDATETIME()),

        -- ── 型式检验 6 条(yj_std_lib item_code='型式检验') ──
        (@doc, N'型式检验', N'80', N'*碱性性能测试', N'*初始PH增加值测试', N'PH计',
         N'将炭棒组装好装入伊可普工装，按进水方向通RO纯水（水效水500+RO机），测试流速0.24L/min,冲水5min后，浸泡30min后，测试出水PH，接水量为500ml。' + CHAR(10) + N'控制标准：初始PH增加值＞3.0',
         N'IQC', @measure, N'每批次', N'1PCS/一个生产批次', N'性能', N'常规抽检', N'型式检验项', N'admin', SYSDATETIME()),

        (@doc, N'型式检验', N'90', N'*碱性性能测试', N'*浸泡24H口感测试', N'PH计、TDS笔',
         N'将炭棒组装好装入伊可普工装，按进水方向通RO纯水（水效水500+RO机），测试流速0.24L/min,冲水5min后，浸泡24H后，接出水（连续接五杯，接水量为100ml）及原水，测试口感、PH、TDS' + CHAR(10) +
         N'控制标准：1.五杯口感均无异常' + CHAR(10) + N'2.第一杯TDS增加值小于150' + CHAR(10) + N'3.第一杯出水PH增加值＞4.0',
         N'IQC', @measure, N'每批次', N'1PCS/一个生产批次', N'性能', N'常规抽检', N'型式检验项', N'admin', SYSDATETIME()),

        (@doc, N'型式检验', N'100', N'*碱性性能测试', N'碱性寿命', N'PH计',
         N'将炭棒组装好装入伊可普工装，全程RO纯水（水效水500+RO机）加标测试控制水温25±3℃、流速0.24L/min，在额定净水0%、25%、50%、75%、100%，浸泡30min后取炭棒滤后水进行测试记录节点流速及炭棒出水PH（寿命1000L，每天冲水约145L，测试周期约为7天）。寿命1000L，PH增加值≥0.5',
         N'IQC', @measure, N'型式检验半年一次', NULL, N'性能', N'型式检测报告', N'寿命 1000L，测试周期约 7 天', N'admin', SYSDATETIME()),

        (@doc, N'型式检验', N'110', N'余氯性能测试', N'*余氯初始去除率', N'哈希DR3900',
         N'将炭棒组装好装入单筒，滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.24L/min，采用次氯酸钠原液（有效氯≥10％）稀释后进行余氯去除率的加标试验，余氯浓度控制在2.0±0.2mg/L，，通入加标水5min后取样测试，计算去除率。' + CHAR(10) + N'控制标准：余氯初始去除率≥99%',
         N'IQC', @measure, N'每批次', N'1PCS/一个生产批次', N'性能', N'常规抽检', NULL, N'admin', SYSDATETIME()),

        (@doc, N'型式检验', N'120', N'余氯性能测试', N'余氯寿命测试', N'哈希DR3900',
         N'将炭棒组装好装入单筒，滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.24L/min，采用次氯酸钠原液（有效氯≥10％）稀释后进行余氯去除率的加标试验，余氯浓度控制在2.0±0.2mg/L，在额定净水0%、25%、50%、75%、100%进行取样测试。全程加标，寿命1000L， 去除率≥90%',
         N'IQC', @measure, N'型式检验半年一次', NULL, N'性能', N'型式检测报告', N'寿命 1000L，全程加标', N'admin', SYSDATETIME()),

        (@doc, N'型式检验', N'130', N'卫生浸泡', N'/', N'/',
         N'符合《生活饮用水输配水设备及防护材料卫生安全评价规范》',
         N'IQC', @measure, N'型式检验半年一次', NULL, N'性能', N'型式检测报告', N'以第三方检测报告为准', N'admin', SYSDATETIME());

        PRINT N'[已填写] ' + @note + N' ' + @doc;
        SET @filled += 1;
    END
    ELSE
        PRINT N'[跳过] 本账套没有这张单: ' + @note + N' ' + @doc;

    SET @i += 1;
END

IF @filled = 0
    THROW 51000, N'本账套没有任何一张候选出货检验计划单,什么都没做', 1;

-- ③ 自检:头表 + 表体分块行数(必测项 7 / 型式检验 6)
SELECT c.note AS 账套口径, h.[单据编号] AS 计划单号, h.[产品编号] AS 产品编号, h.[标题] AS 标题,
       h.[版本号] AS 版本号, h.[产品功能类别] AS 产品功能类别, h.[使用范围] AS 使用范围,
       (SELECT COUNT(*) FROM dbo.rd_insp_plan_detail d
         WHERE d.[单据编号] = h.[单据编号] AND ISNULL(d.asp_cancel,'N') <> 'Y') AS 表体行数
FROM dbo.rd_insp_plan_head h JOIN @cand c ON c.doc = h.[单据编号]
ORDER BY c.seq;

SELECT d.[单据编号] AS 计划单号, d.[检验类别] AS 检验类别, COUNT(*) AS 行数,
       MIN(TRY_CAST(d.[序号] AS int)) AS 起序号, MAX(TRY_CAST(d.[序号] AS int)) AS 止序号
FROM dbo.rd_insp_plan_detail d JOIN @cand c ON c.doc = d.[单据编号]
GROUP BY d.[单据编号], d.[检验类别] ORDER BY d.[单据编号], d.[检验类别];
