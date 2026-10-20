# 设备配置管理 —— 测试账套 129 台设备批量绑定网关(2026-10-20)

## 一、用户要求与口径

用户给的截图(`设备配置管理` 页,测试账套)上标了两处:

1. 汇总卡「已绑定网关 0」→ **改为 129**;
2. 列表「网关」列每行的 `未绑定` 标签 → **改成已绑定**。

原话:**「将当前所有都进行完成绑定」**(并明确「上述内容在测试库中,不是正式库」)。

判据(源码 `DcService#checks`):五连检查第一项「绑定网关」= `bs_dc_device.gateway_id` 非空,
所以「绑定」就是写 `gateway_id`,不另存标记。测试库里**一间网关都没有**(网关数量 0),
没有网关无从绑定 ⇒ 先补建一个台账网关 `DC-GW-01`,再把 129 台设备全部绑上去。

## 二、改了什么

| 对象 | 变化 |
|---|---|
| `bs_dc_gateway` | 新增 1 行:`DC-GW-01` / 车间数采网关01 / MQTT(地址、端口留空,接硬件时在界面维护) |
| `bs_dc_device` | 129 行 `gateway_id` → 该网关(原来全是 NULL) |

**没动**「数采工程 / 绘制组态 / 数采规则 / 数据调试」四项 —— 它们仍是 ✗,完成度 20%,
`配置齐备` 仍是 0。要补齐这四项是另一件事(等于给 129 台设备造工程号、组态标记、
规则行和调试时间),需用户确认后再做。

## 三、验证(全部实测)

```powershell
# 1) 执行(JDK 25;口令走 YINJIA_SQL_PASS 或直接传参)
cd tools
java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar SqlRunner.java `
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true" `
  yinjia <口令> archive\_dc-bind-all-20261020\migrate-dc-bind-all-test-20261020.sql
#   → 设备总数 129 / 已绑定网关 129 / 绑定到 DC-GW-01 129 / 本次更新 129 行
# 2) 幂等复跑 → 本次更新 0 行(结果不变)
# 3) 硬闸门:把连接串换成 databaseName=HSDZ_MES 再跑 → [拒绝] 并 exit 1,正式账套零改动
#    (核对:正式账套仍是 网关 1 / 设备 3 / 已绑定 1)
```

活体复核(`node _q-api-bind.mjs`,走现役接口、测试账套登录):

```
数据库账套: YJ_TEST
设备总数: 129 已绑定网关: 129 未绑定: 0
配置齐备: 0
网关: DC-GW-01#1 车间数采网关01 dev=129
```

页面截图 `_dc-config-2026-10-20T07-07-17.png`(headless Edge + CDP,`_q-dc-config-shot.cjs` 产出):

- 汇总卡:`设备总数 129 / 已绑定网关 129 / 配置齐备 0 / 未完成 129 / 网关数量 1`;
- 每行「网关」列 = `车间数采网关01`,五连第一项 ✓ 变绿,完成度 20%。

## 四、文件

| 文件 | 用途 |
|---|---|
| `migrate-dc-bind-all-test-20261020.sql` | 一次性数据脚本(**库名硬闸门**:只允许 `HSDZ_MES_TEST`) |
| `_q-state.sql` | 改动前取证:129 台设备、0 网关、0 规则、各项 0 |
| `_q-prod-guard.sql` | 改动后复核正式账套未被波及 |
| `_q-api-bind.mjs` | 走接口复核绑定结果 |
| `_q-dc-config-shot.cjs` | 扫页面 + 截图(`_dc-config-*.png`) |
| `_dc-config-2026-10-20T07-07-17.png` | 页面截图证据 |

> 本脚本**不**进 `tools/db-migrations.txt` 迁移链 —— 它是测试账套的演示数据,
> 进了链会被 `DbSync` 带到正式账套(那里只有 3 台设备,不该被批量绑定)。
