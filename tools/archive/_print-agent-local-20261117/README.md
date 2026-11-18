# 本机打印代理改连「本地 8090 + 测试库 YJ_TEST」— 2026-11-17

> 用户口径:「把本地系统的代理打开。」(确认后选 A:打印代理改成连本地系统并重启)

## 一、改了什么

`deploy/print-agent/print-agent.config.json`(该文件 **.gitignore 忽略**,机器本地配置,含口令,不入库):

| 键 | 改前 | 改后 |
|---|---|---|
| `server` | `http://36.140.66.163:8090`(服务器) | **`http://127.0.0.1:8090`**(本地) |
| `factory` | `YJ`(正式库 HSDZ_MES) | **`YJ_TEST`**(测试库 HSDZ_MES_TEST) |
| 其余 | `user=admin` / `pass=123456` / `station=DESKTOP-JHUNFT6` / `port=18777` / `mode=Auto` / `printer=Kyocera ECOSYS M8124cidn` | 未动 |

回滚 = 把 `server`/`factory` 改回上表两行,再跑 `powershell -NoProfile -ExecutionPolicy Bypass -File start-agent.ps1 -Restart`。

## 二、重启与现状(2026-11-17 15:57)

用官方补启动脚本重启(它同时校验 `/health`、轮询心跳、自启项、守护任务):

```powershell
cd D:\YINJIA-main\deploy\print-agent
powershell -NoProfile -ExecutionPolicy Bypass -File start-agent.ps1 -Restart
```

结果:

| 项 | 值 |
|---|---|
| 进程 | PID **34204**(旧 18972 已被 -Restart 结束),11-17 15:57:36 起 |
| 监听 | `http://127.0.0.1:18777/`(`/health` 通,打印机 = Kyocera ECOSYS M8124cidn,领任务=True) |
| 轮询 | 每 4 秒一次,**已登录 `http://127.0.0.1:8090`(站点 DESKTOP-JHUNFT6)**;心跳文件 `poll-heartbeat.txt` 持续在动(15:58:48 → …) |
| 测试库站点配置 | `print.station.DESKTOP-JHUNFT6.enabled = Y`;**类型 = PICK_SLIP, OTHER_PICK_SLIP, OTHER_RET_SLIP, MAT_RET_SLIP, MIX_SLIP**(含混料单);纸张 A4 横 |
| 接口复核 | `GET /api/px/print/station`(YJ_TEST)→ `stations[0] = {name: DESKTOP-JHUNFT6, online: true, enabled: true, types: [… MIX_SLIP], lastSeen: 2026-11-17 15:58:15, source: agent, ip: 127.0.0.1}` |
| 队列 | `queueSize = 0`、缓存 0(干净) |

界面复核(`http://localhost:5173/#/sys/printStation`,ego 浏览器,见 `printStation.png`):
「打印电脑 1 · DESKTOP-JHUNFT6 **在线** · 最近心跳 2026-11-17 15:58:56 · 来源 IP 127.0.0.1 · 纸张 A4 横 · 5 种报表全勾(含混料单)」,两个开关都是开。

## 三、现在能测什么

手机端(或网页)触发打印,这台电脑就会自动出纸:

- **扫码混料 → 整单保存** ⇒ 自动打「混料单」(A4 横板《成型配料记录》);
- 生产领料/其他领料/其他退料/生产退料提交 ⇒ 对应单据(类型都已勾选);
- 重扫工单进「补打印」 ⇒ 再打一遍。

⚠ 两个前提别踩:

1. 代理登录的是 **测试库 YJ_TEST** —— 只有测试库的单会打到这台机器;要在正式库上出纸,把 `factory` 改回 `YJ` 并重启。
2. 打印机名是 `Kyocera ECOSYS M8124cidn`(本机已装);打印机不可用时代理会**自动存成 PDF**(见代理目录 `print-out\`)。

## 四、本目录文件

| 文件 | 内容 |
|---|---|
| `round-01.mjs` / `printStation.png` | ego 浏览器打开「自动打印」页取状态 + 截图 |
| `round-02.mjs` | 收尾 `task.finish` |
