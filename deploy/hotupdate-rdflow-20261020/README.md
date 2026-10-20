# 热更新包 · 项目流程管控 + 测试账套 129 台设备就绪(2026-10-20)

给 **服务器 36.140.66.163** 用的**只换代码**热更新包。

> 用户口径:「只需要把测试账套的数采平台的 129 个设备的数据带上去就行,其他的数据不要动服务器的,
> 按服务器端的数据来,只是一个热更新」。
>
> 因此本包:
> - **不含任何数据库备份/恢复**;
> - **不跑全量迁移链**(`DbSync`)——服务器库一行不动;
> - 只换 `app.jar`(代码 + 前端)。
> - 测试账套那 129 台设备**已经通过接口写好了**(演示网关 `GW-READY` + 五连齐备),
>   这次换包不会影响它们。

## 一、包里有什么

| 文件 | 用途 |
|---|---|
| `app.jar` | **整包**(91MB,含前端),由当前仓库 HEAD 干净打包(`mvn clean package`,fat jar 自检 128 条 BOOT-INF/lib) |
| `apply-update.bat` | 在服务器上双击:从开发机重定向盘拷 jar → 备份旧 jar → 调 `C:\yinjia\update.bat`(停→换→起)→ 健康探测,结果写 `apply-update-log.txt`(回传到本包目录) |
| `apply-rd-flow-grants.bat` + `migrate-rd-project-flow-20261020.sql` | **可选**:给非管理员角色授权「项目流程管控」+ 补面板名英文译名(只插权限行/译名行,不碰业务数据) |
| `README.md` | 本文件 |

## 二、服务器上怎么做(1 步,约 1 分钟)

RDP 进服务器,打开**开发机的重定向盘**,双击:

```
\\tsclient\C\INCER\YINJIA-MES\deploy\hotupdate-rdflow-20261020\apply-update.bat
```

它会自己:备份旧 jar → 拷贝新 jar 到 `C:\yinjia\update\app.jar` → 调 `C:\yinjia\update.bat` → 等 40 秒 →
访问 `http://127.0.0.1:8090/` 打印 `RESULT: OK`。

完成后**到开发机上看日志**(不用截图识字):

```
C:\INCER\YINJIA-MES\deploy\hotupdate-rdflow-20261020\apply-update-log.txt
```

### 如果 `\\tsclient\C\` 打不开(这次 RDP 没开驱动器重定向)

手工两步:

1. 把本包的 `app.jar` 复制到服务器的 `C:\yinjia\update\app.jar`(覆盖);
2. 双击 `C:\yinjia\update.bat`(它会 停 → 备份 app.jar.bak → 换包 → 起);
   新窗口出现 `Started MesApplication` + `HikariPool ... Start completed` 即完成。

## 三、可选:让非管理员角色也能看到新页面

管理员(`admin`)本来就能看到「研发管理 → 项目管理 → 项目流程管控」。
**其他角色**需要有 `PROJECT_FLOW` 授权行才看得到,双击:

```
\\tsclient\C\INCER\YINJIA-MES\deploy\hotupdate-rdflow-20261020\apply-rd-flow-grants.bat
```

它用 `sqlcmd -E`(Windows 集成认证)在 `HSDZ_MES` 上执行迁移脚本,只做两件事:
给现有全部角色插 `yj_role_panel(PROJECT_FLOW, view,query)`、给面板名补一条 `en` 译名。
幂等,可重复跑;日志 `grants-log.txt`。

> 注意:这个脚本**只处理正式账套 `HSDZ_MES`**。若服务器上的测试账套也要授权,
> 把 bat 里的 `-d HSDZ_MES` 改成 `-d HSDZ_MES_TEST` 再跑一次。

## 四、回滚

`apply-update.bat` 会把服务器上换下来的那份 jar 备份成
`C:\yinjia\update\app.jar.bak-before-rdflow`。回滚 = 把它复制回 `app.jar` 再跑一次 `C:\yinjia\update.bat`。

## 五、验收(在开发机上跑,不用连服务器)

```powershell
cd C:\INCER\YINJIA-MES
# 1) 代码版本换了(index chunk 变了)+ 新接口通了
curl.exe -s http://36.140.66.163:8090/ | Select-String 'index-[A-Za-z0-9_-]+\.js'
node tools\archive\_hotupdate-20261020\_baseline.mjs http://36.140.66.163:8090 admin 123456 AFTER

# 2) 与部署前基线 diff:设备 129/129/129 不变,业务行数不变,只有 rd.approvals 由 404 变 200
fc tools\archive\_hotupdate-20261020\baseline-before.txt <(node ... AFTER)   # 或肉眼看
```

部署前基线(2026-10-20 15:35 实查,已存 `tools\archive\_hotupdate-20261020\baseline-before.txt`):

```
prod.dc.devices=7   prod.dc.gatewayBound=1   prod.dc.fullyReady=1   prod.dc.gateways=1
test.dc.devices=129 test.dc.gatewayBound=129 test.dc.fullyReady=129 test.dc.gateways=1
prod.rows.RD_APPROVAL=1  prod.rows.MATERIAL_OUT=1  test.rows.RD_APPROVAL=0
prod.rd.approvals=n/a(404)  test.rd.approvals=n/a(404)   <- 部署后应变成 200 且能列出立项
```
