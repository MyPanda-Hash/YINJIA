# 组织结构配置 + 检验报告审批消息(2026-11-11)

本目录是 2026-11-11 两件事的证据与生成器:

1. **按服务器备份的组织结构配置本机**(用户口径「先根据 D:\YINJIA-main\服务器数据库备份 的组织结构进行配置」);
2. **检验报告审批消息**:提交审批通知审核人(冯敏)、审批通过/驳回通知检验人、消息「去处理」能跳到对应单据。

> 完整说明与逐人截图见 **`docs/development/检验报告审批消息通知-20261111.md`**。

## 文件

| 文件 | 作用 |
|---|---|
| `GenOrgSql.java` | 从服务器备份巡检库 `HSDZ_MES_SRV` 生成 `tools/migrate-org-from-server-20261111.sql`(勿手改脚本) |
| `round-2x ~ round-4x.mjs` | ego 浏览器实机脚本(登录 / 建单 / 提交审批 / 审批通过 / 审批驳回 / 点消息跳转) |
| `round-31/32/40/41-*.png` | 各收件人收到消息的截图(文档里逐张引用) |
| `node-test-summary.txt` | 前端单测汇总(1647/1647 通过) |

## 复跑

```powershell
# 0) 前置:5173(vite)+ 8090(后端)都在跑,登录工厂选「YINJIA-MES·测试库」
# 1) 组织结构(如需重灌巡检库)
sqlcmd -S . -E -C -Q "RESTORE DATABASE HSDZ_MES_SRV FROM DISK=N'D:\YINJIA-main\服务器数据库备份\HSDZ_MES_manual_20261111-110118.bak' WITH MOVE N'ASPSMT' TO N'D:\SQLData\HSDZ_MES_SRV.mdf', MOVE N'ASPSMT_log' TO N'D:\SQLData\HSDZ_MES_SRV_log.ldf', REPLACE;"
cd tools; java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive/_org-sync-20261111/GenOrgSql.java
# 2) 浏览器脚本(账号/口令见文档:统一 123456)
ego-browser nodejs -e "await import('file:///C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-40.mjs')"
```

⚠ 巡检库 `HSDZ_MES_SRV` 只是**只读对照**,确认不需要后可 `DROP DATABASE HSDZ_MES_SRV`。
⚠ 组织结构脚本只允许在 `HSDZ_MES` / `HSDZ_MES_TEST` 上执行(脚本内 `IF DB_NAME() … RAISERROR` 自带闸门)。
