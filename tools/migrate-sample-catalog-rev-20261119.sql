/* ============================================================================
   送样登记表(SAMPLE_REG)· 内部检测目录 2026-11-19 版(在册复核/部署版,幂等)
   ----------------------------------------------------------------------------
   源文件:`提供系统更新版2026.11.17(1).xls` 的「内部检测目录」sheet
     (「内部检测目录 / 方法检出限和收费要求」;缺该 sheet 时回退 Sheet1)
   生成器:`tools/archive/_sample-catalog-20261119/gen-migration.mjs`(可重跑再生成本脚本)

   用户口径(2026-11-17,2026-11-19 复核沿用):
     1. 旧版目录数据不需要了 ⇒ 整批换成新表内容(不是增量补几条);
     2. 「内部检出限」列改名为「标准方法检出限」(表头与新版纸样一致)。
        实现:yj_field.label 改名(数据键跟着改),物理列名 `内部检出限` 沿用不变 ——
        与「收费」同款(label=收费（一个样/元）,col=收费),后端 labelsToCols 按 label 认载荷键、
        查询按 label 回填,所以改名对已存单据数据零影响(它们在同一物理列里)。

   为什么要出这一版(2026-11-19):
     用户提供的新文件「(1) 版」与旧 `提供系统更新版2026.11.17.xls` 的 Sheet1
     **逐格内容完全一致**(已用 xlsx 解析逐格 diff 核实),数据本身没有第 3 代;
     本脚本 = **在册复核 / 部署版**:重跑一遍把所有幂等步骤落齐(字段改名、译名、
     55 行逐行 upsert、目录外旧项置作废、自检),让两账套对齐到同一份事实。

   附带(2026-11-19):明细页签标题「送样登记表明细」改为「内部检测目录」,
     走 yj_panel.config 的 detailTabLabel(数据驱动),不在本脚本里改 ——
     见 tools/migrate-sample-reg-detail-tab-20261119.sql。

   与旧版(20261110,44 行)的差异:
     - 新增 12 项:色度 / 高浓度银 / 总硬度(原「硬度」改名) / 吸附碘值 / 吸附亚甲基蓝 /
       水分 / 灰分 / 偏硅酸 / 磷酸盐 / 硅酸盐 / 粉体密实震动 / 强度测试仪-炭棒;
     - 删除 1 项:「硬度」(被「总硬度」取代,本脚本置 asp_cancel='Y');
     - 序号 重排(粒度 40→50、一级/二级/三级精度 41/42/43→51/52/53);
     - 检出限口径由「内部 ppm 量级」换成「标准方法 mg/L 量级」;
     - 测试周期由「半天/一天/两天」换成「N个工作日出数据，5个工作日出报告」;
     - 检测标准 补精确编号(GB/T 5750.6-2023 等),检测标准备注 逐行补全。

   取值假设(源表用合并/留空表达「同上」;逐条列在此,便于复核):
     - 测试方法空白=同上;唯一例外「色度」保持空白(上一行是 TDS笔,套用会张冠李戴);
     - 测试周期空白=同上(整表向下继承);
     - 收费逐行原样、不推断:「色度」源表未给价 ⇒ 落空(需业务补价);
     - 检测标准/检测标准备注 逐行原样,空白即空白(粉体密实震动/强度测试仪-炭棒/粒度 无国标);
     - 「高浓度银」源表未给序号 ⇒ 落 28(与其上一行「高浓度铅」同号,只为保证列表排序稳定);
     - 「外送部分」是尾行说明、源表无序号 ⇒ 落 54(列表按序号升序,保证它排在最后);
     - 「检测误差」新版源表已无此列 ⇒ 全表清空(列保留,随时可在界面补)。
   幂等:按「检测元素」逐行 upsert,可重复执行;两账套(HSDZ_MES / HSDZ_MES_TEST)都要跑。
   ============================================================================ */
SET NOCOUNT ON;

PRINT N'=== 送样登记表 · 内部检测目录 2026-11-19 版(在册复核/部署版) ===';

IF OBJECT_ID(N'dbo.qc_sample_reg', N'U') IS NULL
BEGIN
  THROW 50001, N'qc_sample_reg 不存在:请先执行 tools/migrate-sample-insp-20261115.sql', 1;
END

/* ---------- 1. 字段改名:内部检出限 → 标准方法检出限(两个面板同一数据键) ---------- */
PRINT N'[1] yj_field 把「内部检出限」改名为「标准方法检出限」(SAMPLE_REG / INSP_COMMISSION)';
UPDATE yj_field SET label = N'标准方法检出限'
 WHERE col_name = N'内部检出限'
   AND panel_code IN (N'SAMPLE_REG', N'INSP_COMMISSION');
PRINT N'    改名行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* 列注明跟着改(MS_Description),便于查阅 */
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
            JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
           WHERE ep.name = N'MS_Description' AND c.name = N'内部检出限'
             AND OBJECT_NAME(ep.major_id) = N'qc_sample_reg')
  EXEC sp_updateextendedproperty N'MS_Description', N'标准方法检出限(源表「标准方法检出限」;检测目录/委托单行表显示名同)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_sample_reg', N'COLUMN', N'内部检出限';
ELSE
  EXEC sp_addextendedproperty N'MS_Description', N'标准方法检出限(源表「标准方法检出限」;检测目录/委托单行表显示名同)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_sample_reg', N'COLUMN', N'内部检出限';

/* ---------- 2. 译名:新数据键的英文(多语言规范:新增/改名数据键必须同时给译名) ---------- */
PRINT N'[2] yj_translation 补 en 译名';
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'标准方法检出限' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES
    (N'field', N'标准方法检出限', N'en', N'Standard Method Detection Limit', N'manual');

/* ---------- 3. 目录内容:整批换成 2026-11-19 版(55 行 = 54 个检测项 + 外送部分) ---------- */
PRINT N'[3] 逐行 upsert 目录内容(序号/检出限/方法/周期/收费/标准/备注)';
-- 1 锂 (源表 R3)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'锂')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 1, 内部检出限 = N'0.0006mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'锂';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (1, N'锂', N'0.0006mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 2 钠 (源表 R4)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'钠')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 2, 内部检出限 = N'0.02mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'钠';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (2, N'钠', N'0.02mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 3 镁 (源表 R5)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'镁')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 3, 内部检出限 = N'0.0009mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'镁';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (3, N'镁', N'0.0009mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 4 铝 (源表 R6)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'铝')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 4, 内部检出限 = N'0.0012mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'铝';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (4, N'铝', N'0.0012mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 5 磷 (源表 R7)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'磷')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 5, 内部检出限 = N'0.02mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'HJ700-2014', 检测标准备注 = N'水质 65 种元素的测定', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'磷';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (5, N'磷', N'0.02mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'HJ700-2014', N'水质 65 种元素的测定', N'', N'system', SYSDATETIME(), N'N');
END

-- 6 钾 (源表 R8)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'钾')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 6, 内部检出限 = N'0.003mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'钾';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (6, N'钾', N'0.003mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 7 钙 (源表 R9)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'钙')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 7, 内部检出限 = N'0.02mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'钙';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (7, N'钙', N'0.02mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 8 钒 (源表 R10)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'钒')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 8, 内部检出限 = N'0.00007mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'钒';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (8, N'钒', N'0.00007mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 9 铬 (源表 R11)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'铬')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 9, 内部检出限 = N'0.0001mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'铬';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (9, N'铬', N'0.0001mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 10 锰 (源表 R12)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'锰')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 10, 内部检出限 = N'0.00006mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'锰';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (10, N'锰', N'0.00006mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 11 铁 (源表 R13)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'铁')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 11, 内部检出限 = N'0.0009mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'铁';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (11, N'铁', N'0.0009mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 12 镍 (源表 R14)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'镍')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 12, 内部检出限 = N'0.0003mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'镍';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (12, N'镍', N'0.0003mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 13 铜 (源表 R15)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'铜')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 13, 内部检出限 = N'0.00009mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'铜';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (13, N'铜', N'0.00009mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 14 锌 (源表 R16)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'锌')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 14, 内部检出限 = N'0.0009mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'锌';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (14, N'锌', N'0.0009mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 15 砷 (源表 R17)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'砷')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 15, 内部检出限 = N'0.00009mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'砷';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (15, N'砷', N'0.00009mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 16 硒 (源表 R18)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'硒')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 16, 内部检出限 = N'0.0001mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'硒';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (16, N'硒', N'0.0001mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 17 锶 (源表 R19)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'锶')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 17, 内部检出限 = N'0.00009mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'锶';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (17, N'锶', N'0.00009mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 18 银 (源表 R20)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'银')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 18, 内部检出限 = N'0.00009mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'银';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (18, N'银', N'0.00009mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 19 镉 (源表 R21)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'镉')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 19, 内部检出限 = N'0.00006mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'镉';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (19, N'镉', N'0.00006mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 20 铅 (源表 R22)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'铅')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 20, 内部检出限 = N'0.00007mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'铅';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (20, N'铅', N'0.00007mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 21 锑 (源表 R23)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'锑')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 21, 内部检出限 = N'0.00007mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'锑';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (21, N'锑', N'0.00007mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 22 锡 (源表 R24)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'锡')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 22, 内部检出限 = N'0.00009mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'锡';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (22, N'锡', N'0.00009mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 23 钡 (源表 R25)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'钡')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 23, 内部检出限 = N'0.0001mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'钡';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (23, N'钡', N'0.0001mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 24 汞 (源表 R26)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'汞')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 24, 内部检出限 = N'0.00007mg/L', 检测误差 = NULL,
    测试方法 = N'ICPMS', 测试周期 = N'2-3个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'汞';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (24, N'汞', N'0.00007mg/L', NULL, N'ICPMS', N'2-3个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 25 高浓度钙 (源表 R27)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'高浓度钙')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 25, 内部检出限 = N'0.02mg/L', 检测误差 = NULL,
    测试方法 = N'火焰法', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T11904-1989', 检测标准备注 = N'水质钙镁测定 火焰原子吸收分光光度法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'高浓度钙';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (25, N'高浓度钙', N'0.02mg/L', NULL, N'火焰法', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T11904-1989', N'水质钙镁测定 火焰原子吸收分光光度法', N'', N'system', SYSDATETIME(), N'N');
END

-- 26 高浓度镁 (源表 R28)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'高浓度镁')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 26, 内部检出限 = N'0.02mg/L', 检测误差 = NULL,
    测试方法 = N'火焰法', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T11904-1989', 检测标准备注 = N'水质钙镁测定 火焰原子吸收分光光度法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'高浓度镁';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (26, N'高浓度镁', N'0.02mg/L', NULL, N'火焰法', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T11904-1989', N'水质钙镁测定 火焰原子吸收分光光度法', N'', N'system', SYSDATETIME(), N'N');
END

-- 27 高浓度锌 (源表 R29)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'高浓度锌')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 27, 内部检出限 = N'0.05mg/L', 检测误差 = NULL,
    测试方法 = N'火焰法', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'高浓度锌';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (27, N'高浓度锌', N'0.05mg/L', NULL, N'火焰法', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 28 高浓度铅 (源表 R30)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'高浓度铅')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 28, 内部检出限 = N'1mg/L', 检测误差 = NULL,
    测试方法 = N'火焰法', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.6-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'高浓度铅';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (28, N'高浓度铅', N'1mg/L', NULL, N'火焰法', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.6-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 28 高浓度银 (源表 R31)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'高浓度银')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 28, 内部检出限 = N'0.02mg/L', 检测误差 = NULL,
    测试方法 = N'火焰法', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'HJ1443-2026', 检测标准备注 = N'水质 银的测定 火焰原子吸收分光光度法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'高浓度银';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (28, N'高浓度银', N'0.02mg/L', NULL, N'火焰法', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'HJ1443-2026', N'水质 银的测定 火焰原子吸收分光光度法', N'', N'system', SYSDATETIME(), N'N');
END

-- 29 三氯甲烷 (源表 R32)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'三氯甲烷')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 29, 内部检出限 = N'0.000241mg/L', 检测误差 = NULL,
    测试方法 = N'气相', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 300.00,
    检测标准 = N'GB/T 5750.8-2023', 检测标准备注 = N'吹扫描捕集气象质谱/质谱分析法（GC/MS）', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'三氯甲烷';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (29, N'三氯甲烷', N'0.000241mg/L', NULL, N'气相', N'2个工作日出数据，5个工作日出报告', 300.00,
     N'GB/T 5750.8-2023', N'吹扫描捕集气象质谱/质谱分析法（GC/MS）', N'', N'system', SYSDATETIME(), N'N');
END

-- 30 氟化物 (源表 R33)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'氟化物')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 30, 内部检出限 = N'0.05mg/L', 检测误差 = NULL,
    测试方法 = N'哈希', 测试周期 = N'1个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.5.6.4', 检测标准备注 = N'水质 氟化物的测定', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'氟化物';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (30, N'氟化物', N'0.05mg/L', NULL, N'哈希', N'1个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.5.6.4', N'水质 氟化物的测定', N'', N'system', SYSDATETIME(), N'N');
END

-- 31 总磷 (源表 R34)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'总磷')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 31, 内部检出限 = N'0.01mg/L', 检测误差 = NULL,
    测试方法 = N'分光', 测试周期 = N'1个工作日出数据，5个工作日出报告', 收费 = 200.00,
    检测标准 = N'GB/T 11893- 1989', 检测标准备注 = N'水质 总磷的测定 钼酸铵分光光度法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'总磷';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (31, N'总磷', N'0.01mg/L', NULL, N'分光', N'1个工作日出数据，5个工作日出报告', 200.00,
     N'GB/T 11893- 1989', N'水质 总磷的测定 钼酸铵分光光度法', N'', N'system', SYSDATETIME(), N'N');
END

-- 32 PH (源表 R35)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'PH')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 32, 内部检出限 = N'0.02', 检测误差 = NULL,
    测试方法 = N'PH计', 测试周期 = N'1个工作日出数据，5个工作日出报告', 收费 = 50.00,
    检测标准 = N'GB/T 5750.4-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'PH';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (32, N'PH', N'0.02', NULL, N'PH计', N'1个工作日出数据，5个工作日出报告', 50.00,
     N'GB/T 5750.4-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 33 TDS (源表 R36)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'TDS')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 33, 内部检出限 = N'/', 检测误差 = NULL,
    测试方法 = N'TDS笔', 测试周期 = N'1个工作日出数据，5个工作日出报告', 收费 = 50.00,
    检测标准 = N'GB/T 5750.4-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'TDS';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (33, N'TDS', N'/', NULL, N'TDS笔', N'1个工作日出数据，5个工作日出报告', 50.00,
     N'GB/T 5750.4-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 34 色度 (源表 R37)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'色度')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 34, 内部检出限 = N'5度', 检测误差 = NULL,
    测试方法 = N'', 测试周期 = N'1个工作日出数据，5个工作日出报告', 收费 = NULL,
    检测标准 = N'GB/T 5750.4-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'色度';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (34, N'色度', N'5度', NULL, N'', N'1个工作日出数据，5个工作日出报告', NULL,
     N'GB/T 5750.4-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 35 浊度 (源表 R38)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'浊度')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 35, 内部检出限 = N'0.5NTU', 检测误差 = NULL,
    测试方法 = N'浊度笔', 测试周期 = N'1个工作日出数据，5个工作日出报告', 收费 = 50.00,
    检测标准 = N'GB/T 5750.4-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'浊度';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (35, N'浊度', N'0.5NTU', NULL, N'浊度笔', N'1个工作日出数据，5个工作日出报告', 50.00,
     N'GB/T 5750.4-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 36 总硬度 (源表 R39)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'总硬度')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 36, 内部检出限 = N'1mg/L', 检测误差 = NULL,
    测试方法 = N'滴定', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 200.00,
    检测标准 = N'GB/T 5750.4-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'总硬度';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (36, N'总硬度', N'1mg/L', NULL, N'滴定', N'2个工作日出数据，5个工作日出报告', 200.00,
     N'GB/T 5750.4-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 37 碱度 (源表 R40)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'碱度')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 37, 内部检出限 = N'', 检测误差 = NULL,
    测试方法 = N'滴定', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 200.00,
    检测标准 = N'GB/T15451-2006', 检测标准备注 = N'工业循环冷却水 总碱及酚酞碱度的测定', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'碱度';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (37, N'碱度', N'', NULL, N'滴定', N'2个工作日出数据，5个工作日出报告', 200.00,
     N'GB/T15451-2006', N'工业循环冷却水 总碱及酚酞碱度的测定', N'', N'system', SYSDATETIME(), N'N');
END

-- 38 COD (源表 R41)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'COD')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 38, 内部检出限 = N'0.05mg/L', 检测误差 = NULL,
    测试方法 = N'滴定', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 200.00,
    检测标准 = N'GB/T 5750.7-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'COD';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (38, N'COD', N'0.05mg/L', NULL, N'滴定', N'2个工作日出数据，5个工作日出报告', 200.00,
     N'GB/T 5750.7-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 39 余氯 (源表 R42)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'余氯')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 39, 内部检出限 = N'0.01mg/L', 检测误差 = NULL,
    测试方法 = N'显色', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 200.00,
    检测标准 = N'GB/T 5750.11-2023', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'余氯';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (39, N'余氯', N'0.01mg/L', NULL, N'显色', N'2个工作日出数据，5个工作日出报告', 200.00,
     N'GB/T 5750.11-2023', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 40 氯胺 (源表 R43)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'氯胺')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 40, 内部检出限 = N'0.01mg/L', 检测误差 = NULL,
    测试方法 = N'分光', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T5750.11-7/4.1', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'氯胺';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (40, N'氯胺', N'0.01mg/L', NULL, N'分光', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T5750.11-7/4.1', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 41 吸附碘值 (源表 R44)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'吸附碘值')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 41, 内部检出限 = N'/', 检测误差 = NULL,
    测试方法 = N'滴定', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T7702.7-2023/GB/T12496.8-2015', 检测标准备注 = N'煤质炭颗粒活性炭试验方法 碘值吸附值的测定；木质炭活性炭实验方法 碘值吸附值的测定', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'吸附碘值';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (41, N'吸附碘值', N'/', NULL, N'滴定', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T7702.7-2023/GB/T12496.8-2015', N'煤质炭颗粒活性炭试验方法 碘值吸附值的测定；木质炭活性炭实验方法 碘值吸附值的测定', N'', N'system', SYSDATETIME(), N'N');
END

-- 42 吸附亚甲基蓝 (源表 R45)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'吸附亚甲基蓝')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 42, 内部检出限 = N'/', 检测误差 = NULL,
    测试方法 = N'滴定', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T12496.10-1999', 检测标准备注 = N'木质炭活性炭实验方法 亚甲基蓝吸附值的测定', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'吸附亚甲基蓝';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (42, N'吸附亚甲基蓝', N'/', NULL, N'滴定', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T12496.10-1999', N'木质炭活性炭实验方法 亚甲基蓝吸附值的测定', N'', N'system', SYSDATETIME(), N'N');
END

-- 43 水分 (源表 R46)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'水分')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 43, 内部检出限 = N'/', 检测误差 = NULL,
    测试方法 = N'烘烤', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T7702.1-1997', 检测标准备注 = N'煤质炭颗粒活性炭试验方法第一部分-水分的测定', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'水分';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (43, N'水分', N'/', NULL, N'烘烤', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T7702.1-1997', N'煤质炭颗粒活性炭试验方法第一部分-水分的测定', N'', N'system', SYSDATETIME(), N'N');
END

-- 44 灰分 (源表 R47)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'灰分')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 44, 内部检出限 = N'/', 检测误差 = NULL,
    测试方法 = N'烘烤', 测试周期 = N'4个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T7702.15-2008', 检测标准备注 = N'煤质炭颗粒活性炭试验方法-灰分的测定', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'灰分';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (44, N'灰分', N'/', NULL, N'烘烤', N'4个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T7702.15-2008', N'煤质炭颗粒活性炭试验方法-灰分的测定', N'', N'system', SYSDATETIME(), N'N');
END

-- 45 偏硅酸 (源表 R48)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'偏硅酸')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 45, 内部检出限 = N'0.01mg/L', 检测误差 = NULL,
    测试方法 = N'分光', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T8538-20022', 检测标准备注 = N'食品安全国家标准-引用天然矿泉水检测方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'偏硅酸';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (45, N'偏硅酸', N'0.01mg/L', NULL, N'分光', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T8538-20022', N'食品安全国家标准-引用天然矿泉水检测方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 46 磷酸盐 (源表 R49)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'磷酸盐')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 46, 内部检出限 = N'0.1mg/L', 检测误差 = NULL,
    测试方法 = N'分光', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T 5750.5.10.1', 检测标准备注 = N'生活饮用水标准检验方法', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'磷酸盐';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (46, N'磷酸盐', N'0.1mg/L', NULL, N'分光', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T 5750.5.10.1', N'生活饮用水标准检验方法', N'', N'system', SYSDATETIME(), N'N');
END

-- 47 硅酸盐 (源表 R50)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'硅酸盐')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 47, 内部检出限 = N'0.1mg/L', 检测误差 = NULL,
    测试方法 = N'分光', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'GB/T12149-2017', 检测标准备注 = N'工业循环冷却水和锅炉用水硅的测定', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'硅酸盐';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (47, N'硅酸盐', N'0.1mg/L', NULL, N'分光', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'GB/T12149-2017', N'工业循环冷却水和锅炉用水硅的测定', N'', N'system', SYSDATETIME(), N'N');
END

-- 48 粉体密实震动 (源表 R51)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'粉体密实震动')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 48, 内部检出限 = N'/', 检测误差 = NULL,
    测试方法 = N'震动', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'', 检测标准备注 = N'', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'粉体密实震动';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (48, N'粉体密实震动', N'/', NULL, N'震动', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'', N'', N'', N'system', SYSDATETIME(), N'N');
END

-- 49 强度测试仪-炭棒 (源表 R52)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'强度测试仪-炭棒')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 49, 内部检出限 = N'/', 检测误差 = NULL,
    测试方法 = N'压力', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'', 检测标准备注 = N'', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'强度测试仪-炭棒';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (49, N'强度测试仪-炭棒', N'/', NULL, N'压力', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'', N'', N'', N'system', SYSDATETIME(), N'N');
END

-- 50 粒度 (源表 R53)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'粒度')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 50, 内部检出限 = N'', 检测误差 = NULL,
    测试方法 = N'激光', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'', 检测标准备注 = N'', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'粒度';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (50, N'粒度', N'', NULL, N'激光', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'', N'', N'', N'system', SYSDATETIME(), N'N');
END

-- 51 一级精度 (源表 R54)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'一级精度')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 51, 内部检出限 = N'', 检测误差 = NULL,
    测试方法 = N'激光', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'NSF42', 检测标准备注 = N'', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'一级精度';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (51, N'一级精度', N'', NULL, N'激光', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'NSF42', N'', N'', N'system', SYSDATETIME(), N'N');
END

-- 52 二级精度 (源表 R55)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'二级精度')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 52, 内部检出限 = N'', 检测误差 = NULL,
    测试方法 = N'激光', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'NSF42', 检测标准备注 = N'', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'二级精度';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (52, N'二级精度', N'', NULL, N'激光', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'NSF42', N'', N'', N'system', SYSDATETIME(), N'N');
END

-- 53 三级精度 (源表 R56)
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'三级精度')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 53, 内部检出限 = N'', 检测误差 = NULL,
    测试方法 = N'激光', 测试周期 = N'2个工作日出数据，5个工作日出报告', 收费 = 100.00,
    检测标准 = N'NSF42', 检测标准备注 = N'', 备注 = N'',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'三级精度';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (53, N'三级精度', N'', NULL, N'激光', N'2个工作日出数据，5个工作日出报告', 100.00,
     N'NSF42', N'', N'', N'system', SYSDATETIME(), N'N');
END

-- 54 外送部分
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = N'外送部分')
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = 54, 内部检出限 = N'', 检测误差 = NULL,
    测试方法 = N'', 测试周期 = N'', 收费 = NULL,
    检测标准 = N'', 检测标准备注 = N'据实需求际联系机构进行报价等信息', 备注 = N'不能测的：外送部分据实需求际联系机构进行报价等信息',
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = N'外送部分';
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (54, N'外送部分', N'', NULL, N'', N'', NULL,
     N'', N'据实需求际联系机构进行报价等信息', N'不能测的：外送部分据实需求际联系机构进行报价等信息', N'system', SYSDATETIME(), N'N');
END

/* ---------- 4. 新目录里没有的旧项:置作废(不硬删,留可追溯) ---------- */
PRINT N'[4] 旧目录里已被取代/取消的项置作废';
UPDATE dbo.qc_sample_reg
   SET asp_cancel = N'Y', asp_user2 = N'system', asp_time2 = SYSDATETIME()
 WHERE ISNULL(asp_cancel, N'N') <> N'Y'
   AND 检测元素 NOT IN (N'锂', N'钠', N'镁', N'铝', N'磷', N'钾', N'钙', N'钒', N'铬', N'锰', N'铁', N'镍', N'铜', N'锌', N'砷', N'硒', N'锶', N'银', N'镉', N'铅', N'锑', N'锡', N'钡', N'汞', N'高浓度钙', N'高浓度镁', N'高浓度锌', N'高浓度铅', N'高浓度银', N'三氯甲烷', N'氟化物', N'总磷', N'PH', N'TDS', N'色度', N'浊度', N'总硬度', N'碱度', N'COD', N'余氯', N'氯胺', N'吸附碘值', N'吸附亚甲基蓝', N'水分', N'灰分', N'偏硅酸', N'磷酸盐', N'硅酸盐', N'粉体密实震动', N'强度测试仪-炭棒', N'粒度', N'一级精度', N'二级精度', N'三级精度', N'外送部分');
PRINT N'    作废行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ---------- 5. 自检 ---------- */
PRINT N'[5] 自检';
DECLARE @active int = (SELECT COUNT(*) FROM dbo.qc_sample_reg WHERE ISNULL(asp_cancel, N'N') <> N'Y');
PRINT N'    在册目录行数 = ' + CAST(@active AS nvarchar(10)) + N'(期望 55)';
IF @active <> 55
  THROW 50002, N'目录行数不是 55,请核对第 3/4 步', 1;

IF EXISTS (SELECT 1 FROM yj_field WHERE col_name = N'内部检出限' AND label = N'内部检出限'
            AND panel_code IN (N'SAMPLE_REG', N'INSP_COMMISSION'))
  THROW 50003, N'字段改名没落全(仍有 label=内部检出限)', 1;

IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE ISNULL(asp_cancel, N'N') <> N'Y' AND 检测元素 = N'硬度')
  THROW 50004, N'旧项「硬度」未作废(应与「总硬度」并存了)', 1;

PRINT N'RESULT: PASS 送样登记表检测目录已切到 2026-11-19 版(55 行,标准方法检出限)';
