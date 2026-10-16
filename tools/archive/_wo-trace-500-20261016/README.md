# 工单追溯 500 事故(2026-10-16)取证

## 事故形状(一句话)

**下架类迁移删了物理表,而正在运行的旧 jar 里的代码还在查那张表** ⇒ `/px/scheduleBoard/trace` 500
`Invalid object name 'dbo.qc_cut_insp_head'` ⇒ 「工单详情 · 追溯」弹窗里除「工序进度」(另一个接口)以外
**整片空白**,用户报「生产工单丢失了部分实现」。

## 时间线(本机 2026-10-16,均为本地时间)

| 时间 | 事件 |
|---|---|
| 02:04:08 | 打 `backend/target/yinjia-mes-backend-0.1.0.jar`(**含成型/切炭检验单代码**,class 里还有 `qc_cut_insp_head`/`finSpecGenerate`) |
| 02:04:28 | `tools/scripts/start-prod.ps1` 起 8090(pid 41248) |
| 02:05:03 | `migrate-drop-qc-mold-cut-finspec-20261016.sql` 经 DbSync 执行 ⇒ 物理删 `qc_{mold,cut}_insp_head/_detail`、`qc_fin_spec_head/_detail` |
| 02:11:44 | 提交 `ab1ad015` 把代码侧收敛(INSP_HEAD 只剩 `QC_ASM_INSP`、删 `finSpecGenerate`)—— **但服务没重打包重启** |
| 02:2x | 用户报障:追溯弹窗内容缺失 |

⇒ 根因不是"代码丢了",是**运行实例落后于源码**:旧 jar(`target` 里那份)在查已被迁移删掉的表。

## 影响面(旧 jar 里含已下架面板/表的 4 个类,均已在 `ab1ad015` 修好)

| 类 | 症状 |
|---|---|
| `ScheduleBoardService` | 追溯「质检段」SQL 500 ⇒ **整个 trace 接口 500**(本节事故) |
| `ButtonService` | 报工审核自动出单会去建已删面板(`QC_MOLD_INSP`/`QC_CUT_INSP`)、弃审联动同样;还留着 `finSpecGenerate` |
| `PanelConfigService` | 「检验项目/出货检验计划」维护入口集合含已删面板 |
| `QcInspPlanController` | 同上(入口权限集合) |

## 修法(本次采用)

后端 class 与前端静态**分开对待** —— 只换 class,前端一个字节不动(避免界面莫名变化):

```powershell
# 1) 在干净的 HEAD worktree 里打包(不碰工作区里未提交的 WIP)
git worktree add --detach D:\workspace\_yj-head-build <HEAD>
& tools\apache-maven-3.9.9\bin\mvn.cmd -q -s tools\settings.xml -f D:\workspace\_yj-head-build\backend\pom.xml -DskipTests package
# ⚠ worktree 里没有 .m2-repo(被 gitignore)⇒ 先把 worktree\.m2-repo 做成指向主仓 .m2-repo 的 junction,
#   否则要么从头下载依赖,要么踩 G9(G9 讲的就是这条)

# 2) 只把新 jar 的 BOOT-INF/classes(排除 static)覆盖到现役 jar 上
jar uf deploy.jar -C <overlay> BOOT-INF     # overlay 内是 BOOT-INF\classes\…(无 static)

# 3) 停 → 换 → 起(用 start-prod.ps1,它会先跑 DbSync)
tools\scripts\start-prod.ps1 -Stop      # 等到「进程没了 + jar 能独占打开」再动手(见 rebuild-prod.ps1)
Copy-Item deploy.jar backend\target\yinjia-mes-backend-0.1.0.jar -Force
tools\scripts\start-prod.ps1
```

修复后复核:`_q-trace-api.mjs`(trace 200 + 各段行数)、`_q-jar-classes.mjs`(jar 里不得再有已删表引用)。

## 复现/复核脚本

| 脚本 | 用途 |
|---|---|
| `_q-jar-classes.mjs` | **「这个 jar 是不是旧的」的判据**:扫描 jar 内 class 常量池,列出还在引用指定关键字(已删表/已下架面板)的类 |
| `_q-trace-api.mjs` | 8090 登录后按「工单号+工单行id」调 `/px/scheduleBoard/trace` 与 `/px/processTask/detail`,打印各段行数 |

用法见两脚本头部。
