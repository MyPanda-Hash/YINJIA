# 设备配置管理 —— 测试账套 129 台设备「五连」拉满(2026-10-20)

> 两步:**先绑定网关**(第一轮用户口径),**再把五连后四项补齐**(第二轮「这些都设定为完成」)。
> 两个脚本都只允许在 `HSDZ_MES_TEST` 执行,正式账套零改动。

## 一、用户要求与口径

### 第一轮:绑定网关

用户给的截图(`设备配置管理` 页,测试账套)上标了两处:

1. 汇总卡「已绑定网关 0」→ **改为 129**;
2. 列表「网关」列每行的 `未绑定` 标签 → **改成已绑定**。

原话:**「将当前所有都进行完成绑定」**(并明确「上述内容在测试库中,不是正式库」)。

判据(源码 `DcService#checks`):五连检查第一项「绑定网关」= `bs_dc_device.gateway_id` 非空,
所以「绑定」就是写 `gateway_id`,不另存标记。测试库里**一间网关都没有**(网关数量 0),
没有网关无从绑定 ⇒ 先补建一个台账网关 `DC-GW-01`,再把 129 台设备全部绑上去。

### 第二轮:五连后四项全绿

用户圈住「五连检查」列里剩下的四个 ✗ 说 **「这些都设定为完成」** ⇒ 按判据补齐
数采工程 / 绘制组态 / 数采规则 / 数据调试,让 `配置齐备 = 129`、完成度 = 100%。

## 二、改了什么

| 对象 | 变化 |
|---|---|
| `bs_dc_gateway` | 新增 1 行:`DC-GW-01` / 车间数采网关01 / MQTT(地址、端口留空,接硬件时在界面维护) |
| `bs_dc_device` | 129 行 `gateway_id` → 该网关(原来全是 NULL) |
| `bs_dc_device.project_code` | 129 行 ← `DC-PROJ-<设备编码去横线>`(如 `DC-PROJ-LW053`),便于按设备回查 |
| `bs_dc_device.scada_drawn` | 129 行 ← `'Y'` |
| `bs_dc_rule` | 新增 129 行(每台设备 1 条 `定时采集(默认)`,`enabled='Y'`,params 注明"占位,接硬件后按实际协议调整") |
| `bs_dc_device.last_debug_at` | 129 行 ← `SYSDATETIME()`(等价于界面「标记调试完成」;LW-053 用户已先点过,故实际更新 128 行) |

**没动**:采集点(`bs_dc_point` 仍为 0 —— 五连不校验采集点)、设备在线状态、报警/流水。

## 三、验证(全部实测)

```powershell
# 1) 第一步:绑定网关(JDK 25;口令走 YINJIA_SQL_PASS 或直接传参)
cd tools
java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar SqlRunner.java `
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true" `
  yinjia <口令> archive\_dc-bind-all-20261020\migrate-dc-bind-all-test-20261020.sql
#   → 设备总数 129 / 已绑定网关 129 / 绑定到 DC-GW-01 129 / 本次更新 129 行

# 2) 第二步:五连后四项拉满(同一个连接串,换脚本)
#   → ①绑定网关 129 / ②数采工程 129 / ③绘制组态 129 / ④数采规则 129 / ⑤数据调试 129

# 3) 幂等复跑两个脚本 → 更新 0 行 / 插入 0 行(结果不变)
# 4) 硬闸门:把连接串换成 databaseName=HSDZ_MES 再跑 → [拒绝] 并 exit 1,正式账套零改动
#    (核对:正式账套仍是 网关 1 / 设备 3 / 已绑定 1)
```

> 踩坑留痕:第二步的自检 `SELECT` 一开始没给数值列 `CAST`,第一分支是 int、
> 后面的中文串被 SQL Server 按类型优先级往 int 转,报
> `Conversion failed when converting the nvarchar value '129 / 129 / 129 / 128' to data type int`。
> 语句本身是自动提交的,**数据已生效、只有汇总 SELECT 失败**;补 CAST 后复跑即 0 变更通过。

活体复核(`node _q-api-bind.mjs`,走现役接口、测试账套登录):

```
数据库账套: YJ_TEST
设备总数: 129 已绑定网关: 129 未绑定: 0
配置齐备: 129
网关: DC-GW-01#1 车间数采网关01 dev=129
前 3 行: LW-053 gw=车间数采网关01 progress=100% ; LW-054 ... 100% ; LW-093 ... 100%
```

页面截图(headless Edge + CDP,`_q-dc-config-shot.cjs` 产出):

| 截图 | 汇总卡 | 行状态 |
|---|---|---|
| `_dc-config-2026-10-20T07-07-17.png` | 129 / **129** / 0 / 129 / 1 | 网关=车间数采网关01,五连仅第 1 项 ✓,20% |
| `_dc-config-2026-10-20T07-13-11.png` | 129 / **129** / **129** / **0** / 1 | 五连全 ✓,100%,缺失提示=「配置齐备」,数采规则=1 |

## 四、文件

| 文件 | 用途 |
|---|---|
| `migrate-dc-bind-all-test-20261020.sql` | 第一步:建网关 + 129 台设备绑定(**库名硬闸门**) |
| `migrate-dc-complete-five-20261020.sql` | 第二步:工程/组态/规则/调试四项补齐(同硬闸门) |
| `_q-state.sql` | 改动前取证:129 台设备、0 网关、0 规则、各项 0 |
| `_q-prod-guard.sql` | 改动后复核正式账套未被波及 |
| `_q-api-bind.mjs` | 走接口复核绑定与完成度 |
| `_q-dc-config-shot.cjs` | 扫页面 + 截图(`_dc-config-*.png`) |
| `_dc-config-*.png` | 页面截图证据(前后各一张;`*.png` 被 .gitignore,只留本地) |

> 两个脚本都**不**进 `tools/db-migrations.txt` 迁移链 —— 它们是测试账套的演示数据,
> 进了链会被 `DbSync` 带到正式账套(那里只有 3 台设备 + 真机 DZ-001,不该被批量拉满)。
