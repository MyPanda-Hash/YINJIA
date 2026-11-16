# 打印代理「会掉」排查 + 自愈改造(2026-11-16)

**触发**:用户报障(2026-11-16 12:00 前后,原话)
> 「打印代理的脚本是会掉的吗?我看见客户那边的打印机已经不显示了。」

---

## 一、先查现场(只读,线上正式服务器 `36.140.66.163:8090`)

登录 `admin` 后 `GET /api/px/print/station`(不带 `station` 参数 —— 带了会顺手写心跳,把"离线"洗成"在线",反而误判):

```json
{"stations":[
  {"name":"111","enabled":false,"online":false,"lastSeen":""},
  {"name":"DESKTOP-JHUNFT6","enabled":false,"online":true ,"source":"agent","lastSeen":"2026-11-16 12:02:15"},
  {"name":"ckdy","enabled":true ,"online":false,"lastSeen":""}
]}
```

| 站点 | 是什么 | 结论 |
|---|---|---|
| `ckdy` | **客户那台打印电脑**(开关=开、勾了生产领料单) | `online=false` 且 `lastSeen` 为空 ⇒ 服务端**一点心跳都没收到**(进程没跑 / 参数不对 / 网络不通) |
| `DESKTOP-JHUNFT6` | 开发机自己跑的代理(`deploy/print-agent`,指向正式服务器) | 在线,但开关是关的 ⇒ 不会抢单;建议别在正式服务器上挂着 |
| `111` | 早期测试登记的占位 | 开关关、从没连过,无害 |

> 「面板上不显示」的规则(代码事实 `PrintStationController.sweep()` + `stationList()`):
> 站点清单 = **内存里的** ∪ **库里有 `print.station.<名字>.enabled` 配置的**;
> 内存条目 **30 分钟没心跳就被清掉**;库里也没配置 ⇒ 那一行**彻底消失**;
> 库里有配置 ⇒ 永远留一行灰的「离线」。

## 二、为什么"会掉"(代码走读,改前)

1. 唯一启动点 = `HKCU\...\Run`,**只在这个用户登录时起一次**;注销/换用户/重启后没人登录 ⇒ 不起;
2. 一个 powershell 进程 = 主线程(HTTP 监听)+ `Start-Job`(轮询);**没有任何看护/重启**;
3. 主线程 `GetContext()` 抛一次异常 → 顺着 `finally` 收尾 → **整个进程退出**(旧的 `while ($listener.IsListening)`);
4. **最隐蔽**:轮询作业死了,但 `/health` 照样 200 ⇒ 本机看"代理在跑",面板看"离线",日志里什么都看不到
   (旧版作业的 `Write-Output` 全进了没人读的作业流,`agent.log` 里没有任何轮询痕迹);
5. 2026-11-10 起自启只传 `-File`,参数全在 `print-agent.config.json`;
   **配置丢了/被搬走 ⇒ 没有 `-Server` ⇒ 永远不领任务,而且一声不响**。

## 三、改了什么

| 文件 | 改动 |
|---|---|
| `deploy/print-agent/watchdog.ps1` | **新增**。三查:①`/health` 不通→拉起(照抄自启项整串参数,老机器不丢 `-Server`);②`poll=false` / `poll-heartbeat.txt` 超 3 分钟→重启;③一小时动作 5 次仍不好→停手并记「请人工处理」。全程只写 `watchdog.log`,一切正常时每小时一行 |
| `deploy/print-agent/watchdog-hidden.vbs` | **新增**。`wscript` 隐藏启动 watchdog(`-WindowStyle Hidden` 每分钟会闪黑窗);纯 ASCII |
| `deploy/print-agent/diagnose.ps1` + `诊断.bat` | **新增**。客户双击 → 出 `诊断.txt`:文件齐否 / 自启项(密码打码) / 守护任务状态 / 进程 / `/health` / 轮询心跳 / **服务器视角清单** / 打印机 / 两段日志 / 自动结论。只读,且查站点清单时不写心跳 |
| `deploy/print-agent/print-agent.ps1` | ①轮询作业输出改落 `agent.log`(带时间戳、按错去重)+ 每轮刷新 `poll-heartbeat.txt`;②`/health` 增加 `server`/`station`/`poll`;③监听循环单次异常不再退出(连续 20 次才退),监听器失效会自动重建;④没有服务器地址时启动即告警 |
| `deploy/print-agent/安装.ps1` | 安装末尾注册计划任务 `YinjiaMesPrintAgent-Watch`(每 1 分钟、当前用户、`/IT`、`schtasks /create`,**不需要管理员**),注册完立刻跑一次;删掉从未使用的 `$argParts` 死代码 |
| `deploy/print-agent/卸载.ps1` | **先注销守护任务**再结束进程(否则 1 分钟后又被拉起来) |
| `deploy/print-agent/说明.md` | 新增 §十一「代理会"掉"吗」、§十二「双击诊断.bat」;Q1 补自愈说明 |
| `.gitignore` | 忽略运行时文件 `poll-heartbeat.txt` / `watchdog-last.txt` / `诊断.txt` / `print-out/` |
| `deploy/yinjia-print-agent.zip` | 重新打包 11 个文件(不含配置/日志/PDF) |

## 四、验证证据(本机 DESKTOP-JHUNFT6,Windows PowerShell 5.1)

| 场景 | 操作 | 结果 |
|---|---|---|
| 语法 | `parse-check.ps1` 扫全部 `.ps1`(`[Parser]::ParseFile`) | 6/6 `[PASS]`,均 UTF-8 **with BOM** |
| 安装 | `安装.ps1 -Server http://36.140.66.163:8090 … -Station DESKTOP-JHUNFT6` | 配置/自启/任务全 OK;`schtasks /query` 显示 `Repeat: Every 1 Minute`,`Last Result: 0` |
| **进程被杀** | `Stop-Process` 杀代理 | 守护 **8 秒**拉起;`/health` = `"ok":true,"poll":true` |
| **轮询作业死**(最隐蔽) | 杀掉代理的作业子进程(只剩主线程) | `/health` 仍 `ok:true` 但 `"poll":false`;守护判定「轮询已停」→ 重启 → 恢复 `poll:true` |
| 守护任务自发运行 | 不手工触发,等整分钟 | `watchdog-last.txt` 每分钟刷新;`watchdog.log` 一切正常时每小时一行 |
| 诊断脚本 | `powershell -File diagnose.ps1` | 产出 `诊断.txt`,第 7 段列出服务器上三台站点的在线/开关;**只读**,站点清单未被自己洗成在线 |
| 分发包 | `Compress-Archive` 重打 zip → 解压到 `D:\_tmp-verify\MES打印\print-agent` | 中文文件名 + BOM + 语法 6/6 `[PASS]` |

`watchdog.log` 实测片段:

```
2026-11-16 12:12:18  [守护] 代理跑了 10 分钟却从没出现过轮询心跳(轮询作业没起来?) ⇒ 重启代理
2026-11-16 12:12:18  [守护] 已结束旧代理进程 PID 5008
2026-11-16 12:12:23  [守护] 代理已重启
2026-11-16 12:16:11  [守护] 代理没在运行 ⇒ 重启代理
2026-11-16 12:16:36  [守护] /health 正常但轮询已停(poll=false) ⇒ 重启代理
2026-11-16 12:16:39  [守护] 代理已重启
```

## 五、复跑方法

```powershell
cd D:\YINJIA-main\deploy\print-agent
# 1 语法闸(任一 FAIL 就别发给客户)
powershell -NoProfile -ExecutionPolicy Bypass -File ..\..\tools\archive\_print-agent-watchdog-20261116\parse-check.ps1 -Dir .
# 2 状态一行摘要
powershell -NoProfile -ExecutionPolicy Bypass -File .\watchdog.ps1 -Status
# 3 自愈实测:杀掉代理 → 1 分钟内应回来,且 /health 里 poll=true
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -match 'print-agent\.ps1' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Invoke-WebRequest http://127.0.0.1:18777/health -UseBasicParsing | Select-Object -Expand Content
```

## 六、还没做 / 注意

- **客户那台机器没碰过**:要恢复 `ckdy` 出纸,得在那台电脑上把新文件夹拷过去、重跑一次 **`安装.bat`**
  (会写 `print-agent.config.json` + 自启 + 守护任务);装完先双击 **`诊断.bat`**,把 `诊断.txt` 发回来核对站点名是不是 `ckdy`。
  只换 `print-agent.ps1` 而**不重装**也可以(守护任务不会自动出现),那样只能靠自启那一次。
- 守护任务 `/IT`,**只在有登录会话时跑**(打印本来就要登录会话与打印机映射);"没人登录也打印"要服务化,未做。
- 开发机(`DESKTOP-JHUNFT6`)的代理仍在轮询**正式服务器**,开关是关的(不会抢单),但会在客户面板上多一行;
  不需要时双击 `卸载.bat` 即可。
- 本次改动**不涉及**数据库/面板/前端,不需要跑两账套与多语言验收。
