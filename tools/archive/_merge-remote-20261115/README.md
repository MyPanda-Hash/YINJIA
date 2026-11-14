# 2026-11-15 合并 origin/main 到本地(远程内容 + 本地内容双保留)

| 属性 | 内容 |
|---|---|
| 本地起点 | `19b22f9b7`(样品检验 feat + static 同步之后) |
| 远端 | `origin/main = 48d8e9ed6`(2026-11-13 16:02) |
| merge-base | `7a931556be28c1e0b00e1abaa94ae0843c805661` |
| 合并结果 | `c9c5426a6`(merge commit);本地 **84** 提交 + 远端 **191** 提交都在 |
| 备份分支 | `backup/pre-merge-20261115` → `19b22f9b7` |

## 一、拉取过程(网络异常与处置)

- 直连/系统代理到 `github.com` 均间歇失败(DNS 把 github.com 解析成 `20.247.166.64`,不可达;
  正确可达 IP=`20.205.243.166`)。小请求(`ls-remote`)时好时坏,大 pack 传输反复
  `Recv failure / early EOF / invalid index-pack`。
- 处置:改用 **partial clone** 拉取 ——
  `git -c http.proxy= -c http.sslBackend=openssl fetch --no-tags --filter=blob:none origin main`
  只取 commit+tree(几十 KB 级请求),成功拿到 `48d8e9ed6`;随后把缺的 **3653 个 blob**
  按每批 8 个(`git fetch origin <sha...>`,单请求很小)补齐,直到
  `git rev-list --objects --missing=print origin/main` 计数归 **0**。
  脚本:`fetch-blobs-loop.py`(本轮临时工具,依赖 python);`map-proxy.py` 是把
  github.com 映射到正确 IP 的本机 CONNECT 代理(本次未最终采用,留档备查)。
- 说明:仓库因此带上了 `remote.origin.promisor=true` / `core.repositoryformatversion=1`
  (partial clone 标记),但 origin/main 的全部对象**已齐**,离线可正常 build/merge;
  后续若再 fetch 仍会按需懒拉。

## 二、冲突(6 处)与解析口径

行尾差异(远端 LF / 本地 CRLF)先用 `merge.renormalize=true` 消掉,否则 PanelxList.vue 等
会整文件假冲突(实际语义改动仅 350+/43-)。真正冲突 6 处,一律「两侧内容都保留」:

| 文件 | 解析 |
|---|---|
| `ButtonService.java` | 本地 `assertFinishInInspLink` 门禁块 + 远端 `audit()` 自审/直审改造注释块,前后拼接 |
| `tools/db-migrations.txt` | 本地 14 条(11-11~11-15)+ 远端 43 条(11-10~11-13)**并集按日期归并** = 57 条;脚本名无交集、无重复 |
| `tools/db-inuse-tables.txt` | 本地 3 张样品检验表 + 远端 `v_qc_insp_rec_detail` 视图行,按登记键去重后并集 |
| `docs/development/数据库表清单.md` | 本地维护记录 v3.85~v3.97 保留;远端行**重新编号 v3.98~v3.111**(内容逐字未改,附说明) |
| `frontend/src/i18n/locales/zh-TW.js` | 两侧新增词条并集(行去重) |
| `backend/src/main/resources/static/index.html` | 暂取本地版,随后 `npm run build` 整体重建并同步 |

## 三、合并后校验(可复跑)

| 校验 | 结果 |
|---|---|
| 后端 `mvn -o -DskipTests compile` | **通过**(module class major 69 / JDK25) |
| 前端 `vite build` | **通过**(24.36s;PanelxList chunk 756KB 含两侧改动) |
| 前端单测 `node --test`(默认隔离) | **1937/1942 通过**;5 条失败均为 `recordSheetConfigs.livedb.test.js` 需要 `SQLCMD.EXE`(本机未安装)的活库测试 → 环境问题 |
| 合并后修补 | ① `railStatusTabs.test.js`:远端在右栏新增第三处 DocSelectRail(单据预览),原断言「恰好 2 处」改为「列表左栏 2 处绑 @tab + 预览不挂 tabs」;② `recordSheetAttachStrip.test.js`:读源码时归一化 CRLF(Windows 检出) |
| 清单卫生 | `db-migrations.txt` 793 条、无重复、脚本文件 **0 缺失** |
| 两侧功能标记 | 远端:`QcFlowController` / `ProductFlow.vue` / `deploy/winrm/*` / `previewRailBind` / 产品文件流程管控菜单;本地:`InspCommissionSheet.vue` / `SampleCatalogPickDialog.vue` / `qcSample` 菜单 / `assertFinishInInspLink` / 样品检验 3 表 —— **逐项在位** |
| `FourDocAudit` | 两账套均 `[FAIL] 偏离 231 处` —— 根因 = **远端 43 条迁移未在本机库执行**:缺的物理列(仓位编码/仓位名称/仓位id 等)正是 pending 的 `migrate-gen-wh-bin-prefill-20261113.sql` 要加的;基线文件已由远端更新。**执行完 pending 迁移后需重跑本闸** |
| `DbNormAudit` | 两账套与合并前一致(正式库 FAIL-3 存量:02/09/12),本次合并没有动库 |

## 四、⚠ 未执行:远端 43 条待执行迁移(需用户点头)

合并只改代码/文档,**没有**对数据库执行远端迁移。两账套各自的 pending(完全相同,43 条)见
`pending-HSDZ_MES.txt` / `pending-HSDZ_MES_TEST.txt`。其中两条必须单独决策:

1. **`migrate-org-from-server-20261111.sql`(不建议直接跑)**:它 `DELETE FROM yj_role_panel` 后
   重灌 2026-11-11 服务器备份的权限矩阵,只对 4 张历史面板做保留(LINE_CAP/QC_CUT_INSP/
   QC_FIN_SPEC/QC_MOLD_INSP)⇒ 直接执行会**抹掉 11-11 之后新增面板的授权行**(含本地
   `QC_LINE_PATROL`、本次 `SAMPLE_REG`/`INSP_COMMISSION`),即"本地内容丢失"。
   需要:重跑生成器(allowlist 补新面板)或执行后补授权,再跑。
2. `migrate-cleanup-non-kingdee-po-20261112.sql` 等数据清理脚本:脚本自带"单号写死/头数≤3/不得被下游引用"
   三道守卫,属于**有意的数据删除**,执行前建议先 `BACKUP DATABASE`。

建议执行顺序(获准后):
```bash
# 0) 先备份两账套
# 1) 除 org 外逐条 DbSync run(或把 org 从待执行集合里剔除后 DbSync sync)
cd tools
java -cp lib/mssql-jdbc.jar DbSync.java run <script>          # 正式库
YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib/mssql-jdbc.jar DbSync.java run <script>
# 2) 全部跑完:DbSync sync 到「执行 0、失败 0」,再复跑 FourDocAudit / DbNormAudit
```

## 五、本目录文件

- `pending-HSDZ_MES.txt` / `pending-HSDZ_MES_TEST.txt` —— 两账套待执行迁移清单(43 条)
- `fourdoc-audit-*.txt` / `dbnorm-audit-*.txt` —— 合并后只读体检输出(待补)
- `fetch-blobs-loop.py` / `map-proxy.py` —— 拉取期的网络处置脚本(留档)
