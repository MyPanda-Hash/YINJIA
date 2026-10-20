# 热更新包 · IOT设备配置 + 项目流程管控(2026-10-20 重新打包)

给 **服务器 36.140.66.163** 用的**只换代码**热更新包。上一版(`hotupdate-rdflow-20261020`)已删除,
本包由当前仓库 HEAD **重新打包**,补上了它落后的两个提交。

## 一、这一版带了什么(相对服务器现役版本)

| 内容 | 来源提交 |
|---|---|
| 「设备配置管理」改名 **IOT设备配置**(菜单/页面标题/面板名/中英词条) | `dfc287af` |
| 研发管理 → 项目管理 → **项目流程管控**(按立项单号查 10 步流程,含旧单据兜底) | `171f00cb` … `b83c3f1d` |
| 数采页权限化(DC_CONFIG/DC_MONITOR/DC_STATS)、扫码领料等 | 更早的 `migrate-menu-restructure-wms-20261020` 批次 |
| 正式/测试账套数采设备齐备 | **只是数据**,已在服务器上做好,与本包无关 |

**不含任何数据库恢复/全量迁移**。服务器库一行不动(除非你手动跑下面的"可选"脚本)。

## 二、包里有什么

| 文件 | 用途 |
|---|---|
| `app.jar` | 整包(91.8MB,`mvn package` 自检:128 条 `BOOT-INF/lib`;`static/index.html` 引用的 5 个 chunk 全部存在;首页 chunk = `index-BCHl0VbT.js`) |
| `apply-update.bat` | **双击即用**:从 `\\tsclient\C\...` 拷 jar → 备份服务器旧 jar → 调 `C:\yinjia\update.bat`(停→换→起)→ 健康探测,日志回传到本目录 |
| `apply-db-optional.bat` + 两个 `.sql` | **可选**,默认不跑(见 §四) |
| `README.md` | 本文件 |

## 三、服务器上怎么做(1 步,约 1 分钟)

RDP 里打开开发机的重定向盘,双击:

```
\\tsclient\C\INCER\YINJIA-MES\deploy\hotupdate-iot-flow-20261020\apply-update.bat
```

跑完在**开发机**上看日志(不用截图识字):

```
C:\INCER\YINJIA-MES\deploy\hotupdate-iot-flow-20261020\apply-update-log.txt
```

看到 `RESULT: OK` 即完成。若 `\\tsclient\C\` 打不开:把 `app.jar` 复制到服务器
`C:\yinjia\update\app.jar` 覆盖,再双击 `C:\yinjia\update.bat`。

## 四、可选数据库脚本(默认不跑)

你说过「服务器上的角色和本地不一样」,所以默认**不动库**。需要时再双击
`apply-db-optional.bat`(日志 `db-optional-log.txt`),它做两件互不相关的事:

1. `migrate-dc-config-rename-20261020.sql`:把库里面板译名的 key 从「设备配置管理」改成
   「IOT设备配置」——**不跑也能看到新名字**(菜单/标题来自代码),只影响权限矩阵里的面板名与英文译名。
2. `migrate-rd-project-flow-20261020.sql`:给现有全部角色插 `PROJECT_FLOW` 授权 + 面板名英文译名。
   **不跑就只有 admin 能看到「项目流程管控」**。

两个脚本都幂等,可重复跑;只插/改权限与译名行,不碰业务数据。

## 五、回滚

`apply-update.bat` 会把换下来的 jar 备份成 `C:\yinjia\update\app.jar.bak-before-iotflow`。
回滚 = 复制回 `app.jar` 再跑一次 `C:\yinjia\update.bat`。

## 六、部署后验收(开发机上跑)

```powershell
cd C:\INCER\YINJIA-MES
# 1) 代码换了:首页 chunk 应为 index-BCHl0VbT.js(旧的是 index-DO0Sis7L.js)
curl.exe -s http://36.140.66.163:8090/ | Select-String 'index-[A-Za-z0-9_-]+\.js'

# 2) 数据没被动(与部署前基线对比)
node tools\archive\_hotupdate-20261020\_baseline.mjs http://36.140.66.163:8090 admin 123456 AFTER

# 3) 新接口通了(旧包是 404)
node tools\archive\_rd-flow-audit-20261020\_q-rd-flow.mjs http://36.140.66.163:8090 admin 123456

# 4) 设备仍是 7/7/7、测试账套 129/129/129
node tools\archive\_dc-prod-ready-20261020\_q-dc-checks.mjs http://36.140.66.163:8090 admin 123456 YJ
node tools\archive\_dc-prod-ready-20261020\_q-dc-checks.mjs http://36.140.66.163:8090 admin 123456 YJ_TEST
```

部署前基线(2026-10-20 15:35,存 `tools\archive\_hotupdate-20261020\baseline-before.txt`):

```
prod: 设备 7 / 已绑 1 / 齐备 1 ; RD_APPROVAL 1 行 ; rdFlow 404 ; chunk index-DO0Sis7L.js
test: 设备 129 / 已绑 129 / 齐备 129 ; RD_APPROVAL 0 行 ; rdFlow 404
```

> 注意:设备「已绑/齐备」在部署前已经是 **prod 7/7、test 129/129**(本轮刚配齐),
> 所以验收时这四项**不应变化**;变化的只有 chunk 与 `rdFlow` 由 404 → 200。
