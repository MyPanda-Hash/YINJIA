# 服务器部署步骤（全量部署 · 2026-09-14 制备）

> 本清单对应的两个部署文件（RDP 直接复制到服务器）：
> - `deploy\HSDZ_MES_golive_20260914-174615.bak`（干净账全量备份，含全部表中文注明）
> - `deploy\app.jar`（85.2MB，含报表双机制/单据预览/侧栏新风格/账套就绪；JDK24 编译，服务器 Java 25 兼容）

## 服务器侧操作（RDP 到 36.140.66.163）

### ① 恢复数据库（覆盖为干净账）
SSMS 连 localhost(Windows 身份验证)，整段执行（自动探测数据目录版）：

```sql
USE master;
GO
IF DB_ID(N'HSDZ_MES') IS NOT NULL
    EXEC(N'ALTER DATABASE [HSDZ_MES] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [HSDZ_MES];');
GO
DECLARE @data NVARCHAR(400) = CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS NVARCHAR(400));
DECLARE @sql NVARCHAR(MAX) = N'RESTORE DATABASE [HSDZ_MES] FROM DISK = N''C:\yinjia\HSDZ_MES_golive_20260914-174615.bak'' WITH RECOVERY, '
    + N'MOVE N''ASPSMT''     TO ''' + @data + N'HSDZ_MES.mdf'', '
    + N'MOVE N''ASPSMT_log'' TO ''' + @data + N'HSDZ_MES_log.ldf''';
EXEC(@sql);
GO
USE [HSDZ_MES];
ALTER USER [yinjia] WITH LOGIN = [yinjia];
```

> ⚠ 备份文件先复制到服务器 `C:\yinjia\`（与脚本内路径一致）。

### ② 换应用包
把 `deploy\app.jar` 复制到服务器 `C:\yinjia\update\app.jar`，双击 `C:\yinjia\update.bat`
（自动：停 → 备 → 换 → 启）。新窗口出现 `Started MesApplication` 即成功。

### ③ 验证清单
- [ ] 浏览器打开 http://36.140.66.163:8090 ，admin 登录（首次启动种子密码 123456，**登录后立即改密**）
- [ ] 登录工厂显示「YINJIA-MES」（无·测试库字样——那是本地测试实例标识）
- [ ] 基础档案：存货 30 条、仓库档案在
- [ ] 销售订单：星辰同步的 18 张在
- [ ] 库存状况：期初库存 30 行（全部 INIT- 批号）
- [ ] 研发/生产/品质各面板为**空单据**（干净账）
- [ ] 报表：销售订单勾单 → 导出报表 → PDF 正常

### ④ 上线加固（勿跳过）
- [ ] 改 admin 密码
- [ ] `start.bat` 换 64 位随机 JWT 密钥（生成命令见部署说明.md 一、7）

## 回滚（万一）
```cmd
copy /Y C:\yinjia\app.jar.bak C:\yinjia\app.jar
```
然后 taskkill java → start.bat。数据库回滚用部署前保险备份：
`deploy\HSDZ_MES_pre_golive_20260914-174022.bak`（留在开发机，按需传送）。
