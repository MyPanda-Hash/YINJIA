# 扫码混料:数量只认电子秤实时读数(不可手输)· 2026-11-19

## 一、用户口径(原话)

> 「手机扫码混料,扫物料码解锁后,**不能手动填写数据,应该实时抓取电子秤的数据**。
>  等他们确认数量无误后再点击确认就可以。」

改前的实现是「解锁时把秤值填进 `el-input-number`,取不到还能手输」,与这次口径冲突。

## 二、改了什么

| 位置 | 改动 |
|---|---|
| `frontend/src/views/mobile/MobileMixDoc.vue` | 数量区从 `el-input-number` 换成**只读仪表盘** `[data-test="mix-live-qty"]`,数字直接绑 `liveQty`(电子秤实时读数);删掉 `curQty`、删掉「取秤」按钮与 `scaleLoading`(数字本来一直跟着秤跳,不需要手动抓);`确认` 的判据换成 `canConfirm`(要有读数 + 读数稳定) |
| 同上 · 轮询 | 2 秒 → **1 秒**(用户要「实时」;稳定判定靠连续两次一致,拉长间隔会明显变慢才敢确认) |
| 同上 · 提示 | 锁定态/解锁态文案改为「数量只取电子秤实时读数,不能手输」「核对电子秤读数无误后点『确认』」;取不到秤时明确提示查秤与网关,不再引导手输 |
| 同上 · `readScale` | **先认准秤设备再取数**(见下节根因),`/dc/monitor` 带 `deviceId` |
| `frontend/src/business/mixScan.js` | 新增纯函数 `scaleDeviceIdOf(payload)`:从 `devices[]` 里挑电子秤(type/名称含「秤」或设备号 `DZ-` 开头) |
| `backend/.../MixScanService.java` | `实际用量 <= 0` 的报错文案改口径:「请确认电子秤已连接并有稳定读数(页面不支持手动填写数量)」 |
| `frontend/src/i18n/locales/en.js` / `ja.js` | 新增 8 条文案译名 |
| `frontend/src/views/mobile/mobileMixScaleOnly.test.js` | 守卫单测(6 组):页面不得有可编辑数量控件 / 只读实时读数 / 确认取当下秤值 / 不稳定点不亮 / 1 秒轮询 / 认秤设备 / en·ja 译名齐 |

## 三、实测发现并修掉的根因:`/dc/monitor` 默认设备不是秤

第一轮 ego 实测:解锁后秤卡一直「等待称重」,`qtyInputs=0`(输入框确实没了)但**没有读数**。

查 `DcPlatformService.monitor`:不带 `deviceId` 时 `target` 取
`ORDER BY d.device_type, d.code` 的**第一台设备**;本项目数采表里排最前的是「加工设备」
(测试库 132 台设备,电子秤 `DZ-001` 的 type 是「电子秤」,排在后面)
⇒ 页面永远读到别的设备的点位。修法在页面侧(后端改动需重打 jar,本机无 maven):
第一次全量取 `devices[]` 找到秤的 id,之后每轮 `/dc/monitor?deviceId=<秤id>`。

## 四、实测证据(ego 浏览器,5173 源码版 + 8090 后端)

```text
A. 未解锁    qtyInputs=0  qtyNumberWidgets=0  liveQtyExists=false
             秤卡="台车电子秤 12.345 kg 读数稳定，可取值"   取秤按钮=false
             提示="扫物料码解锁…数量只取电子秤实时读数,不能手输"
B. 解锁后    (扫 AGC-80250)liveQty="12.345 kg 实时"  确认=可点  提示="数量来自电子秤实时读数,核对无误后点「确认」"
C. 2.5s 后    liveQty 仍为实时值(证明是活读数,不是一次性抓进输入框)
D. 点确认    提示="已确认 AGC-80250 · 超出应投 12.239";该行 实投=12.345 kg;进度 0/6 → 1/6
```

截图:`round-02a-locked.png` / `round-02b-unlocked.png` / `round-02c-live.png` / `round-02d-confirmed.png`。

## 五、造数与清理(测试账套 YJ_TEST)

| 项 | 内容 |
|---|---|
| 单据 | `GD-2026-11-0007` 行 5(产品 `C-95-13`,`mate` BOM 6 行) |
| 扫的物料 | `AGC-80250`(活性炭,kg) |
| 模拟秤 | 后台每 3 秒往 `bs_dc_sample` 插一条 12.345kg(`asp_user1='mixscan-probe'`,设备 `DZ-001`) |
| 清理后 | 草稿行 `wo_mixing_list` 1 → **0**;`mixscan-probe` 采样 **0**;演示网关 `GW-READY.api_key` 曾临时置值,已复原 **NULL** |

## 六、未做 / 限制

1. **后端 jar 未重建**:本机没有 `mvn`(PATH/常见目录/`.m2/wrapper` 全无),
   `backend/target/*.jar` 仍是 2026-11-18 16:42 的旧包 ⇒ 本次验证用的是
   **5173 新前端 + 8090 旧 jar 的既有接口**(接口形状未变,只改了一句报错文案)。
   要上服务器验证新口径,需要先 `mvn package`(或走 `deploy_src.py` 让服务器自建)。
2. 旧 jar 仍按遗留 `mate` 取 BOM(新口径 `bs_mix_bom` 在合并后的源码里),所以本地
   「混料物料清单」还是空的 —— 与本改动无关,见 `tools/archive/_pull-mixbom-20261119/README.md`。
3. 1 秒轮询对 `/dc/monitor` 是只读请求(不写流水),不影响数采侧 1 秒/条的写入节流。
