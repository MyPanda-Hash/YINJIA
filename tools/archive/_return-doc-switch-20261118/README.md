# 生产退料:扫组装/混料二维码都跳到「混料明细」—— 定位与修复(2026-11-18)

> 用户报障原话:「生产退料扫组装的二维码和混料的二维码都是跳到混料的明细」。

## 一、根因:不是扫码/解析错,是**明细页认的是"第一次打开的那张单"**

扫码那半条链**完全正确**,逐层验过:

| 环节 | 结果 |
|---|---|
| 领料单纸面二维码 | `0@GD-2026-11-0009@1001@A`(组装)/ `…@M`(混料),第 4 段就是领料标记 |
| 前端 `locateQueryOf` | 正确拆出 `{wo, line, kind:'组装'|'混料'}` |
| 后端 `/px/mobilePick/locate?kind=` | 实测:**kind=组装 → id=860(LL-2026-11-0051 组装)**;**kind=混料 → id=861(LL-2026-11-0052 混料)**;不带 kind → 两张都回、前端弹窗 |
| 列表页 `openDoc(d.id)` | 跳 `/panelx/list/MOBILE_RETURN/doc?id=860/861`,地址栏确实变了 |

坏在**明细页**(`MobileReturnDoc.vue`)第 234 行:

```js
const docId = ref(Number(route.query.id) || 0)   // ← 只在第一次挂载取一次
```

而 `PortalLayout` 是 `<component :is="Component" :key="route.path">` + keep-alive,
**keep-alive 的 key 是 path,不含 query** ⇒ 从 `?id=860` 跳到 `?id=861`(或反过来)
时**组件实例被复用**:不重建、`onMounted` 不重跑、`watch(docId)` 的值也没变
⇒ 页面永远停在**第一次打开的那张单**。先开过混料,之后扫组装看到的还是混料 —— 正是报障现象。

> 同一个坑「生产领料」(`MobilePickDoc`)与「混料明细」(`MobileMixDoc`)都踩过并已修
> (那两页用的是 `computed(() => route.query.x)` + `watch`),唯独生产退料这页(2026-11-18 新写的)
> 又写回了 `ref` 一次性取值。

## 二、改法

`MobileReturnDoc.vue`:

```js
const idFromNo = ref(0)                                    // ?no= 反查出来的 id
const docId = computed(() => Number(route.query.id) || idFromNo.value || 0)  // ← 跟随路由
watch(docId, () => { softReset(); load() })                // query 一变就换单重取
```

`resolveIdByNo()` 改成写 `idFromNo`(再 `router.replace({query:{id}})`,换完 docId 值不变 ⇒ 不会二次重载)。
顺带把**其他领料/其他退料明细页**(`MobileOtherDoc.vue`)补上同样缺的 `watch(单号)`——
它是本轮刚改版的那页,只挂载时取一次,从列表再点另一张单会停在上一张。

## 三、验证(ego,同一套操作打在两个包上)

复现/验收步骤:先进「混料」那张(`?id=861` = LL-2026-11-0052)→ 点返回 → 点列表里的「组装」
(LL-2026-11-0051 = id 860)→ 看标题是哪张单。

| 包 | 结果 | 判定 |
|---|---|---|
| **8090 换包前**(10:00 那版静态) | 地址栏已是 `?id=860`,标题仍是 **LL-2026-11-0052(混料)**,物料编码 `C-89-04**TB` | **复现报障** |
| **5173 源码版**(修复后) | 标题 = **LL-2026-11-0051(组装)**,物料编码 `C-89-04`,状态「可退料」 | 修好了 |
| **8090 换包后** | 同上(见下) | 打包版一致 |

脚本:`round-07.mjs`(5173)、`round-08.mjs`(8090,A/B 同一个脚本前后各跑一次)。
截图:`return-doc-861.png`(第一张混料)、`return-doc-after-switch.png`(切到组装后)、`return-doc-8090.png`。

## 四、复跑

```powershell
# 后端侧(证明 kind 生效;两个 id 必须不同)
# GET /api/px/mobilePick/locate?woNo=GD-2026-11-0009&line=1&kind=A  → id=860(组装)
# GET /api/px/mobilePick/locate?woNo=GD-2026-11-0009&line=1&kind=M  → id=861(混料)

# 界面侧(ego)
# ① http://localhost:5173/#/panelx/list/MOBILE_RETURN/doc?id=861
# ② 点左上「‹」回列表 → 点第一行(组装) → 标题必须变成 LL-2026-11-0051
```

## 五、注意

- **手机要换包才能用**:明细页是前端页面,1.0.22(`android/dist/yinjia-mes-1.0.22.apk`)已重打;网页端刷新即可。
- 这类「keep-alive 复用实例 + query 变了」的坑是**系统性**的:以后新写任何 `/x/doc?id=` 型的详情页,
  一律 `computed(() => route.query.xxx)` + `watch`,不要 `const x = ref(route.query.xxx)`。
