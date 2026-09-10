/* ============================================================
   migrate-lab-stdlib.sql
   ------------------------------------------------------------
   实验室 4 张表的 4 个字段改为「标准库」形式(可选可维护):

     加标水配置记录表   RD_SPIKE_WATER  测试项目
     内部委托测试申请单 RD_DOM_TEST     申请单类型
     设备使用登记表     RD_EQUIP_USE    设备名称
     仪器使用记录表     RD_INSTR_USE    仪器名称/型号

   做法:
   1. 把 yj_field 里这 4 个字段的 data_type 改成 '标准库',
      dict_sql 存标准库编码(lib_code) —— 沿用既有的 dict_sql 配置列,不改表结构;
      后端 PanelConfigService 遇到 data_type='标准库' 就从 yj_std_lib 取选项
      (原来 '下拉框' 是把 dict_sql 当 SQL 执行,写死的 VALUES 列表无法维护)。
   2. 把原来写死在 dict_sql 里的选项、以及线上已有的取值,灌进 yj_std_lib 作为初值。
   3. 幂等:条件 INSERT(按 lib_code+content 去重) + 条件 UPDATE。

   标准库编码:lab.test_item / lab.apply_type / lab.device / lab.instrument
   ============================================================ */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

-- ① 标准库初值(来自原 dict_sql 写死的选项 + 线上已有取值)
DECLARE @seed TABLE (lib nvarchar(50), content nvarchar(400), seq int);

-- 测试项目(原 dict_sql 的 3 个值)
INSERT INTO @seed (lib, content, seq) VALUES
 (N'lab.test_item', N'NSF 53-除铅（PH8.5）', 10),
 (N'lab.test_item', N'NSF 53-除汞（PH8.5）', 20),
 (N'lab.test_item', N'NSF 53-除VOC',        30);

-- 申请单类型(原 dict_sql 的 2 个值)
INSERT INTO @seed (lib, content, seq) VALUES
 (N'lab.apply_type', N'开发性',   10),
 (N'lab.apply_type', N'品质委托', 20);

-- 设备名称(原 dict_sql 的 7 台)
INSERT INTO @seed (lib, content, seq) VALUES
 (N'lab.device', N'加标测试系统1#', 10),
 (N'lab.device', N'加标测试系统2#', 20),
 (N'lab.device', N'加标测试系统3#', 30),
 (N'lab.device', N'加标测试系统4#', 40),
 (N'lab.device', N'加标测试系统5#', 50),
 (N'lab.device', N'加标测试系统6#', 60),
 (N'lab.device', N'加标测试系统7#', 70);

-- 仪器名称/型号(原本是文本框,收集线上已填过的值)
INSERT INTO @seed (lib, content, seq)
SELECT DISTINCT N'lab.instrument', LTRIM(RTRIM([仪器名称/型号])), 10
  FROM rd_instr_use_head
 WHERE ISNULL(LTRIM(RTRIM([仪器名称/型号])), N'') <> N'';

-- 落库(按 lib+content 去重)
INSERT INTO yj_std_lib (lib_code, item_code, content, seq, enabled, asp_user1, asp_time1)
SELECT s.lib, N'默认', s.content, s.seq, 1, N'seed', SYSDATETIME()
  FROM @seed s
 WHERE NOT EXISTS (SELECT 1 FROM yj_std_lib t
                    WHERE t.lib_code = s.lib AND t.content = s.content AND ISNULL(t.asp_cancel,'N') <> 'Y');
DECLARE @ins int = @@ROWCOUNT;
PRINT N'  标准库新增 ' + CAST(@ins AS nvarchar(10)) + N' 条';

-- ② 字段改为标准库类型
UPDATE yj_field SET data_type = N'标准库', dict_sql = N'lab.test_item'
 WHERE panel_code = 'RD_SPIKE_WATER' AND col_name = N'测试项目';
UPDATE yj_field SET data_type = N'标准库', dict_sql = N'lab.apply_type'
 WHERE panel_code = 'RD_DOM_TEST'    AND col_name = N'申请单类型';
UPDATE yj_field SET data_type = N'标准库', dict_sql = N'lab.device'
 WHERE panel_code = 'RD_EQUIP_USE'   AND col_name = N'设备名称';
UPDATE yj_field SET data_type = N'标准库', dict_sql = N'lab.instrument'
 WHERE panel_code = 'RD_INSTR_USE'   AND col_name = N'仪器名称/型号';
PRINT N'  字段已改为标准库类型 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

-- ③ 复查
SELECT f.panel_code, f.col_name, f.data_type AS 类型, f.dict_sql AS 标准库编码,
       (SELECT COUNT(*) FROM yj_std_lib s WHERE s.lib_code = f.dict_sql AND s.enabled = 1) AS 条目数
  FROM yj_field f
 WHERE f.data_type = N'标准库'
 ORDER BY f.panel_code, f.col_name;
GO
