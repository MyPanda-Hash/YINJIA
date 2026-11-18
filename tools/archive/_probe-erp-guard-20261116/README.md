# _probe-erp-guard-20261116 —— 「转ERP 前置守卫」的真机验证

验证对象:`backend/.../service/KingdeePushService.java` 的私有方法 `assertSourceAlive(...)` ——
采购入库单/暂收退料单/销售出库单转ERP 前,若**来源采购/销售订单**在 MES 里被标成「金蝶已删除/已作废」
(`yj_doc_status.erp_close_state='D'/'Z'`,由 `deploy/sync-presence.mjs` 写),就直接拒绝并说清怎么办,
不让金蝶回一句「单据X的源单''已被删除」让现场猜。

## 为什么不点按钮验证

- 本机 8090 跑的是**旧 jar**(新代码没打包进去),而重启会打断正在用的会话;
- 走 API 点「转ERP」还有把单据真推进金蝶的风险。

所以用反射直接调那个私有守卫方法:它在 `doPushDocument` 里、**任何金蝶网络调用之前**执行,
既能验证真代码 + 真库,又绝不会推单。

## 怎么跑(在 `backend` 目录下)

```powershell
# ① 导出运行时 classpath(一次性;产物 cp.txt 不入库,路径是本机的)
D:\YINJIA-main\tools\apache-maven-3.9.9\bin\mvn.cmd -q -s D:\YINJIA-main\tools\settings.xml `
  dependency:build-classpath -Dmdep.outputFile=<本目录>\cp.txt -DincludeScope=runtime

# ② 编译探针(需 JDK 25:backend 是 class 69)
& "$env:JAVA_HOME\bin\javac.exe" -encoding UTF-8 -cp "target\classes;$(Get-Content <本目录>\cp.txt -Raw)" `
  -d <本目录> <本目录>\_ErpGuardProbe.java

# ③ 运行(连本机 HSDZ_MES;跑完自动把造的标记还原)
& "$env:JAVA_HOME\bin\java.exe" -Dstdout.encoding=UTF-8 -cp "target\classes;<本目录>;$(Get-Content <本目录>\cp.txt -Raw)" _ErpGuardProbe
```

## 覆盖(6 项,2026-11-16 实测全 PASS)

| # | 场景 | 期望 |
|---|---|---|
| ① | 来源采购订单**没被标记** | 放行(不能有假阳性) |
| ② | 标成 `D`(金蝶已删除) | 拒绝,消息点名订单 + 给出处置办法 |
| ③ | 标成 `Z`(已作废) | 拒绝,写「金蝶已作废」 |
| ④ | 合单表头 `订单A、订单B`(只 B 被删) | 只点名 B |
| ⑤ | 销售出库的来源销售订单被标 `D` | 同样的拒绝(同一套守卫) |
| ⑥ | 表头/行都没有来源单号 | 放行(MES 自建单本来就能转) |

⚠ 探针会往 `yj_doc_status` 造临时标记,结束**按造之前的样子还原**(原本没有的行删掉、原本有的写回原值)。
2026-11-16 首版清理只按 `LIKE '%GUARD%'` 删,把真单据 `YJ-20260916-01` 的 `erp_close_state` 留成了 `'Z'`,
已手工回正并改成"先存原值再还原"——以后改这个探针别退回旧写法。
