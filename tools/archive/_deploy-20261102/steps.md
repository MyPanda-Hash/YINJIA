# pkg-incr-20261102 — 增量部署包（合并 origin/main 211 提交后首次上线）

> 执行手册：`deploy/部署说明.md` §二 B　·　记录格式：`docs/development/部署记录规范.md`
> 台账：`deploy/部署台账.md`（本次部署后必须追加）

## 1. 这个包解决什么

服务器现状（2026-11-02 实测）：

| 指纹 | 实测值 |
|---|---|
| `C:\yinjia\app.jar` SHA256 | `cd23c98f2d284d1d183bd1f146708b3c56cf57ce10698831e2e1e68707391411`（97,527,892 B，2026-11-02 10:07:49） |
| 前端入口 chunk | `assets/index-Cr3zj2Wh.js` |
| `yj_schema_log` / `yj_panel` / `yj_field` | 721 / 150 / 4837 |

也就是：**代码停在 2026-11-02 那次手工换 jar（规格书带入修复），库停在 2026-11-01 的
`pkg-incr-20261101`**。中间本地又合并了远端 211 个提交（手机扫码头、打印代理/二维码、
出厂检验报告、批量排产、工序流程追踪卡…），本次把代码补齐。

## 2. 包内容

| 项 | 值 |
|---|---|
| app.jar | 由合并后源码 `9fadcf63c` 重打（`build-appjar.ps1 -SkipFrontend`），内嵌前端入口 `index-J2kxqu6V.js` |
| 源码基线 | 仓库 HEAD `9fadcf63c`（`merge: 合并 origin/main(211 提交)到本地(2 提交)`） |
| 迁移脚本 | 清单 692 条全量随包（DbSync 只跑 to-run + baseline） |
| to-run | **6 条**（服务器台账缺这 6 条，全部 20261030 手机领料系列） |
| 自证工具 | `tools/verify/FourDocAudit.java`、`DbNormAudit.java`、`fourdoc-baseline.tsv` |

## 3. to-run 是怎么算出来的（不是猜的）

按「服务器 `yj_schema_log` 实测差集」算，不是按 git diff——因为起点不是某个提交，
而是「库停在 11-01 + jar 被手工换过」。实测：

```
server_logged = 721    manifest = 692
清单里服务器没有记录的 = 6 条
```

对 692 条逐条比 SHA-256，发现 335 条「哈希不一致」，但归一化后绝大多数能对上
（原样 357 / LF 归一 99 / CRLF 归一 223）⇒ 是**换行符口径差异**，不是内容变更。
归一化后仍对不上的是 **7 条**，全部已在 2026-11-01 的 `baseline` 里登记过
（`applied_at` 全是 2026-11-01 22:25:58~59），属于**历史陈旧哈希**，
按 11-01 同一处置：**只 baseline、不重跑**（重跑历史脚本正是 2026-10-05 事故的成因）。

**主动剔除（本条必须有理由，否则不算记录）**：
`migrate-drop-bak-snapshots-20261021.sql` 不在 to-run —— 它的闸门③要求「名单外不得有
`_bak_*`/临时表」，服务器实测有 40 张 `_bak_*`（含名单外的 `qc_*_bak_*`）⇒ 必然中止。
服务器台账里已有记录，本次由 `baseline` 维持，不重跑。

## 4. 打包前的闸

**闸一：强制重跑演练（2026-11-02 本机实测通过）**

```
node tools/verify/predeploy-rehearsal.mjs tools/archive/_deploy-20261102/to-run-20261102.txt
  HSDZ_MES       6/6 通过
  HSDZ_MES_TEST  6/6 通过
RESULT: REHEARSAL-OK
```

**闸二：字节变更脚本三查** —— 本次 to-run 的 6 条全为**新增脚本**（服务器从未执行过），
不存在「历史脚本重跑」风险：无 DROP+CREATE 视图、无内嵌四单取值、无对已下线列的引用。

## 5. 服务器操作（管理员 cmd，在解压后的包目录）

```cmd
deploy-production.bat            rem 只读体检，不改任何东西
deploy-production.bat GO         rem 停机 → 备份库 → 迁移 → 换 jar → 启动 → 登录验证
```

预期 `RESULT:` 序列：
`PACKAGE-OK` → `PREFLIGHT-OK` → `APP-STOPPED` → `BACKUP-GATE-PASSED` →
`MIGRATIONS-OK` → `NEW-JAR-IN-PLACE` → `APP-STARTED` → `LOGIN-OK` → **`ALL-OK`**

失败处置（不要图快重跑整包 `GO`）：停机态 + jar 未换 ⇒ 修脚本 → 打小补丁 → `GO APP` 只换包。

## 6. 回滚

```cmd
copy /y C:\yinjia\backup\app-<部署时间戳>.jar C:\yinjia\app.jar
schtasks /end /tn "YINJIA-MES" & schtasks /run /tn "YINJIA-MES"
```

库回滚 = 还原同批次 `C:\yinjia\backup\pre-deploy-<时间戳>.bak`（会丢掉这之后的业务写入，非必要不用）。
本次 6 条迁移都是**加列/加面板/加译名**，不删不改既有结构 ⇒ 不还原库也能跑回旧 jar。
