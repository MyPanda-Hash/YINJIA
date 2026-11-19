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

## 六、打包(2026-11-19 12:35,`build-appjar.ps1` 全流程)

```text
[1/4] npm run build        51.2s
[2/4] robocopy dist → backend/src/main/resources/static /MIR   OK
[3/4] tools/apache-maven-3.9.9: mvn -q -s tools/settings.xml -f backend/pom.xml -DskipTests clean package
[4/4] 产出 backend/target/app.jar
```

| 项 | 值 |
|---|---|
| 产物 | `backend/target/app.jar` = `yinjia-mes-backend-0.1.0.jar`(同一文件) |
| 大小 / 时间 | **93.9 MB** / 2026-11-19 12:35:50 |
| SHA256 | `F2F550626624FEECCD20678C042631A2A8906DAE2C0B79AAA89A333138DA6DF4` |
| fat jar 自检 | `BOOT-INF/lib/` **129** 条、`com/yinjia` class **263** 个(不是瘦 jar) |
| 新代码在包内 | `MixBomService.class` / `MixBomService$Doc.class` / `MobileMixDoc-B41xvz7B.js` |
| 前端入口 | jar 内 `index.html` → `assets/index-B2zPqiAZ.js` |

**顺序**(脚本头部 2026-09-21 事故口径):先 `start-prod.ps1 -Stop` → 再打包 → 再起服务;
否则 Windows 占着 jar 会让 `repackage` 改名失败、磁盘上留瘦 jar。

**打包版实测(8090,round-03)**:8090 现在服务的入口 chunk = `assets/index-B2zPqiAZ.js`(新前端),
且**已是新后端**:

```text
打开 GD-2026-11-0007 #5 → 明细 0 行 + 空态"该产品在「混料物料清单」里还没有维护用料…"
扫 AGC-80250 → 被拒:"该物料不在本工单行的混料物料清单里…(…还没有维护用料,请先归档烧结工艺清单…)"
qtyInputs=0                              ← 新前端(数量只读)
```

旧口径(mate)在这种情况下会带出 6 行 BOM —— 现在没有,说明 `MixBomService` 生效。
截图:`round-03a-8090-empty.png` / `round-03b-8090-reject.png`。

## 七、未做 / 限制

1. 本地正式库 `bs_mix_bom` **0 行**(没有已归档的烧结单),所以本地扫码混料只能看到上面的空态;
   真实混料清单在服务器(台账 #56 已部署并跑过同一批迁移)。
2. 本次未 push、未上服务器:两个 commit(`df384fbe2` 功能 + `3df78728b` 静态产物)还在本地,
   服务端部署要 `git push` 后按 `deploy_src.py --ref <已推送SHA>` 走,并记账 `deploy/部署台账.md`。
3. 1 秒轮询对 `/dc/monitor` 是只读请求(不写流水),不影响数采侧 1 秒/条的写入节流。
