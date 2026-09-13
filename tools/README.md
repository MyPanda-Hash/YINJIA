# tools/ — 数据库迁移链与工具脚本

| 属性 | 内容 |
|---|---|
| 文档类型 | 目录说明 |
| 适用场景 | 数据库同步、部署打包、面板/翻译数据生成、回归验证 |
| 维护状态 | 生效(2026-09-13 目录归类整理) |

## 目录结构

```
tools/
├── (根层·平铺)     迁移链:全部 *.sql + db-migrations.txt(唯一权威顺序)
│                    + DbInit/DbSync/SqlProbe/SqlRunner.java + lib\(JDBC 驱动)
│                    + settings.xml(Maven 镜像) + package.json(cjs 依赖)
│                    + pull-sync.bat(git pull + DbSync 增量同步)
├── scripts/         正式运维脚本:verify-api.ps1、audit-*.ps1、trigger-mt.ps1、
│                    enable-mixed-auth.ps1、build-hot-update.ps1、start-backend.bat 等
├── gen/             历史数据生成器 gen-*.{cjs,py} + 数据文件(*.tsv/*.jsonl)
├── verify/          验证/冒烟/审计:*-smoke.cjs、*-test.cjs、i18n-verify-*.cjs、
│                    menu-check*.cjs、analyze-panels.cjs、architecture-audit.mjs
└── archive/         一次性探针与任务产物(_ 前缀,入库保档;历史会话的诊断脚本)
```

外加两个**不入库**的本地工具链目录:`apache-maven-3.9.9/`(后端构建用,见根目录
`build-appjar.ps1`)与 `node_modules/`(cjs 脚本依赖 ws/opencc-js)。

## 为什么迁移 SQL 平铺在根层

`DbSync.java` 按**当前工作目录**解析 `db-migrations.txt` 与清单内脚本文件名;
`deploy/make-deploy-package.ps1` 非递归拷贝 `tools\*.sql` 进部署包;服务器侧
`C:\yinjia\tools\` 保持同样平铺布局。三处强耦合,因此迁移链**不进子目录**,
新增迁移照旧:写 `tools/migrate-xxx.sql` → 登记进 `db-migrations.txt`。

## 使用速查

| 场景 | 命令(在 tools/ 目录下) |
|---|---|
| 拉取代码 + 增量同步数据库 | `pull-sync.bat`(内部 `java -cp lib\mssql-jdbc.jar DbSync.java`) |
| 全量初始化 | `java -cp lib\mssql-jdbc.jar DbInit.java`(按同一清单) |
| 临时查询 | `java -cp lib\mssql-jdbc.jar SqlProbe.java` / `SqlRunner.java` |
| API 全链路回归 | `powershell -File scripts\verify-api.ps1`(需后端已启动) |
| 面板配置/条件冒烟 | `scripts\audit-panels.ps1`、`scripts\audit-conditions.ps1` |
| UI 冒烟(CDP) | `node verify\panels-ui-smoke.cjs`(在 tools/ 下运行,依赖 node_modules) |
| 热更新包(仅后端 class) | `pwsh -File scripts\build-hot-update.ps1`(在仓库根或见 deploy/部署说明.md) |
| 生成器重跑 | `node gen\gen-xxx.cjs`(历史迁移数据生成,一般不重跑;重跑前先读脚本内注释) |

## archive/ 约定

- 会话/任务产生的一次性探针(CDP 走查、DOM 对齐检查、e2e 一次性脚本)、
  诊断输出,统一以 `_` 前缀写入 `tools/archive/`,随所属任务 commit 入库。
- tools 根层的 `_*` gitignore 规则保留作防线,防止再往根层丢临时文件。
- `archive/_walk/`(源 Excel/Word 提取文本)、`archive/_spec-images/`(截图)、
  `archive/_flow-v12/`(设计底稿资料,正式设计文档已移 docs/design/)为历史任务原始素材。
