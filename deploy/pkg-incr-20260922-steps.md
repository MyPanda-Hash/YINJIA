# 热更新包 2026-09-22（增量：换 app.jar + 跑增量迁移，不动整库）

## 本包内容

| 文件 | 说明 |
|---|---|
| `app.jar`（113 MB） | 2026-09-22 13:17 构建，涵盖上次包（09-21 17:14）以来的全部改动 |
| `tools/db-migrations.txt` | 迁移清单（223 条；新增 5 条，见下） |
| `tools/*.sql` | 清单引用的全部脚本（98 处已改 USE 守卫形式） |
| `tools/DbSync.java` | 迁移执行器（**新增**：无条件 USE 目标库不符时拦截） |
| `deploy-incremental.bat` | 服务器一键脚本（7 步全闸：停→备→迁→查→换→起→验） |
| `apply-migrations.bat` | 单独跑迁移（不动 jar） |
| `probe-login.ps1` | 登录验收探针 |
| `SHA256SUMS.txt` | 完整性校验 |

## 自上次包（09-21 17:14）以来的改动

### 前端（已打进 jar 的 static）
- 立项申请表：标题「二三四级项目」、右侧可填「备注」列、行高按设计、密级默认「保密」
- 项目实施计划：标题、项目定级含「一级」、末行 负责人+编制日期 横向三格、行高按设计
- 项目进度查询：**14 列**（去掉 4 列）、原则段文案照设计原文、「适用范围」标签、密级默认「绝密」、
  项目编号列加宽 + 项目等级改为由实施计划带入（只读）
- 7 张数据记录表：报告头公司名/编号分列按设计原表切分 + 编号裸值（去「编号：」前缀）
- 10 个语言包：新增/替换词条（二三四级、密码相关等）

### 后端
- ButtonService：RD_PROGRESS 同步收敛为只写旧列（消掉双写）
- **密码哈希**：PBKDF2-HMAC-SHA256（仓库自写，yj1 格式）——存量 BCrypt 在登录成功时自动升级，
  **不需要库迁移**；用户无感知
- Sha256/YjPasswordEncoder/AuthController/MesApplication

### 数据库迁移（新增 5 条，全部幂等）

| 脚本 | 做什么 |
|---|---|
| migrate-material-inspection-field.sql | 商品·来料检验字段（bs_inv 补列 + 面板字段） |
| migrate-i18n-fix-zhtw-strength.sql | zh-TW 坏译名修复（U+FFFD 清除） |
| migrate-rd-approval-remark-field.sql | 立项申请「备注」字段登记（place=header） |
| migrate-rd-progress-drop-orphan-cols.sql | RD_PROGRESS 删 5 个孤儿列（带一致性闸门） |
| migrate-rd-progress-offsheet-cols.sql | RD_PROGRESS 4 列标 hidden（不上纸面，数据保留） |

### 基建
- 98 个 .sql 脚本的 `USE HSDZ_MES;` 改为守卫形式 `IF DB_NAME() = N'master' USE HSDZ_MES;`
  （不再静默切走目标库；DbSync 有拦截）
- DbSync.java：新增 target-DB 守卫（检出无条件 USE 且目标库不符 → exit 3）
- db-migrations.txt 清单整理：238→223 条（删 7 处重复登记 + 剔 8 个已中性化脚本）

## 服务器操作

解压到 **ASCII 目录**（如 `C:\yj-deploy\`，别解压到 `C:\yinjia\` 本身），管理员 cmd：

```cmd
:: 先跑 CHECK（只读）
deploy-incremental.bat

:: 确认无误后 GO
deploy-incremental.bat GO
```

只想换 jar 不动库：`deploy-incremental.bat GO APP`

验收：`powershell -File probe-login.ps1`（必须 LOGIN-OK）
