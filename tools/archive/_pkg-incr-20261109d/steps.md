# pkg-incr-20261109d · 部署步骤(服务器 RDP 执行)

> 目的:把服务器更新成仓库 `main` 这一版 —— **合并 origin/main 75 个提交后的整条代码线**
> (采购订单打印记录/重打/作废、材料码「按打印记录打码」、计量单位精度统一、
> 实验室记录手机登记含逐行「手机照片」、工单进度看板、手机端状态闸门等)。
> 用户 2026-11-09 口径:「对比确认后帮我上传到服务器」。
>
> 上一版 = 台账 #25 `pkg-incr-20261109b`(`RESULT: ALL-OK`,LEDGER=765 / FIELDS=4898 / PANELS=152 / BAK=0,
> jar `0d992f94…`、外网入口 `index-B9tdg78R.js`)。
> 本包 = 在那个基础上**再加 6 条迁移 + 新 jar**,`base commit` = `17ec1f9c0`(台账 #25 记载的服务器代码版本),
> 合并后 `HEAD` = 本包组装时的 `f0ecc4d47`。
>
> ⚠ **本包取代未部署的 `pkg-incr-20261109c`**(那版只列 5 条迁移,少 `migrate-lab-testitem-legacy-20261109.sql`)。

## 0. 包内有什么(先看三样对得上,再动手)

| 项 | 值 |
|---|---|
| `app.jar` | 由合并后 `main` 在**独立 worktree** 构建(`mvn package`,JDK 25,class major 69),内含最新前端 `static` |
| `app.jar` SHA256 | `cb33108a97ccd0b1980d70fa11d4625531794de20ad8b87a1c769035c85a8fe3`(97,961,093 字节) |
| 内嵌前端入口 | `assets/index-DNZKBlfG.js` |
| `to-run.txt` | **6 条**(顺序即执行顺序,见 §3.2) |
| `SHA256SUMS.txt` | 覆盖全包;`app.jar` 的 SHA256 必须与上表那一行一致 |

附带:`tools/`(736 条清单脚本 + `DbSync.java` + 四单基线 + `verify/` 三个体检)、
`deploy-incremental.bat`、`apply-migrations.bat`、`verify-package.ps1`、`probe-login.ps1`。

## 1. 拷到服务器

RDP 登录服务器 → 把 **`pkg-incr-20261109d.zip`** 解压到**独立目录**(建议 `C:\yj-deploy\pkg-incr-20261109d`)。

> ⚠ 包目录**不能**放在 `C:\yinjia` 里面(脚本第一步会以 `RESULT: FAIL-PKG-IN-INSTALL-DIR` 退出)。

## 2. 先只读体检(不碰任何东西)

```bat
verify-package.ps1
deploy-incremental.bat CHECK
```

要看到的:
- `verify-package.ps1` → `CHECKED=… MISSING=0 BAD=0 → PACKAGE-OK`
- `deploy-incremental.bat CHECK` → `RESULT: CHECK-OK`,并打印「仍有 **6** 条待执行」

> 若待执行条数 **不是 6**(比如 5 或 7),**先停手**把 CHECK 日志发我 —— 说明服务器账本与
> `17ec1f9c0` 的差集和我算的不一致,我要重算 to-run 再给你新包。

**任何 `RESULT: FAIL-*` 就地停手,不要继续 GO**,把日志(`logs\deploy-*.log`)发我。

## 3. 执行

```bat
deploy-incremental.bat GO
```

全绿应为:
`APP-STOPPED → BACKUP-GATE-PASSED → MIGRATIONS-OK → NEW-JAR-IN-PLACE → APP-STARTED → LOGIN-OK → ALL-OK`

### 3.2 to-run 6 条(顺序即执行顺序)

1. `migrate-pu-print-20261107.sql` —— 采购订单打印记录两张表 `bd_pu_print` / `bl_pu_print`(+税率列 +弹窗反查)
2. `migrate-pu-print-twin-20261109.sql` —— 打印记录加「对应单号」(有金额 ↔ 无金额互相记录)
3. `migrate-pu-label-src-print-20261109.sql` —— `bd_pu_label` 加「来源打印单号」(同一张打印记录只可打一次材料码)
4. `migrate-lab-mobile-20261109.sql` —— 三张记录表头加「手机照片」列 + `yj_field` 登记
5. `migrate-lab-mobile-row-photo-20261109.sql` —— 附件下移到明细行:头列/头字段撤、明细三表加列并登记 `place=detail`
6. `migrate-lab-testitem-legacy-20261109.sql` —— 实验室「测试项目」标准库补齐历史遗留条目

## 4. 验收(把这几条数字发我,我核台账)

```bat
:: ① 迁移账与规模(期望:LEDGER 比上次 765 多 6 = 771;FIELDS/PANELS 以实测为准)
sqlcmd -S localhost -d HSDZ_MES -E -Q "SET NOCOUNT ON; SELECT COUNT(*) AS LEDGER FROM yj_schema_log; SELECT COUNT(*) AS FIELDS FROM yj_field; SELECT COUNT(*) AS PANELS FROM yj_panel;"

:: ② 打印记录两张表在(期望 2 行)
sqlcmd -S localhost -d HSDZ_MES -E -Q "SET NOCOUNT ON; SELECT name FROM sys.tables WHERE name IN ('bd_pu_print','bl_pu_print') ORDER BY name;"

:: ③ 明细行「手机照片」三列在(期望 3 行)
sqlcmd -S localhost -d HSDZ_MES -E -Q "SET NOCOUNT ON; SELECT t.name AS tbl, c.name AS col FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id WHERE c.name=N'手机照片' AND t.name LIKE 'rd_%_detail' ORDER BY t.name;"

:: ④ 手机照片字段登记到明细(期望 3 行 place=detail)
sqlcmd -S localhost -d HSDZ_MES -E -Q "SET NOCOUNT ON; SELECT panel_code, label, place, seq FROM yj_field WHERE label=N'手机照片' ORDER BY panel_code;"

:: ⑤ 材料码来源列在(期望 1 行)
sqlcmd -S localhost -d HSDZ_MES -E -Q "SET NOCOUNT ON; SELECT name FROM sys.columns WHERE name=N'来源打印单号' AND object_id=OBJECT_ID('dbo.bd_pu_label');"
```

外网复核(开发机就能跑):
`http://36.140.66.163:8090/` → 首页 chunk 应为 **`index-DNZKBlfG.js`**;
登录后「手机扫码 → 实验室记录手机登记」能打开,拍照上传的附件锚点为 `手机照片-<行id>`。

## 5. 回滚点

- 库:`C:\yinjia\backup\pre-deploy-<时间戳>.bak`(GO 流程自动打)
- 应用:`C:\yinjia\backup\app-<时间戳>.jar`(GO 流程自动留旧 jar;当前应役 `0d992f94…`)
- 回滚 = 停服务 → 拷回旧 jar → 需要时还原 .bak → 起服务;然后在 `deploy/部署台账.md` 记一条。

## 6. 记台账

部署完把 ① `app.jar` SHA256 ② 外网首页 `index-*.js` ③ `yj_schema_log` 行数 三条指纹发我,
我按《部署记录规范》在 `deploy/部署台账.md` 追加一行 + 一节(含被剔除脚本与理由、验收证据、回滚点)。
