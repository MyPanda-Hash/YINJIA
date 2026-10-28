# 2026-10-28 「新工序也能选产线」取证(测试账套)

对应代码:`ProcessShop.hasFixedShop` + `ProcessTaskService.requiredShop` +
`frontend/src/business/routeDefaults.js: lineOptions`。
对应文档:`docs/design/生产流程-现役实现.md` **§2.2**。

## 问题

工序不在 `ProcessShop` 的登记表里(成型/切炭/组装/装箱)时:

- 排线弹窗按「路线车间」过滤产线,而路线车间往往是历史值(熔铸车间/测试车间/装箱车间),`bs_prod_line`
  里**没有这个车间** ⇒ 下拉一条线都列不出来;
- 就算前端兜底列出全部线,`preplanManual` 仍按 `ProcessShop.matches` **硬拒** ⇒「选得到、存不进去」。

用户口径(2026-10-28):**以后新建的任意工序都必须能选到产线**,没有对应产线类型就把全部产线列出来。

## 改法(一句话)

`requiredShop(op, routeShop)`:**认得的工序 + 车间真的有启用线**才拦,其余一律返回 `null`(不设限)。
前端 `lineOptions()` 按后端回的 `限定车间` 决定「只列本车间」还是「列全部启用线」。

## 取证方法(只动测试账套 `HSDZ_MES_TEST`)

```bat
cd tools\archive\_newop-line-pick-20261028
java -Dstdout.encoding=UTF-8 -cp ..\..\lib\mssql-jdbc.jar NewOpProbe.java
```

探针做的事:

1. 在 `bs_route` 造临时路线 `GY-TEST-FX-20261028` = 成型(车间 成型) → **封箱**(车间 `装箱车间`,产线档案里不存在);
2. 把待排产工单 `GD2608100001` 挂到该路线;
3. 用 `admin` + `factory=YJ_TEST` 登录,走**真实接口** `POST /api/px/scheduleBoard/routeSteps` 看每道工序的 `限定车间`;
4. `POST /api/px/scheduleBoard/preplan` 把「封箱」排到 `切炭4(X)`(跨车间)—— 改前必被拒;
5. 回归:`成型 → 切炭4(X)` 必须仍被拒。

清理:`cleanup.sql`(删临时路线/预排台账,工单回池)。

## 实测结果(2026-10-28 10:52,本地 8090 + HSDZ_MES_TEST)

| 断言 | 结果 |
|---|---|
| `routeSteps` 封箱(车间=`装箱车间`) | `限定车间=false`,弹窗列全部启用线 ✅ |
| `preplan` 封箱 → `切炭4(X)` | 200「计划线:成型:1号机 / 封箱:切炭4(X)」 ✅ |
| 回归 `preplan` 成型 → `切炭4(X)` | 400「属于切炭,与工序成型应进的成型车间不一致」 ✅ |
| 装箱(2026-10-21 口径) | `routeSteps` 仍 `限定车间=true`,车间=组装 ✅ |

## 清理

```bat
:: 在 SSMS/sqlcmd 里对 HSDZ_MES_TEST 执行 cleanup.sql
```
