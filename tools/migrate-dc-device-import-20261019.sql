/* ============================================================
   migrate-dc-device-import-20261019.sql
   数采设备台账导入 —— 《副本副本生产设备列表统计(2026)(1).xls》中「是否联网 = 是」的设备

   来源与口径(用户 2026-10-19）:
     "根据这里面的数据，把是否联网是的设备的数据整理出来，加入系统的测试账套里面的
      数采平台的设备数据里面"
   - 只取「是否联网 = 是」的 35 行;
   - **按台数展开**:数量列合计 129 台 ⇒ 生成 129 条设备台账。
     理由:数采台账是一台设备一条(将来每台各自绑网关/采集点/规则),数量写在一条里会丢信息;
     原行的序号/数量/生产厂家全部保留在 remark 里可回溯。
   - 设备编码 LW-001..LW-129(LW = 联网),状态 offline、启停 Y、未绑网关 —— 
     这是**台账登记**,不造任何采样值;接硬件后由 /api/dc/ingest 写入真实数据
     (沿用「看板的数据要是系统里面的真实的数据」口径)。

   按类型:机械手 45 台; 加工设备 23 台; 注塑机 22 台; 干燥机 15 台; 隔音设施 8 台; 产线 6 台; 检测设备 4 台; 办公终端 3 台; 其他 2 台; 公用设备 1 台
   按厂家:(未填) 111 台; 羽声 9 台; 智东 6 台; 创华腾 1 台; 统源 1 台; 忠科 1 台

   ⚠ 只导测试账套(用户明确"加入系统的测试账套"):本脚本在其它库上下文里只打印一行提示、不写任何行,
     所以进 db-migrations.txt 由 DbSync 串跑时,正式库 HSDZ_MES 上是 no-op;要导正式库需显式去掉闸门。
     ⚠ 闸门和 INSERT 必须写在**同一批**里 —— T-SQL 的 RETURN 只结束当前批,中间插 GO 的话
       后面的 INSERT 照样执行(2026-10-19 首次执行就因此在正式库灌了 129 行,已清),
       故本脚本全篇只有结尾一个 GO。
   ⚠ 幂等:按 code 判重(已存在则不覆盖人工改过的台账);不删任何已有设备。
   生成器:tools/archive/_dc-device-import-20261019/gen_import.py(改了口径重跑它,别手改本文件)
   ============================================================ */
SET NOCOUNT ON;
GO

IF OBJECT_ID('dbo.bs_dc_device','U') IS NULL
BEGIN
  PRINT N'[SKIP] 本库没有 bs_dc_device(数采平台未建表),先执行 migrate-dc-platform-20261018.sql';
  RETURN;
END
IF DB_NAME() <> N'HSDZ_MES_TEST'
BEGIN
  PRINT N'[SKIP] 联网设备台账导入只针对测试账套 HSDZ_MES_TEST,当前库 = ' + DB_NAME();
  RETURN;
END

/* ---------- 联网设备台账(按台展开;同批内完成自检,批中间不许 GO) ---------- */
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-001')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-001', N'智东购生产线', N'产线', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号1;生产厂家:智东;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-002')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-002', N'创华腾购测试台', N'检测设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号2;生产厂家:创华腾;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-003')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-003', N'羽声购测试设备', N'检测设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号3;生产厂家:羽声;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-004')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-004', N'统源购设备，实验室仪器设备款（检测仪器）', N'检测设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号4;生产厂家:统源;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-005')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-005', N'DR房', N'其他', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号14;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-006')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-006', N'忠科移印机', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号16;生产厂家:忠科;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-007')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-007', N'喷油线 01', N'产线', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号19(该行共 2 台);生产厂家:智东;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-008')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-008', N'喷油线 02', N'产线', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号19(该行共 2 台);生产厂家:智东;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-009')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-009', N'2台超声波', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号20;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-010')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-010', N'单轴横走式机械手', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号23;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-011')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-011', N'机械手', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号26;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-012')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-012', N'液压式高度调节板', N'公用设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号28;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-013')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-013', N'自动煲机线', N'产线', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号29;生产厂家:智东;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-014')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-014', N'内绕机 01', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号30(该行共 17 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-015')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-015', N'内绕机 02', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号30(该行共 17 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-016')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-016', N'内绕机 03', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号30(该行共 17 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-017')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-017', N'内绕机 04', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号30(该行共 17 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-018')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-018', N'内绕机 05', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号30(该行共 17 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-019')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-019', N'内绕机 06', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号30(该行共 17 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-020')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-020', N'内绕机 07', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号30(该行共 17 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-021')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-021', N'内绕机 08', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号30(该行共 17 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-022')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-022', N'内绕机 09', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号30(该行共 17 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-023')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-023', N'内绕机 10', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号30(该行共 17 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-024')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-024', N'内绕机 11', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号30(该行共 17 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-025')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-025', N'内绕机 12', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号30(该行共 17 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-026')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-026', N'内绕机 13', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号30(该行共 17 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-027')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-027', N'内绕机 14', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号30(该行共 17 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-028')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-028', N'内绕机 15', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号30(该行共 17 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-029')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-029', N'内绕机 16', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号30(该行共 17 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-030')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-030', N'内绕机 17', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号30(该行共 17 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-031')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-031', N'立式转子压铸机', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号31;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-032')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-032', N'静音房（含两端隧道）', N'隔音设施', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号38;生产厂家:羽声;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-033')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-033', N'精益生产3606拉线', N'产线', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号39;生产厂家:智东;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-034')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-034', N'产线隔音室 01', N'隔音设施', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号40(该行共 3 台);生产厂家:羽声;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-035')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-035', N'产线隔音室 02', N'隔音设施', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号40(该行共 3 台);生产厂家:羽声;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-036')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-036', N'产线隔音室 03', N'隔音设施', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号40(该行共 3 台);生产厂家:羽声;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-037')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-037', N'静音房 01', N'隔音设施', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号41(该行共 4 台);生产厂家:羽声;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-038')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-038', N'静音房 02', N'隔音设施', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号41(该行共 4 台);生产厂家:羽声;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-039')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-039', N'静音房 03', N'隔音设施', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号41(该行共 4 台);生产厂家:羽声;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-040')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-040', N'静音房 04', N'隔音设施', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号41(该行共 4 台);生产厂家:羽声;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-041')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-041', N'高周波机', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号42;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-042')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-042', N'加湿机老化测试线', N'产线', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号47;生产厂家:智东;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-043')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-043', N'11L高周波机器', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号48;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-044')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-044', N'烤饼机温度测试设备', N'检测设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号49;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-045')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-045', N'伺服节能注塑机 01', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号51(该行共 8 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-046')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-046', N'伺服节能注塑机 02', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号51(该行共 8 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-047')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-047', N'伺服节能注塑机 03', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号51(该行共 8 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-048')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-048', N'伺服节能注塑机 04', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号51(该行共 8 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-049')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-049', N'伺服节能注塑机 05', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号51(该行共 8 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-050')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-050', N'伺服节能注塑机 06', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号51(该行共 8 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-051')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-051', N'伺服节能注塑机 07', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号51(该行共 8 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-052')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-052', N'伺服节能注塑机 08', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号51(该行共 8 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-053')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-053', N'电脑 01', N'办公终端', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号52;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-054')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-054', N'电脑 02', N'办公终端', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号53;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-055')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-055', N'3606前壳盖模铜模', N'其他', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号56;表内「是否为数字化设备」=否,按「是否联网=是」口径纳入;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-056')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-056', N'注塑机 01', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号59(该行共 14 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-057')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-057', N'注塑机 02', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号59(该行共 14 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-058')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-058', N'注塑机 03', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号59(该行共 14 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-059')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-059', N'注塑机 04', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号59(该行共 14 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-060')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-060', N'注塑机 05', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号59(该行共 14 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-061')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-061', N'注塑机 06', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号59(该行共 14 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-062')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-062', N'注塑机 07', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号59(该行共 14 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-063')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-063', N'注塑机 08', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号59(该行共 14 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-064')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-064', N'注塑机 09', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号59(该行共 14 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-065')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-065', N'注塑机 10', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号59(该行共 14 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-066')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-066', N'注塑机 11', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号59(该行共 14 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-067')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-067', N'注塑机 12', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号59(该行共 14 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-068')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-068', N'注塑机 13', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号59(该行共 14 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-069')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-069', N'注塑机 14', N'注塑机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号59(该行共 14 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-070')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-070', N'干燥机 01', N'干燥机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号60(该行共 15 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-071')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-071', N'干燥机 02', N'干燥机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号60(该行共 15 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-072')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-072', N'干燥机 03', N'干燥机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号60(该行共 15 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-073')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-073', N'干燥机 04', N'干燥机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号60(该行共 15 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-074')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-074', N'干燥机 05', N'干燥机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号60(该行共 15 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-075')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-075', N'干燥机 06', N'干燥机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号60(该行共 15 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-076')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-076', N'干燥机 07', N'干燥机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号60(该行共 15 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-077')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-077', N'干燥机 08', N'干燥机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号60(该行共 15 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-078')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-078', N'干燥机 09', N'干燥机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号60(该行共 15 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-079')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-079', N'干燥机 10', N'干燥机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号60(该行共 15 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-080')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-080', N'干燥机 11', N'干燥机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号60(该行共 15 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-081')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-081', N'干燥机 12', N'干燥机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号60(该行共 15 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-082')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-082', N'干燥机 13', N'干燥机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号60(该行共 15 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-083')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-083', N'干燥机 14', N'干燥机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号60(该行共 15 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-084')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-084', N'干燥机 15', N'干燥机', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号60(该行共 15 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-085')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-085', N'五轴伺服横走式机械手 01', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号62;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-086')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-086', N'五轴伺服横走式机械手 02', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号63;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-087')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-087', N'三轴牛头机械手 01', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号64(该行共 4 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-088')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-088', N'三轴牛头机械手 02', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号64(该行共 4 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-089')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-089', N'三轴牛头机械手 03', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号64(该行共 4 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-090')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-090', N'三轴牛头机械手 04', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号64(该行共 4 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-091')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-091', N'卧式拌料机', N'加工设备', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号65;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-092')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-092', N'五轴伺服机械手 01', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号66;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-093')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-093', N'智慧会议平板', N'办公终端', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号68;按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-094')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-094', N'五轴伺服机械手 02', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-095')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-095', N'五轴伺服机械手 03', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-096')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-096', N'五轴伺服机械手 04', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-097')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-097', N'五轴伺服机械手 05', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-098')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-098', N'五轴伺服机械手 06', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-099')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-099', N'五轴伺服机械手 07', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-100')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-100', N'五轴伺服机械手 08', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-101')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-101', N'五轴伺服机械手 09', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-102')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-102', N'五轴伺服机械手 10', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-103')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-103', N'五轴伺服机械手 11', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-104')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-104', N'五轴伺服机械手 12', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-105')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-105', N'五轴伺服机械手 13', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-106')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-106', N'五轴伺服机械手 14', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-107')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-107', N'五轴伺服机械手 15', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-108')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-108', N'五轴伺服机械手 16', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-109')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-109', N'五轴伺服机械手 17', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-110')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-110', N'五轴伺服机械手 18', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-111')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-111', N'五轴伺服机械手 19', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-112')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-112', N'五轴伺服机械手 20', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-113')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-113', N'五轴伺服机械手 21', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-114')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-114', N'五轴伺服机械手 22', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-115')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-115', N'五轴伺服机械手 23', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-116')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-116', N'五轴伺服机械手 24', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-117')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-117', N'五轴伺服机械手 25', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-118')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-118', N'五轴伺服机械手 26', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-119')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-119', N'五轴伺服机械手 27', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-120')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-120', N'五轴伺服机械手 28', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-121')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-121', N'五轴伺服机械手 29', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-122')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-122', N'五轴伺服机械手 30', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-123')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-123', N'五轴伺服机械手 31', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-124')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-124', N'五轴伺服机械手 32', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-125')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-125', N'五轴伺服机械手 33', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-126')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-126', N'五轴伺服机械手 34', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-127')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-127', N'五轴伺服机械手 35', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-128')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-128', N'五轴伺服机械手 36', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'LW-129')
INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)
VALUES (N'LW-129', N'五轴伺服机械手 37', N'机械手', NULL, 60, N'offline', 'Y', N'来源:生产设备列表统计(2026) 序号69(该行共 36 台);按「是否联网」导入,未接硬件前显示离线', N'migration', SYSDATETIME());
/* ---------- 自检 ---------- */
DECLARE @total int = (SELECT COUNT(*) FROM dbo.bs_dc_device WHERE ISNULL(asp_cancel,'N') <> 'Y');
DECLARE @imported int = (SELECT COUNT(*) FROM dbo.bs_dc_device WHERE code LIKE N'LW-[0-9][0-9][0-9]' AND ISNULL(asp_cancel,'N') <> 'Y');
IF @imported <> 129
  RAISERROR(N'[FAIL] 联网设备台账应为 129 条,实际 %d 条', 16, 1, @imported);
DECLARE @noType int = (SELECT COUNT(*) FROM dbo.bs_dc_device WHERE code LIKE N'LW-%' AND ISNULL(device_type,'') = '');
IF @noType <> 0 RAISERROR(N'[FAIL] 有 %d 条联网设备缺设备类型', 16, 1, @noType);
RAISERROR(N'[OK] 联网设备台账导入 129/129 条(总数 %d 条:含电子秤/扫码枪/看板等既有设备)', 10, 1, @total) WITH NOWAIT;
GO
