# 拉取合并 origin/main 的取证与验证(2026-11-03)

任务口径:「当前远程存在新提交,拉取合并到本地,确认远程和本地内容都能正常运行」。

## 1. 拉取:git 的 schannel 在本机沙箱里拿不到凭证

`git fetch` 一开始直接失败:

```
fatal: unable to access 'https://github.com/MyPanda-Hash/YINJIA.git/':
schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS (0x8009030e)
```

`curl` 同样报 schannel 失败;走 `http.proxy=http://127.0.0.1:7890` 也一样。
**不是网络/代理的问题,是 Windows schannel 取不到凭证**(沙箱内进程访问不到用户证书库)。
绕法:给 git 换成 OpenSSL TLS 后端即可(只对本条命令生效,不改全局配置):

```powershell
git -c http.sslBackend=openssl fetch origin
git -c http.sslBackend=openssl push            # 推送同理
```

拉到的远端 6 个提交(2026-11-03 14:37~14:41):

| 提交 | 内容 |
|---|---|
| `09c3b3b5d` | 打印代理加 Private Network Access 许可 |
| `09910137f` | 打印代理自己去服务器拉任务(绕开浏览器禁用 localhost) |
| `8f1f84657` | 安装脚本改成填服务器地址(代理自拉任务模式) |
| `df7ed14b8` | 自动打印页不再把「代理未连接」当故障 |
| `c7cea084b` | 把三个漏登记的迁移补进清单 |
| `880fbac54` | 远端自己的 merge 提交 + 静态产物 |

本地领先 3 个提交(`7c6fbfce8` 不合格报告填写人默认登录人、`53869b1cc` 静态同步、
`ad147bb5b` 工单追溯图例改「黑=进行中」)。

## 2. 合并:源码 0 冲突,181 处冲突全在构建产物

```
git stash push -- tools/db-migrations.txt          # 唯一会被合并覆盖的未提交文件
git merge --no-commit --no-ff origin/main
```

- 冲突 181 处,**全部在** `backend/src/main/resources/static/`(双方各自重打包过,
  哈希文件名完全不同),源码冲突 0 处。
- 按仓内既定做法(上一个 merge 提交 `880fbac54` 也是这么处理的):**删掉 static 目录,
  用 `frontend/dist` 重建**:

```powershell
Remove-Item backend\src\main\resources\static -Recurse -Force
Copy-Item frontend\dist\* backend\src\main\resources\static -Recurse -Force   # 159 文件
```

- `tools/db-migrations.txt` 远端重排 + 新增 2 条登记
  (`migrate-wo-pick-line-20261101.sql` / `migrate-wo-pick-return-cleanup-20261030.sql`),
  两个脚本文件都在仓里;本地那行未提交的 `migrate-drop-bak-qc-snapshots-20261102.sql`
  合并后原样还原(仍是未提交改动,没被卷进合并提交)。

## 3. 验证结果

| 项 | 结果 | 说明 |
|---|---|---|
| 前端构建 `npm run build` | ✅ 19.43s,159 文件 | 沙箱下 vite/esbuild 会 `spawn EPERM`(命名管道被拒),需放开一次沙箱 |
| 前端测试 `npm test`(标准按文件隔离) | 1428 pass / **5 fail** | 5 条全是 `recordSheetConfigs.livedb.test.js`,原因是**本机没有 `SQLCMD.EXE`**(`...\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE` 不存在)⇒ 环境缺件,与本次合并无关 |
| 同上,工作区绕过沙箱跑 | 同上 | 1414 pass / 19 fail 是 `--experimental-test-isolation=none` 的**跨文件状态串扰**造成的假红:print 相关 14 条单独跑全绿(`print-formats` 13/13、`wo-qr` 7/7、`printChannel` 3/3) |
| 后端 | 未改任何 Java 源码 | 远端 6 提交只动前端 / PS 脚本 / 迁移清单;8090 登录 200、追溯接口 200(返回 GD-2026-11-0008 头+时间线) |
| 5173 源码服务 | ✅ | `PrintStation.vue` 含远端新文案「由打印电脑自行取任务…」、`WorkOrderTraceDialog.vue` 含本地改动「黑=进行中」 |
| 打印代理脚本语法 | ✅ 3/3 | `deploy/print-agent/print-agent.ps1`、`deploy/print-agent/安装.ps1`、`tools/printing/print-agent.ps1` 用 `[Parser]::ParseFile` 全过 |
| static/index.html 引用 | ✅ refs=7 missing=0 | 重建后的产物自洽 |
| 活库只读核对(见 `_q-db-state.java`) | ⚠ 有缺口 | `wo_pick_line` **缺失**、`migrate-wo-pick-line-20261101` **未登记**、`migrate-wo-pick-return-cleanup-20261030` 未登记;正是远端 `c7cea084b` 自己点名的缺口 |

## 4. 仍未做(需要人拍板)

活库 `HSDZ_MES` 缺 `wo_pick_line`(手机扫码·生产领料要用),这是**合并前就存在**的缺口,
远端只是把它补登记进清单。要修需在两个账套各跑一次(先正式后测试):

```powershell
cd tools
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-wo-pick-line-20261101.sql
YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\mssql-jdbc.jar DbSync.java run migrate-wo-pick-line-20261101.sql
```

⚠ 不要图省事跑 `DbSync sync`:内容哈希对不上的历史脚本会被判「未登记」而**重跑**,
历史上踩过重放旧脚本把四单字段盖回去的事故(见 AGENTS「迁移链卫生」)。

## 5. 复现命令

```powershell
# 只读核对活库
java -cp tools\lib\mssql-jdbc.jar tools\archive\_merge-verify-20261103\_q-db-state.java

# 前端(沙箱外)
cd frontend; npm run build; npm test
```
