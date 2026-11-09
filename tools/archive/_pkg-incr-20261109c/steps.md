# pkg-incr-20261109c · 部署步骤(服务器 RDP 执行)

> 目的:把服务器更新成仓库 `main` 这一版 —— 含 **实验室记录手机登记(逐行「手机照片」)**、
> 采购订单打印记录、材料码「按这次打印打码」的来源单号。
> 用户 2026-11-09 口径:「保留这列,把服务器也更新成这版」。
>
> 上一版 = 台账 #25 `pkg-incr-20261109b`(`RESULT: ALL-OK`,LEDGER=765 / FIELDS=4898 / PANELS=152 / BAK=0)。
> 本包 = 在那个基础上**再加 5 条迁移 + 新 jar**,`base commit` = `3102ca50f`(合并前 origin/main tip)。

## 0. 包内有什么(先看三样对得上,再动手)

| 项 | 值 |
|---|---|
| `app.jar` | 由本仓库 `main` 构建(`mvn package`,JDK 25),内含最新前端 `static` |
| `to-run.txt` | **5 条**:`migrate-pu-print-20261107.sql` / `migrate-pu-print-twin-20261109.sql` / `migrate-pu-label-src-print-20261109.sql` / `migrate-lab-mobile-20261109.sql` / `migrate-lab-mobile-row-photo-20261109.sql` |
| `SHA256SUMS.txt` | 覆盖全包;`app.jar` 的 SHA256 与包说明里那一行必须一致 |
| 附带 | `tools/`(739 个清单脚本 + `DbSync.java` + 四单基线 + `verify/` 三个体检)、`deploy-incremental.bat`、`apply-migrations.bat`、`verify-package.ps1`、`probe-login.ps1` |

## 1. 拷到服务器

RDP 登录服务器 → 把 **`pkg-incr-20261109c.zip`** 解压到**独立目录**(如 `C:\yj-deploy\pkg-incr-20261109c`)。

> ⚠ 包目录**不能**放在 `C:\yinjia` 里面(脚本第一步会以 `RESULT: FAIL-PKG-IN-INSTALL-DIR` 退出)。

## 2. 先只读体检(不碰任何东西)

```bat
cd /d C:\yj-deploy\pkg-incr-20261109c
verify-package.ps1            :: 或 powershell -ExecutionPolicy Bypass -File verify-package.ps1
deploy-incremental.bat CHECK
```

要看到的:
- `verify-package.ps1` → `CHECKED=… MISSING=0 BAD=0 → PACKAGE-OK`
- `deploy-incremental.bat CHECK` → `RESULT: CHECK-OK`(会打印「仍有 N 条待执行」= 5 左右)

**任何 `RESULT: FAIL-*` 就地停手,不要继续 GO**,把日志(`logs\deploy-*.log`)发我。

## 3. 执行(停应用 → 备份库 → 跑迁移 → 换 jar → 起服务 → 自检)

```bat
deploy-incremental.bat GO
```

全绿应为:
`APP-STOPPED → BACKUP-GATE-PASSED → MIGRATIONS-OK → NEW-JAR-IN-PLACE → APP-STARTED → LOGIN-OK → ALL-OK`

## 4. 验收(把这几条数字发我,我核台账)

```bat
:: ① 迁移账与规模(期望:LEDGER 比上次 765 多 5 左右、FIELDS 多 4~5、PANELS 不变 152)
sqlcmd -S localhost -d HSDZ_MES -E -Q "SET NOCOUNT ON; SELECT COUNT(*) AS LEDGER FROM yj_schema_log; SELECT COUNT(*) AS FIELDS FROM yj_field; SELECT COUNT(*) AS PANELS FROM yj_panel;"

:: ② 三张记录表的明细列「手机照片」在(期望 3 行)
sqlcmd -S localhost -d HSDZ_MES -E -Q "SET NOCOUNT ON; SELECT t.name AS tbl, c.name AS col, ty.name AS typ FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.name=N'手机照片' AND t.name LIKE 'rd_%detail';"

:: ③ 新面板字段(期望 3 行 place=detail)
sqlcmd -S localhost -d HSDZ_MES -E -Q "SET NOCOUNT ON; SELECT panel_code, label, place, seq FROM yj_field WHERE label=N'手机照片';"

:: ④ 打印记录两张表在
sqlcmd -S localhost -d HSDZ_MES -E -Q "SET NOCOUNT ON; SELECT name FROM sys.tables WHERE name IN ('bd_pu_print','bl_pu_print');"
```

外网复核(开发机就能跑):
`http://36.140.66.163:8090/` → 首页 chunk 应为本包说明里那个 `index-*.js`;
登录后在「手机扫码 → 实验室记录手机登记」能打开,手机端拍照上传的附件会存到 `手机照片-<行id>`。

## 5. 回滚点

- 库:`C:\yinjia\backup\pre-deploy-<时间戳>.bak`(GO 流程自动打)
- 应用:`C:\yinjia\backup\app-<时间戳>.jar`(GO 流程自动留旧 jar)
- 回滚 = 停服务 → 拷回旧 jar → 需要时还原 .bak → 起服务;然后把 `deploy/部署台账.md` 记一条。

## 6. 记台账

部署完把 ① `app.jar` SHA256 ② 前端入口 `index-*.js` ③ `yj_schema_log` 行数 三条指纹发我,
我按《部署记录规范》在 `deploy/部署台账.md` 追加一行 + 一节(含剔除脚本与理由、验收证据、回滚点)。
