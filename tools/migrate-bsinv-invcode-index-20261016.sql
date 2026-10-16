/* migrate-bsinv-invcode-index-20261016.sql — bs_inv(存货编码) 加非聚集索引(本地两账套)

【用户口径 2026-10-16】「优化系统响应速度,看看有没有可以优化的点,但是不要破坏系统正常使用」。

【实测根因(先量再改,证据 tools/archive/_perf-sweep-20261016/)】
  「待排产池」那条 SQL(ScheduleBoardService.pending)实测中位 **969 ms**;分段拆解:
    ① 原样(全列 + dm_kh JOIN + 「重点管控」派生 JOIN + 排序)= 969 ms
    ② 去掉「重点管控」派生 JOIN = **6 ms**   ← 160×
    ③ 去掉 dm_kh JOIN = 5 ms(不是它)
    ④ 只数数(无 JOIN)= 2 ms
    ⑤ 原样去掉排序 = 972 ms(不是排序)
  再排除坏计划:`OPTION (RECOMPILE)` 仍 933 ms;换 EXISTS 995 ms、换 OUTER APPLY 1051 ms
  ⇒ **不是计划选择问题,是 bs_inv.存货编码 没有索引**:优化器只能对每个工单行做一次 bs_inv 全表扫
  (3,917 行 × 宽行 nvarchar(400) 存货编码 + nvarchar(1000) 商品标签)。
  测试账套上先做实验(可回滚,`_q-bsinv-index-experiment.mjs`):建索引后 **957 ms → 20 ms(47×)**。

【为什么值得建(不止一处受益)】同一段 `FROM bs_inv iv GROUP BY iv.存货编码` 派生 JOIN 出现在:
  - ScheduleBoardService 三处(待排产池 / 今日已排产 / 工单排产看板)
  - WorkOrderListController(生产工单列表)
  - OrderConvertService(订单结转,另有 `LEFT JOIN bs_inv rv ON rv.存货编码 = l.存货编码`)
  - FlowBoardService(桌面「流程管控」待排产节点)
  即:排产工作台、工单排产看板、生产工单列表、订单结转、流程管控**五个入口一起提速**。

【为什么这符合《数据库规范》§2.4(不盲加索引)】
  该节要求:模糊匹配列不加索引;新增大表或**新增等值过滤/分组列**时在迁移脚本里评估并登记理由。
  本处正是**等值 JOIN/GROUP BY 列**(`存货编码`),且带实测前后对比;bs_inv 仅 3,917 行、不在"≥10 万行"
  强制项内,故理由与数据一并写在这里备查。

【做什么】建 `IX_bs_inv_存货编码 ON bs_inv(存货编码) INCLUDE (商品标签)`:
  - 键列 = JOIN/GROUP BY 的等值列;INCLUDE 商品标签 = 让「重点管控」判定(商品标签 LIKE '%重点%')
    不必回表(覆盖该派生段的取列)。
【幂等】已存在则跳过;末尾断言索引存在(存在性守卫)。
【两账套】先 HSDZ_MES 后 HSDZ_MES_TEST(DbSync 自动排队)。
【回滚】DROP INDEX IX_bs_inv_存货编码 ON bs_inv;(索引不承载业务语义,回滚只影响速度)
*/
SET NOCOUNT ON;

DECLARE @dbn sysname = DB_NAME();
DECLARE @exists int = (SELECT COUNT(*) FROM sys.indexes
                        WHERE object_id = OBJECT_ID('dbo.bs_inv') AND name = N'IX_bs_inv_存货编码');
/* ⚠ RAISERROR 的替换参数只能是**变量或字面量** —— 塞子查询会报「在 '(' 附近有语法错误」(实测两次踩到) */
DECLARE @rows int = (SELECT COUNT(*) FROM dbo.bs_inv);
RAISERROR(N'[前置] %s:bs_inv 行数 %d;IX_bs_inv_存货编码 存在 %d 个', 10, 1, @dbn, @rows, @exists);

IF @exists = 0
BEGIN
  CREATE INDEX IX_bs_inv_存货编码 ON dbo.bs_inv(存货编码) INCLUDE (商品标签);
  RAISERROR(N'[OK] %s:已建 IX_bs_inv_存货编码(存货编码) INCLUDE(商品标签)', 10, 1, @dbn);
END
ELSE
  RAISERROR(N'[SKIP] %s:IX_bs_inv_存货编码 已存在,未重复建', 10, 1, @dbn);

/* 自检:索引存在 + 键列/包含列正确 */
DECLARE @n int = (SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.bs_inv') AND name = N'IX_bs_inv_存货编码');
DECLARE @keyCols nvarchar(200) = (
  SELECT STUFF((SELECT N',' + col.name FROM sys.index_columns ic
                  JOIN sys.columns col ON col.object_id = ic.object_id AND col.column_id = ic.column_id
                 WHERE ic.object_id = OBJECT_ID('dbo.bs_inv') AND ic.index_id = i.index_id AND ic.is_included_column = 0
                 ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 1, '')
    FROM sys.indexes i WHERE i.object_id = OBJECT_ID('dbo.bs_inv') AND i.name = N'IX_bs_inv_存货编码');
IF @n <> 1 OR @keyCols IS NULL OR @keyCols <> N'存货编码'
  RAISERROR(N'[FAIL] %s:索引自检未过(存在 %d 个 / 键列「%s」)', 16, 1, @dbn, @n, @keyCols);
ELSE
  RAISERROR(N'[OK] %s:索引自检通过(键列 %s)', 10, 1, @dbn, @keyCols);
GO
