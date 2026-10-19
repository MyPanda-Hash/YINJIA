# 分批送料「确定生单」弹「已审核单据不可保存，请先弃审」——取证(2026-10-19)

用户报障:在**服务器**上测「采购订单 → 分批送料」(源单 `YJ-20260902-05`,源单本身已审核),
点「确定生单」后顶部弹出红色提示 **「已审核单据不可保存，请先弃审」**,弹窗未关闭。

## 一、这条提示是谁抛的

`backend/src/main/java/com/yinjia/mes/service/ButtonService.java:543`(`saveDoc` 的状态门禁):

```java
Map<String, Object> st = docStatusOf(def.code(), no);
String stStatus = String.valueOf(st.get("status"));
if ("已审核".equals(stStatus)) throw new IllegalStateException("已审核单据不可保存，请先弃审");
```

判据只有一条:**这次要保存的那张单(面板编码 + 单号)在 `yj_doc_status` 里 `shr`(审核人)非空**
(`docStatusOf` 末尾:`shr != null ⇒ 已审核`)。抛 `IllegalStateException` ⇒
`GlobalExceptionHandler` 转 **HTTP 409**,`message` 原样透传到前端 toast —— 文案里没有任何
"分批送料/暂收单"的字样,所以它很容易被误读成"分批送料规则不让你生单"。

## 二、这个界面上只有两处会走到保存

| # | 动作 | 后端入口 | 结论 |
|---|---|---|---|
| A | 采购订单自己的「保存 / 保存并新增 / 提交审批」 | `POST /api/px/save` → `saveDoc(PU_ORDER, YJ-20260902-05)` | **必然**报这句:该单本来就是已审核(界面右上「已审核」,表尾 审核人 冯加劲 / 审核时间 2026-09-03 11:11:52;本地库 `yj_doc_status` 同一条 `shr=冯加劲`)。设计如此:先「弃审」退回草稿再改 |
| B | 弹窗里的「确定生单」 | `POST /api/px/batchGenerate` → `PushGenerateHandler.generateBatch` → `buttonService.save(QC_RECV, …)` | 正常**不该**报:生单是**新建一张送料暂收单草稿**。报了 ⇒ 新单号在库里已经是**一张已审核的暂收单** |

### B 为什么会撞上已审核单号

`generateBatch` 用通用保存建目标草稿,单号由 `FormNoService.next(前缀)` 发:

```java
seq = MAX(RIGHT(dh,4)) FROM s_allno WHERE lb=前缀 AND ny=yyyy-MM AND dh LIKE 前缀-ny-%
// exists() 也只查 s_allno + inh —— 不看业务表
```

即**号池只看自己**。只要业务表里有"没进号池"的单号(导库/直接写库/恢复备份没带 `s_allno`/
外部系统写入),下一次新增就会把这个**库里已存在**的号再发一次。`saveDoc` 里虽然有
`clearStaleDocStatus(no)` 兜底,但它**只在业务表查不到这个号时**才清状态行;撞到真实存在的单
⇒ 状态行照旧有效 ⇒ `shr` 非空 ⇒ 弹这句。于是"我明明在生成一张新单,它却说单据已审核"。

同类事故有先例:`01d31001`(2026-10-16)「导库补做号池回登」—— IJ 池末号 `IJ-2026-10-0010`,
库里已有 `IJ-2026-10-0011~0020`,造检验单**连撞 10 个重号**。

## 三、10 秒分辨 A / B

1. 浏览器 F12 → Network → 看报错那一下的请求:
   - `/api/px/batchGenerate`(409)= **B**;响应体 `data.message` 就是那句 toast;
   - `/api/px/save`(409)= **A**。
2. 或看弹窗:报错后弹窗仍开着、`loading` 复位 = 点的是「确定生单」。

## 四、服务器侧自查(只读)

`check-formno-pool.sql` 逐张单据头表比对「库末号 / 号池末号 / 未回登张数」:

```powershell
cd tools
java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar `
     archive\_diag-batchsave-20261019\_Q.java `
     archive\_diag-batchsave-20261019\check-formno-pool.sql
```

一条判据就够:**某前缀「未回登张数 > 0」或「库末号 > 号池末号」⇒ 命中 B**。
本机(开发库 `HSDZ_MES`,2026-10-19 实测)10 张表全 `OK`、总缺号 0 ——
说明**本机已回登过、不会撞**;若只有服务器报,则服务器的号池落后。

## 五、修法(命中 B)

1. 回登号池(幂等、只增不删、自带 PASS/FAIL 自检;正式库与测试库各跑一次):

   ```powershell
   cd tools
   java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar DbSync.java run `
        archive\_kingdee-reimport-20261016\backfill-formno-pool-imported.sql
   ```

2. 复跑本目录的体检 → 未回登张数应为 0;
3. 回界面重试「确定生单」;
4. 顺手验证:随便「新增」一张单据(草稿即可)不再撞号 —— 号池落后的影响是**全面板**的,
   不止分批送料。

## 六、命中 A 时的口径

采购订单已经是终态(已审核),要改就先「弃审」→ 改 → 再「提交审批/审核」。
分批送料本身**不需要**改源单:它只读取订单行、占用量记在 `form_flow_link`,
不会回写采购订单。
