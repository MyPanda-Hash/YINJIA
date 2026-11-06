/* ============================================================================
   migrate-spike-water-layout-20261106.sql
   加标水配置记录表：表格结构存进标准库条目 —— 2026-11-06

   【需求来源·用户原话】
     「加标水这个单据做成可以自定义面板格式的，就是可以自己编辑要多少列，列下面有没有分格，
      列名字叫啥，这个要和标准库绑定的，就是一个标准库条目对应一个设计的表格样式，
      可以去参考品质管理的来料检验要求」

   【做法】
     加标水的列集原本硬编码在前端 recordSheetConfigs.RD_SPIKE_WATER.variants（3 套）。
     改成：**「测试项目」这个标准库字段的每个条目，在 content 里存自己的列定义 JSON** ——
     一个条目 = 一套表格样式。加一种测试项目只要在「⧉ 标准库维护」里加条目、用
     「⊞ 表格结构」可视化编辑列/列名/分格，不用改代码、不用发版。

   【本脚本做什么】
     把现有 3 个变体（除铅 17 列 / 除汞 15 列 / 除VOC 13 列）的列结构，
     写成 lab.test_item 库里对应条目的 content。
     ⚠ 只改这 3 条**加标水用到的**条目，其余条目（NSF 42-余氯 / NSF 42氯胺 / cs …）一个字不动。

   【数据安全】用户 2026-11-06 明确要求「不要把服务器上数据库的数据覆盖了，那些是真实使用的数据」：
     · 只 UPDATE 这 3 行 yj_std_lib.content（它们是**配置**不是业务数据，且本脚本可回滚）；
     · 无 DELETE / TRUNCATE；带行数守卫（改超 3 行即报错回滚）；
     · 末尾自检：3 条都必须是合法 JSON 且 cols 非空。
     · 老单据不受影响：单据明细按**列名**存值，本脚本不改任何单据表。

   ⚠ 两账套都要跑（先 HSDZ_MES 后 HSDZ_MES_TEST），已登记 tools/db-migrations.txt。
   ⚠ 幂等：WHERE 带 content NOT LIKE '{%' —— 已经是 JSON 的条目不再覆盖（用户自己编过就不动）。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRAN;

/* ── NSF 53-除铅（PH8.5）（17 列）── */
UPDATE yj_std_lib SET content = N'{
 "cols": [
  {
   "key": "测试日期",
   "label": "测试日期",
   "w": 90,
   "rowspan": 2
  },
  {
   "key": "项目名称",
   "label": "项目名称",
   "w": 110,
   "rowspan": 2
  },
  {
   "key": "测试装置",
   "label": "测试装置",
   "w": 100,
   "rowspan": 2
  },
  {
   "key": "测试工位",
   "label": "测试工位",
   "w": 90,
   "rowspan": 2
  },
  {
   "key": "配水量\\\n（L）",
   "label": "配水量\n（L）",
   "w": 80,
   "rowspan": 2
  },
  {
   "key": "配置用水",
   "label": "配置用水",
   "w": 90,
   "rowspan": 2
  },
  {
   "key": "硫酸镁",
   "label": "硫酸镁",
   "w": 90,
   "group": "试剂用量（g）"
  },
  {
   "key": "二水氯化钙",
   "label": "二水氯化钙",
   "w": 100,
   "group": "试剂用量（g）"
  },
  {
   "key": "碳酸氢钠",
   "label": "碳酸氢钠",
   "w": 90,
   "group": "试剂用量（g）"
  },
  {
   "key": "4%次氯酸钠",
   "label": "4%次氯酸钠",
   "w": 110,
   "group": "试剂用量（g）"
  },
  {
   "key": "盐酸或氢氧化钠",
   "label": "盐酸或氢氧化钠",
   "w": 120,
   "group": "试剂用量（g）"
  },
  {
   "key": "可溶性铅",
   "label": "可溶性铅",
   "w": 90,
   "group": "试剂用量（g）"
  },
  {
   "key": "不可溶性铅",
   "label": "不可溶性铅",
   "w": 100,
   "group": "试剂用量（g）"
  },
  {
   "key": "PH\\\n8.5±0.25",
   "label": "PH\n8.5±0.25",
   "w": 90,
   "group": "加标水水质指标"
  },
  {
   "key": "TDS（mg/L）200-500mg/L",
   "label": "TDS\n（mg/L）",
   "w": 90,
   "group": "加标水水质指标"
  },
  {
   "key": "水温（℃）\\\n20±2.5℃",
   "label": "水温（℃）\n20±2.5℃",
   "w": 100,
   "group": "加标水水质指标"
  },
  {
   "key": "负责人",
   "label": "负责人",
   "w": 70,
   "rowspan": 2
  }
 ]
}'
 WHERE lib_code = 'lab.test_item'
   AND content = N'NSF 53-除铅（PH8.5）'
   AND ISNULL(asp_cancel,'N') <> 'Y';
IF @@ROWCOUNT > 1 RAISERROR(N'migrate-spike-water-layout: 「NSF 53-除铅（PH8.5）」命中超过 1 行,疑 WHERE 被截断', 16, 1);

/* ── NSF 53-除汞（PH8.5）（15 列）── */
UPDATE yj_std_lib SET content = N'{
 "cols": [
  {
   "key": "测试日期",
   "label": "测试日期",
   "w": 90,
   "rowspan": 2
  },
  {
   "key": "项目名称",
   "label": "项目名称",
   "w": 120,
   "rowspan": 2
  },
  {
   "key": "测试装置",
   "label": "测试装置",
   "w": 110,
   "rowspan": 2
  },
  {
   "key": "测试工位",
   "label": "测试工位",
   "w": 100,
   "rowspan": 2
  },
  {
   "key": "配水量\\\n（L）",
   "label": "配水量\n（L）",
   "w": 90,
   "rowspan": 2
  },
  {
   "key": "配置用水",
   "label": "配置用水",
   "w": 110,
   "rowspan": 2
  },
  {
   "key": "碳酸氢钠",
   "label": "碳酸氢钠",
   "w": 100,
   "group": "试剂用量（g）"
  },
  {
   "key": "二水氯化钙",
   "label": "二水氯化钙",
   "w": 110,
   "group": "试剂用量（g）"
  },
  {
   "key": "盐酸或氢氧化钠",
   "label": "盐酸或氢氧化钠",
   "w": 130,
   "group": "试剂用量（g）"
  },
  {
   "key": "汞标准溶液 \\\n1000mg/L",
   "label": "汞标准溶液 \n1000mg/L",
   "w": 130,
   "group": "试剂用量（g）"
  },
  {
   "key": "PH\\\n8.5±0.25",
   "label": "PH\n8.5±0.25",
   "w": 90,
   "group": "加标水水质指标"
  },
  {
   "key": "TDS（mg/L）200-500mg/L",
   "label": "TDS（mg/L）\n200-500mg/L",
   "w": 120,
   "group": "加标水水质指标"
  },
  {
   "key": "水温（℃）\\\n20±2.5℃",
   "label": "水温（℃）\n20±2.5℃",
   "w": 100,
   "group": "加标水水质指标"
  },
  {
   "key": "浊度值（NTU）\\\n＜1NTU",
   "label": "浊度值（NTU）\n＜1NTU",
   "w": 110,
   "group": "加标水水质指标"
  },
  {
   "key": "负责人",
   "label": "负责人",
   "w": 80,
   "rowspan": 2
  }
 ]
}'
 WHERE lib_code = 'lab.test_item'
   AND content = N'NSF 53-除汞（PH8.5）'
   AND ISNULL(asp_cancel,'N') <> 'Y';
IF @@ROWCOUNT > 1 RAISERROR(N'migrate-spike-water-layout: 「NSF 53-除汞（PH8.5）」命中超过 1 行,疑 WHERE 被截断', 16, 1);

/* ── NSF 53-除VOC（13 列）── */
UPDATE yj_std_lib SET content = N'{
 "cols": [
  {
   "key": "测试日期",
   "label": "测试日期",
   "w": 90,
   "rowspan": 2
  },
  {
   "key": "项目名称",
   "label": "项目名称",
   "w": 120,
   "rowspan": 2
  },
  {
   "key": "测试装置",
   "label": "测试装置",
   "w": 110,
   "rowspan": 2
  },
  {
   "key": "测试工位",
   "label": "测试工位",
   "w": 100,
   "rowspan": 2
  },
  {
   "key": "配水量\\\n（L）",
   "label": "配水量\n（L）",
   "w": 90,
   "rowspan": 2
  },
  {
   "key": "配置用水",
   "label": "配置用水",
   "w": 110,
   "rowspan": 2
  },
  {
   "key": "氯化钠（g）",
   "label": "氯化钠（g）",
   "w": 110,
   "group": "试剂用量"
  },
  {
   "key": "三氯甲烷储备液\\\n（1000mg/L）",
   "label": "三氯甲烷储备液\n（1000mg/L）",
   "w": 150,
   "group": "试剂用量"
  },
  {
   "key": "PH\\\n8.5±0.25",
   "label": "PH\n7.5±0.5",
   "w": 90,
   "group": "加标水水质指标"
  },
  {
   "key": "TDS（mg/L）200-500mg/L",
   "label": "TDS（mg/L)\n200-500mg/L",
   "w": 120,
   "group": "加标水水质指标"
  },
  {
   "key": "水温（℃）\\\n20±2.5℃",
   "label": "水温（℃）\n20.0±2.5℃",
   "w": 100,
   "group": "加标水水质指标"
  },
  {
   "key": "浊度值（NTU）\\\n＜1NTU",
   "label": "浊度值（NTU）\n＜1NTU",
   "w": 110,
   "group": "加标水水质指标"
  },
  {
   "key": "负责人",
   "label": "负责人",
   "w": 80,
   "rowspan": 2
  }
 ]
}'
 WHERE lib_code = 'lab.test_item'
   AND content = N'NSF 53-除VOC'
   AND ISNULL(asp_cancel,'N') <> 'Y';
IF @@ROWCOUNT > 1 RAISERROR(N'migrate-spike-water-layout: 「NSF 53-除VOC」命中超过 1 行,疑 WHERE 被截断', 16, 1);

/* ══════════ 自检：3 条都必须是合法 JSON 且带 cols ══════════ */
IF EXISTS (
    SELECT 1 FROM yj_std_lib
     WHERE lib_code = 'lab.test_item'
       AND content IN (N'NSF 53-除铅（PH8.5）', N'NSF 53-除汞（PH8.5）', N'NSF 53-除VOC')
       AND ISNULL(asp_cancel,'N') <> 'Y')
    RAISERROR(N'migrate-spike-water-layout: 自检失败 —— 还有条目没写进结构（content 仍是纯名字）', 16, 1);
GO

COMMIT TRAN;
GO
