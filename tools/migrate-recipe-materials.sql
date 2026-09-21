/* ============================================================================
   migrate-recipe-materials.sql —— 84 种配方物料 + 含水率(配料计算的数据底座)
   ============================================================================
   ⚠ 本文件由 tools/gen/gen-recipe-materials.cjs 从设计源自动生成,不要手改。
     设计源:《20267月22日-最新烧结配方模板-1.xlsx》sheet「物料清单」(A1:D85,84 行)
     重新生成:node tools/gen/gen-recipe-materials.cjs

   三件事:
     ① bs_inv(商品/存货档案)补「水分含量」列 + 中文注明(AGENTS 硬规范:建表/改表必须注明)
     ② 把 84 种配方物料**按需**播种进 bs_inv —— 已存在的按存货编码跳过(正式库 3850 行里
        多半已经有这些物料,绝不能造重复行);水分含量只在为空时补,不覆盖人工维护过的值
     ③ 登记 yj_field(商品面板可见可维护)+ en 译名

   口径:CONTEXT.md「配方计算器」/ docs/adr/0004 —— 含水率是物料的固有属性,一次维护长期复用;
   弹窗按物料编号自动带出,档案没有的才在弹窗里手填。
   幂等:可重复执行;两个账套都要跑(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
   ============================================================================ */

SET NOCOUNT ON;
GO

/* ── ① bs_inv 补「水分含量」列(decimal(9,4):0.055 这类三位小数的含水率要存得下)── */
IF COL_LENGTH('bs_inv', N'水分含量') IS NULL
BEGIN
    ALTER TABLE bs_inv ADD [水分含量] decimal(9,4) NULL;
    PRINT N'migrate-recipe-materials.sql:bs_inv 补列 水分含量';
END
ELSE PRINT N'migrate-recipe-materials.sql:bs_inv.水分含量 已存在';
GO

/* 中文列注明(照 migrate-table-comments.sql 的口径:已有则不覆盖,不先删后加) */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('bs_inv')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('bs_inv'), N'水分含量', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'物料含水率(小数,0.05=5%);配方计算用它把干重换算成灌料湿重', N'SCHEMA', N'dbo', N'TABLE', N'bs_inv', N'COLUMN', N'水分含量';
GO

/* ── ② 84 种配方物料:按需播种(有则跳过;水分含量只补空)── */
PRINT N'--- 播种 84 种配方物料(已存在的跳过)---';

IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-XH-001')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-XH-001', N'鑫恒（80-250）', 0.06, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.06 WHERE RTRIM([存货编码]) = N'YJ-XH-001' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-XH-002')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-XH-002', N'鑫恒酸洗（80-250）', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-XH-002' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'XH-SX80250SX')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'XH-SX80250SX', N'鑫恒酸洗（80-250）水洗', 0.04, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.04 WHERE RTRIM([存货编码]) = N'XH-SX80250SX' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-YPS-002')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-YPS-002', N'依品晟（250-400）', 0.08, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.08 WHERE RTRIM([存货编码]) = N'YJ-YPS-002' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-YPS-003')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-YPS-003', N'专用炭X3（80-250）', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-YPS-003' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-YPS-004')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-YPS-004', N'依品晟（-400）', 0.08, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.08 WHERE RTRIM([存货编码]) = N'YJ-YPS-004' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-YPS-006')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-YPS-006', N'依品晟-WAC（80-250）', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-YPS-006' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-YKRS-012')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-YKRS-012', N'专用炭X1（80-250）', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-YKRS-012' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-YKRS-008')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-YKRS-008', N'英克瑞斯酸洗(150-400)', 0.04, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.04 WHERE RTRIM([存货编码]) = N'YJ-YKRS-008' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-044')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-044', N'英克瑞斯酸洗炭（20-40目）', 0.04, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.04 WHERE RTRIM([存货编码]) = N'YJ-044' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-HG-009-1')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-HG-009-1', N'可乐丽酸洗（80-250）', 0.04, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.04 WHERE RTRIM([存货编码]) = N'YJ-HG-009-1' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-HG-009-2')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-HG-009-2', N'可乐丽酸洗（250-500）', 0.04, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.04 WHERE RTRIM([存货编码]) = N'YJ-HG-009-2' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-HG-009-3')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-HG-009-3', N'可乐丽酸洗（-500）', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-HG-009-3' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-TJHZ-001')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-TJHZ-001', N'雅可比CS（80-200）', 0.055, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.055 WHERE RTRIM([存货编码]) = N'YJ-TJHZ-001' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-TJHZ-004')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-TJHZ-004', N'雅可比CS（200-325）', 0.055, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.055 WHERE RTRIM([存货编码]) = N'YJ-TJHZ-004' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-TJHZ-006')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-TJHZ-006', N'雅可比酸洗-HX（80-200）', 0.08, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.08 WHERE RTRIM([存货编码]) = N'YJ-TJHZ-006' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-YKB-002')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-YKB-002', N'雅可比MCA-ST（80-325）', 0.1, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.1 WHERE RTRIM([存货编码]) = N'YJ-YKB-002' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-YKB-001')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-YKB-001', N'雅可比酸洗-HX1（80-200）', 0.15, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.15 WHERE RTRIM([存货编码]) = N'YJ-YKB-001' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-HKK-005')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-HKK-005', N'专用炭X2（80-200）', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-HKK-005' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-WXR-001')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-WXR-001', N'万兴荣酸洗（80-500）', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-WXR-001' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-SLD-007')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'胶粉', N'YJ-SLD-007', N'2122胶粉', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-SLD-009')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'胶粉', N'YJ-SLD-009', N'4012T1胶粉', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-SLD-010')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'胶粉', N'YJ-SLD-010', N'4012胶粉', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-025')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'胶粉', N'YJ-025', N'4012T1胶粉（-180）', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-024')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'胶粉', N'YJ-024', N'4012T1胶粉（60-180）', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-ZX-001')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'胶粉', N'YJ-ZX-001', N'M4-D胶粉', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-ZX-003')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'胶粉', N'YJ-ZX-003', N'M2-D胶粉', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-ZX-004')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'胶粉', N'YJ-ZX-004', N'M3-D胶粉', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-YQ-001')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'胶粉', N'YJ-YQ-001', N'XM-220胶粉', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-HSM-001')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'胶粉', N'YJ-HSM-001', N'XM-220U胶粉', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-HSM-002')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'胶粉', N'YJ-HSM-002', N'TP311胶粉', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'HY-AC325+')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'HY-AC325+', N'木制炭（+325）', 0.04, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.04 WHERE RTRIM([存货编码]) = N'HY-AC325+' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-HKB-001')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-粉末', N'YJ-HKB-001', N'载银炭-RWAP6068', 0.08, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.08 WHERE RTRIM([存货编码]) = N'YJ-HKB-001' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-HSSF-001')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'胶粉', N'YJ-HSSF-001', N'ED9020胶粉', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'KG-DGBZ-01')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'KG-DGBZ-01', N'DGBZ-阻垢', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'KG-WXY-01')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'KG-WXY-01', N'WXY-阻垢', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'KG-AJE-A01')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'KG-AJE-A01', N'ANGEL-阻垢', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'3-01-16-0012')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'3-01-16-0012', N'SP-FX2-X60-RO', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'KG-KE-A01')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'KG-KE-A01', N'矿化-（60-325）', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'HP-12')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'HP-12', N'HP-12', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'HP-08')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'HP-08', N'HP-08', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'LP-08')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'LP-08', N'LP-08', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'BHP-12')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'BHP-12', N'BHP-12', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'SSC-12')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'SSC-12', N'SSC-12', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'ZNP-80250')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-粉末', N'ZNP-80250', N'含锌粉', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'HD-050')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'HD-050', N'碱1A', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'SD-23')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'SD-23', N'碱1B', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'HD-100')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'HD-100', N'碱2', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'HS-150')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'HS-150', N'碱3（40-80目）', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'HS-2040')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'HS-2040', N'碱3（20-40目）', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'SD-000')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'SD-000', N'碱4', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'HD-080')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'HD-080', N'高碱', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'XC-2040')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'XC-2040', N'方解石（20-40目）', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'XC-4080')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'XC-4080', N'方解石（40-80目）', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'MG-12')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'MG-12', N'镁离子球（1-2mm）', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'MG-23')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'MG-23', N'镁离子球（2-3mm）', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'TB-20120')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'TB-20120', N'钾长石（20-120目）', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'SD-2050')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'SD-2050', N'偏硅酸（20-50目）', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'Sr-1835')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'Sr-1835', N'富锶A（客户指定）', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'Sr-35200')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'Sr-35200', N'富锶A-1（客户指定）', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'Sr-2040')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'Sr-2040', N'富锶B', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'Sr-40100')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'Sr-40100', N'富锶C', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'Sr-1020')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'Sr-1020', N'富锶D', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'LFS-2040')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'LFS-2040', N'绿沸石（20-40目）', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'CAS-18')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-颗粒', N'CAS-18', N'Y料', NULL, N'启用', N'配方物料种子', 'system', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'BK1')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-粉末', N'BK1', N'BK1', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'BK1' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'BK2-A')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-粉末', N'BK2-A', N'BK2-A', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'BK2-A' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'BK2-B')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-粉末', N'BK2-B', N'BK2-B', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'BK2-B' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'BK1-D/10')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-粉末', N'BK1-D/10', N'BK1-D/10', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'BK1-D/10' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'BK1-DS02/10')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-粉末', N'BK1-DS02/10', N'BK1-DS02/10', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'BK1-DS02/10' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'BK1-DS10/06')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-粉末', N'BK1-DS10/06', N'BK1-DS10/06', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'BK1-DS10/06' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'PMC-80325')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-粉末', N'PMC-80325', N'抑菌陶瓷粉', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'PMC-80325' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'AGC-80250')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-粉末', N'AGC-80250', N'自制载银炭粉', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'AGC-80250' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'GF-001')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-粉末', N'GF-001', N'Graver', 0.1, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.1 WHERE RTRIM([存货编码]) = N'GF-001' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'FRT')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-粉末', N'FRT', N'FRT', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'FRT' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'HKK-CQ')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-粉末', N'HKK-CQ', N'HKK-CQ', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'HKK-CQ' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'HKK-CJ')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-粉末', N'HKK-CJ', N'HKK-CJ', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'HKK-CJ' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'HKK-CF')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-粉末', N'HKK-CF', N'HKK-CF', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'HKK-CF' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'GS10')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'功能料-粉末', N'GS10', N'GS10', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'GS10' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'PS-2')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'PS-2', N'破碎料2#', 0.07, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.07 WHERE RTRIM([存货编码]) = N'PS-2' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'PS-3')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'PS-3', N'破碎料3#', 0.07, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.07 WHERE RTRIM([存货编码]) = N'PS-3' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-YKRS-007')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-YKRS-007', N'英克瑞斯酸洗 80-250目', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-YKRS-007' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-YPS-007')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-YPS-007', N'专用炭X4(80-250目）', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-YPS-007' AND [水分含量] IS NULL;
IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = N'YJ-YKRS-014')
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (N'炭粉', N'YJ-YKRS-014', N'专用炭X5(80-250目）', 0.05, N'启用', N'配方物料种子', 'system', SYSDATETIME());
ELSE
    UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-YKRS-014' AND [水分含量] IS NULL;
GO

/* ── ③ 登记 yj_field:商品面板可见可维护(place=query,detail ⇒ 列表出列、详情可编)── */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'INV' AND col_name = N'水分含量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('INV', N'水分含量', N'水分含量', N'小数', NULL, NULL, NULL, NULL, N'query,detail', 65, 100, 1, 0, 0, 1);
GO

/* en 译名(AGENTS 多语言规范:新增字段必须带译名;其余语言由机翻兜底) */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'水分含量' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'水分含量', 'en', N'Moisture', 'manual');
GO

/* ── 核验 ── */
SELECT COUNT(*) AS 配方物料在库数 FROM bs_inv WHERE [数据来源] = N'配方物料种子';
SELECT COUNT(*) AS 有含水率的物料数 FROM bs_inv WHERE [数据来源] = N'配方物料种子' AND [水分含量] IS NOT NULL;
SELECT TOP 5 [存货编码], [存货名称], [所属类别], [水分含量] FROM bs_inv WHERE [数据来源] = N'配方物料种子' ORDER BY id;
GO
