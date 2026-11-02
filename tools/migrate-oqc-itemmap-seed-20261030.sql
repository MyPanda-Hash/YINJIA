/* migrate-oqc-itemmap-seed-20261030.sql(2026-10-30):出厂检验项目对齐表 seed
 *
 * 作用:把「出厂检验报告上印的项目」映射到「三张检验单里实际用的项目名」。
 *
 * 为什么必须有一张表:三张单的词表**完全不是一套叫法**(实测 HSDZ_MES):
 *   报告/客户口径:外观检查 · 尺寸规格检查 · 重量检查 · 挤压强度检查 · 黑水检查 · 余氯测试 · 碱性寿命测试 · 包装检查
 *   首件明细:   炭棒表观状态 · 炭棒脱粉情况 · 炭棒外径/内径/长度 · 炭棒重量(g) · 跌落 · 挤压强度 · 浊度NTU · 压降kPa
 *   制程明细:   外观 · 尺寸-外径 · 尺寸-长度 · 重量 · 成型压力 · 成型温度 · 余氯去除率
 *   组装明细:   外观 · 尺寸 · 重量 · 目数(+20目) · 压降 · 抗压强度 · 余氯去除率 · 卫生安全(X增加量)
 * 且三张明细表**都没有项目编码列**(29/36/27 列实测),只能按名字对齐。
 *
 * 取数规则(与 docs/design/出厂检验报告-从三张检验单并集生成.md §4.4 一致):
 *   按 报告项目 分组,按 优先级 升序逐条尝试,取**第一个"有值"的**(不是第一个存在的——
 *   例:成品单只有 120/438 张带 外观行,制程 417/443 张都有,所以必须"有值优先")。
 *
 * 无源项目(碱性寿命测试 / 包装检查):三张单里 0 行,不建映射行,报告上留空手填。
 * 幂等:按 (报告项目, 源面板, 源项目名) 去重;重复执行不新增。两账套都执行。
 */

IF OBJECT_ID(N'dbo.qc_oqc_item_map', N'U') IS NULL
BEGIN
  RAISERROR(N'qc_oqc_item_map 不存在:请先执行 migrate-oqc-report-20261030.sql', 16, 1);
END
ELSE
BEGIN
  DECLARE @m TABLE (报告项目 nvarchar(200), 源面板 nvarchar(50), 源表区 nvarchar(100), 源项目名 nvarchar(200), 优先级 int, 取值方式 nvarchar(20), 备注 nvarchar(500));
  INSERT INTO @m VALUES
   /* ① 外观检查:成品 > 制程 > 首件(首件是勾选项,值形如"无粘模（均匀）/无明显脱粉") */
   (N'外观检查', N'QC_ASM_INSP',   N'外观',     N'外观',          1, N'文本', N'组装成品检验:最终外观'),
   (N'外观检查', N'QC_PROC_INSP',  N'外观',     N'外观',          2, N'文本', N'制程检验:成型后外观'),
   (N'外观检查', N'QC_FIRST_INSP', N'首件检验', N'炭棒表观状态',  3, N'勾选', N'首件:无粘模（均匀）/轻微粘模（粗糙）/严重粘模（脱皮）'),
   (N'外观检查', N'QC_FIRST_INSP', N'首件检验', N'炭棒脱粉情况',  3, N'勾选', N'首件:无明显脱粉/轻微脱粉/严重脱粉'),
   /* ② 尺寸规格检查:成品 > 制程(外径/长度两行) > 首件(外径/内径/长度) */
   (N'尺寸规格检查', N'QC_ASM_INSP',   N'尺寸',     N'尺寸',       1, N'数值', N'组装成品检验:整组一列'),
   (N'尺寸规格检查', N'QC_PROC_INSP',  N'尺寸',     N'尺寸-外径',  2, N'数值', N'制程检验:外径'),
   (N'尺寸规格检查', N'QC_PROC_INSP',  N'尺寸',     N'尺寸-长度',  2, N'数值', N'制程检验:长度'),
   (N'尺寸规格检查', N'QC_FIRST_INSP', N'首件检验', N'炭棒外径',   3, N'数值', N'首件:外径(2 支样品)'),
   (N'尺寸规格检查', N'QC_FIRST_INSP', N'首件检验', N'炭棒内径',   3, N'数值', N'首件:内径(2 支样品)'),
   (N'尺寸规格检查', N'QC_FIRST_INSP', N'首件检验', N'炭棒长度',   3, N'数值', N'首件:长度(2 支样品)'),
   /* ③ 重量检查 */
   (N'重量检查', N'QC_ASM_INSP',   N'重量',     N'重量',        1, N'数值', N'组装成品检验'),
   (N'重量检查', N'QC_PROC_INSP',  N'重量',     N'重量',        2, N'数值', N'制程检验'),
   (N'重量检查', N'QC_PROC_INSP',  N'重量',     N'出货重量',    2, N'数值', N'制程检验:出货重量'),
   (N'重量检查', N'QC_FIRST_INSP', N'首件检验', N'炭棒重量(g)', 3, N'数值', N'首件:重量(带单位的历史写法)'),
   (N'重量检查', N'QC_FIRST_INSP', N'首件检验', N'炭棒重量',    3, N'数值', N'首件:重量'),
   /* ④ 挤压强度检查:首件是主来源(3825 行),成品只有 30 行 */
   (N'挤压强度检查', N'QC_FIRST_INSP', N'首件检验', N'挤压强度', 1, N'文本', N'首件:挤压强度(定性,如 无破损)'),
   (N'挤压强度检查', N'QC_ASM_INSP',   N'性能',     N'抗压强度', 2, N'文本', N'组装成品检验:抗压强度'),
   /* ⑤ 黑水检查:只有组装单有 1 行 */
   (N'黑水检查', N'QC_ASM_INSP', N'性能', N'黑水测试（无需无黑）', 1, N'文本', N'组装成品检验:黑水测试'),
   /* ⑥ 余氯测试:组装 30 行 / 制程 4 行 */
   (N'余氯测试', N'QC_ASM_INSP',  N'性能', N'余氯去除率', 1, N'数值', N'组装成品检验:余氯去除率'),
   (N'余氯测试', N'QC_PROC_INSP', N'性能', N'余氯去除率', 2, N'数值', N'制程检验:余氯去除率');
  /* ⑦ 首件另有 跌落 / 浊度NTU / 压降kPa(报告 8 项里没有,按并集进"过程检验数据"附栏,不占主表) */

  INSERT INTO dbo.qc_oqc_item_map (报告项目, 源面板, 源表区, 源项目名, 优先级, 取值方式, 停用, 备注)
  SELECT m.报告项目, m.源面板, m.源表区, m.源项目名, m.优先级, m.取值方式, 0, m.备注
  FROM @m m
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.qc_oqc_item_map t
    WHERE t.报告项目 = m.报告项目 AND t.源面板 = m.源面板 AND t.源项目名 = m.源项目名
  );

  PRINT N'[OK] 出厂检验项目对齐表 seed 已写入(新增 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行)';
END
GO

/* 自检:8 个报告项目里 6 个应有映射(碱性寿命测试/包装检查 无源,故意不建) */
DECLARE @bad int = 0;
IF (SELECT COUNT(DISTINCT 报告项目) FROM dbo.qc_oqc_item_map WHERE 停用 = 0) < 6 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.qc_oqc_item_map WHERE 报告项目 = N'外观检查') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.qc_oqc_item_map WHERE 报告项目 = N'尺寸规格检查') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.qc_oqc_item_map WHERE 报告项目 = N'重量检查') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.qc_oqc_item_map WHERE 报告项目 = N'挤压强度检查') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.qc_oqc_item_map WHERE 报告项目 = N'黑水检查') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.qc_oqc_item_map WHERE 报告项目 = N'余氯测试') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'出厂检验项目对齐 seed 自检失败', 16, 1);
ELSE PRINT N'出厂检验项目对齐表就绪(6 个报告项目 / 22 条来源映射)';
GO
