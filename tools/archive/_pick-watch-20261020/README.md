# 扫码领料「为什么还是写不进去」现场取证(2026-10-20)

> 用户口径:「当前领料似乎还是没能成功,我要如何查看,本地当前是不可能有数据的,你给出我如何操作我去服务器内查看」
>
> 这套东西**全在服务器上跑**,只读 + 只抓错误,不写任何业务数据(唯一会动的是一段内存里的抓取缓冲)。

## 一、状态快照(只读,先跑这个)

```bat
cd /d C:\yinjia\tools
watch-pick.bat state
```

不给 `watch-pick.bat` 的话,直接跑 SQL 文件也行:

```bat
sqlcmd -I -S localhost -E -d HSDZ_MES -f i:65001 -i _state.sql -W -s " | "
```

看四个数:

| 项 | 未解封时 | 解封 20 张后 | 含义 |
|---|---|---|---|
| 工单行 rid 仍压着流水 | ≈ **462** | ≈ **442** | 数字不动 ⇒ 那条解封命令没执行成功 |
| 900000000+ 号段行数 | **0** | **20** | 搬过去的流水行数 |
| 今日新增流水 | 0 | >0 | **>0 才说明小程序真的写进去了** |
| 目标 rid 复测 | BLOCKED | **PASS** | 库这层挡不挡 |

## 二、抓"到底报的什么错"(这才是关键)

小程序直连库,**它的报错不进 MES 日志**。用 SQL Server 的 Extended Events 抓:

```bat
watch-pick.bat start        :: 开始抓(只抓错误事件)
::   >>> 现在让现场在小程序上扫一次料(成功/失败都扫) <<<
watch-pick.bat read         :: 看抓到了什么
watch-pick.bat stop         :: 用完删掉
```

`read` 会打出:时间 / 错误号 / 错误消息 / 数据库 / 客户端程序 / 客户端主机 / 登录名 / **出错的那条 SQL 原文**。

判读:

| 抓到的错误号 | 含义 | 下一步 |
|---|---|---|
| **2601** `(6,1168,物料,批号)` | 还是撞唯一键 | 若 rid 还是小号 ⇒ 解封没执行;若物料批号与你扫的一致 ⇒ 小程序写了重复行 |
| **1934** | 连接的 `QUOTED_IDENTIFIER` 关了(`outh` 上有筛选索引) | 让小程序连接串加 `SET QUOTED_IDENTIFIER ON` |
| **229 / 230** | 没权限 | 给该登录 `db_datawriter` |
| **18456 / 4060** | 登录失败 / 打不开库 | 检查登录与默认库 |
| **547** | 约束冲突 | 看消息里的约束名 |
| **515** | 必填字段写了 NULL | 看 SQL 原文缺哪列 |
| **数据库 ≠ `HSDZ_MES`** | **小程序连的不是这台库** | 改它的连接串(最常见的"改了半天没用") |
| 一条都没抓到 | 它根本没连这台 SQL Server,或压根没发 INSERT(本地缓存/离线队列/调的是别的服务) | 用下面的 sessions 看谁连着 |

## 三、看"谁连着这台库"

```bat
watch-pick.bat sessions
```

`host_name` / `program_name` / `db_name` 三列里找小程序的:①它连的哪个库 ②用的哪个登录 ③是不是根本不在列表里(离线跑)。

## 四、文件清单

| 文件 | 作用 |
|---|---|
| `_state.sql` | 只读快照(§一) |
| `_xe_start.sql` | 建 + 启动抓取会话(ring_buffer 4MB,只抓 `error_reported` 里 18 类错误) |
| `_xe_read.sql` | 读抓取结果(§二) |
| `_xe_stop.sql` | 停 + 删会话 |
| `watch-pick.bat` | 上面四个 + sessions 的包装器 |

## 五、本机已验证

2026-10-20 在本机 SQL Server 2019 上跑通(非生产):建会话 → 故意造一条 2601 → `read` 完整拿到
`错误号 2601 / 库 HSDZ_MES / 客户端 Microsoft JDBC Driver for SQL Server / 主机 LAPTOP-UGODVADC / 登录 yinjia / 整条 INSERT 原文` → 删会话。
注意 XE 谓词**不支持 `IN(...)`**,只能用 `OR` 串(文件里已按这个写)。

## 六、权限

`sysadmin`(服务器上用 `sqlcmd -E` 以管理员身份跑即可)才能建服务器级事件会话;
若报「没有 ALTER ANY EVENT SESSION 权限」,换管理员身份开 cmd 再跑。


## 七、追加:抓「某个客户端到底执行了什么语句」(2026-10-20 13:2x)

现场发现:`sys.dm_exec_sessions` 里出现 **`sa` / `.Net SqlClient Data Provider` / 主机 `172.16.0.13` / 库 `HSDZ_MES`**
(最后请求 13:22:39、13:23:11)—— 即外部客户端连的**是这台库、这个库名**。
但错误抓取(`yj_pick_watch`)里**只有 SSIS 服务的 18456 噪声**,没有它的任何报错
⇒ 它的语句没失败 ⇒ 极可能"查了一下库存就结束,根本没发 INSERT"。

所以要看语句,不只看错误:

| 文件 | 作用 |
|---|---|
| `_xe_trace_start.sql` | 建并启动 `yj_pick_trace`:抓 `sql_batch_completed` / `rpc_completed`(带 sql_text/主机/客户端/登录/row_count) |
| `_xe_trace_read.sql` | 按主机过滤读出来(文件顶部 `@host`,默认 `172_16_0_13`) |

判读:
- 看到 `SELECT ... FROM kucun/v_stock_pick WHERE 批号 = ...` 且 `row_count = 0`,后面**没有 INSERT**
  ⇒ 确诊:条码批号与 `kucun` 实际批号对不上,小程序端判定"没库存",压根不写库;
- 看到 INSERT 但不报错 ⇒ 它写的是别的表/别的库(看 SQL 原文里的表名与库);
- 一条语句都没有 ⇒ 它连上来只是心跳。

语法坑(已在本机 SQL Server 2019 验证):多个 `ADD EVENT` 之间要有逗号,但 `ADD TARGET` 前**不能**有逗号。
