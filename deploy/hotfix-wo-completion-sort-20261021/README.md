# 完工明细排序修复包 · 2026-10-21(最新完工在最上面)

> **一句话**:服务器上给「完工明细」面板加一个默认排序键 —— 按**完工时间倒序**,
> 上面是新日期的行、下面是旧日期的行。只改 `yj_panel` 一行元数据,不动业务数据。

---

## 一、为什么

用户口径:「让当前完工明细的数据按时间排列从上到下进行,上面是新日期的,下方为旧日期的」。

| # | 项 | 说明 |
|---|---|---|
| 1 | 现象 | 列表里 10-15 完工的行会排在 10-16 完工的行**上面**,新旧交错 |
| 2 | 根因 | 面板 `WO_COMPLETION_LIST` 是 flat 只读视图,建面板时 `yj_panel.date_col` 留空 ⇒ 后端取数退回 `ORDER BY t.id DESC`(报工行自增 id),而 **id 顺序 ≠ 完工时间顺序**(补录、多工单并行报工后就乱了)。实测正式库:`id=3338`(完工 10-15)排在 `id=3337`(完工 10-16)上面 |
| 3 | 修法 | `yj_panel.date_col = N'wgsj'`(视图里「完工时间」的物理列)⇒ 后端 `ORDER BY t.[wgsj] DESC, t.id DESC` |
| 4 | 影响面 | **只改 1 行元数据**;不动 `scjl`、不动视图、不动 `yj_field`、不动权限、不删数据 |
| 5 | 生效方式 | 面板元数据缓存 30 秒,**不用停服务、不用重启 jar**;刷新浏览器即可 |

> 开发机同款迁移:`tools/migrate-wo-completion-sort-20261021.sql`(本包内是同字节副本)。
> 根因与实现细节见 `docs/development/生产工单完工明细.md`「列表默认排序(2026-10-21)」。

---

## 二、包内容

| 文件 | 用途 |
|---|---|
| `migrate-wo-completion-sort-20261021.sql` | **修复脚本**:只把 `yj_panel.date_col` 写成 `wgsj`;幂等,带库名/面板/视图/列四道守卫 |
| `check-sort.sql` | **只读自检**:打印 `date_col`、行数、最新/最旧、逆序对数、TOP 5;不 PASS 会抛错(退出码非 0) |
| `apply-db.bat` | **服务器一键执行**:预检 → 跑脚本 → 自检(纯 ASCII,cmd 直接可跑) |
| `SHA256SUMS.txt` | 逐文件指纹 |
| `README.md` | 本文件 |

**本包不自动备份数据库**,原因:唯一改动是 `yj_panel` 一行 `date_col` 从 `NULL` 改成 `wgsj`,
可一行 SQL 回滚(见 §五),整库备份几百 MB 没有意义。若你们流程要求留备份,执行前自行:

```cmd
sqlcmd -S localhost -E -Q "BACKUP DATABASE [HSDZ_MES] TO DISK=N'C:\yinjia\backup\pre-wosort.bak' WITH FORMAT, INIT, COMPRESSION"
```

---

## 三、路线 A(推荐):服务器一键执行,1 分钟

### 3.1 流程

```
开发机                                  服务器(RDP)
  │  ① 拷 hotfix-wo-completion-sort-20261021.zip
  │  ───────────────────────────────────► ② 解压到 C:\yj-deploy\sortfix
  │                                        ③ certutil 核对 SHA256(可选)
  │                                        ④ cmd 跑 apply-db.bat HSDZ_MES
  │                                            ├─[1/3] 预检:面板行数 / 当前 date_col
  │                                            ├─[2/3] 执行修复脚本(单行 UPDATE)
  │                                            └─[3/3] 自检:date_col=wgsj、逆序对=0
  │  ◄─────────────────────────────────── ⑤ 浏览器验收(完工明细),把输出贴回
```

### 3.2 逐步操作

**① 开发机:把包传到服务器**

包在仓库:`D:\workspace\yinjia\deploy\hotfix-wo-completion-sort-20261021.zip`(几 KB)。
RDP 连上服务器后,在开发机资源管理器里 **复制该 zip → 在 RDP 窗口里粘贴**(剪贴板直通),落到桌面即可。

> zip 的 SHA256 由开发机随包发出(聊天/交付记录里那份),服务器上比对:
> `certutil -hashfile hotfix-wo-completion-sort-20261021.zip SHA256`。
> 包内 `SHA256SUMS.txt` 是**单文件**指纹:`certutil -hashfile apply-db.bat SHA256`。

**② 服务器:解压**

```cmd
mkdir C:\yj-deploy\sortfix 2>nul
tar -xf "%USERPROFILE%\Desktop\hotfix-wo-completion-sort-20261021.zip" -C C:\yj-deploy\sortfix
dir C:\yj-deploy\sortfix
```

应看到 5 个文件:`apply-db.bat`、`migrate-wo-completion-sort-20261021.sql`、`check-sort.sql`、`README.md`、`SHA256SUMS.txt`。
(没有 `tar` 就资源管理器右键「全部解压缩」。)

**③ 服务器:执行**

```cmd
cd /d C:\yj-deploy\sortfix
apply-db.bat HSDZ_MES
```

- 不写参数默认就是 `HSDZ_MES`;测试账套写 `apply-db.bat HSDZ_MES_TEST`;
- 用 **Windows 身份验证**(`sqlcmd -E`),管理员/普通 cmd 都行(本包不备份、不改服务);
- **不需要停 8090**,脚本 1 秒内结束。

**④ 看输出:三项都要对上**

```
[1/3] preflight (read-only)
panel_rows|1
date_col_before|(NULL)
[2/3] apply the sort metadata (single-row update, idempotent)
[PASS] 完工明细列表默认排序 = 完工时间(wgsj) DESC, id DESC:新日期在上、旧日期在下。
      script ok.
[3/3] verify (date_col must be wgsj; out_of_order_pairs must be 0)
panel|WO_COMPLETION_LIST
date_col|wgsj
rows|1153
newest|2026-10-20 01:10:53
oldest|2026-09-06 16:40:00
out_of_order_pairs|0
3361|2026-10-20 01:10:53|GD-2026-10-0223|成型
...
RESULT|PASS
============================================================
 RESULT: DONE for HSDZ_MES
```

| 行 | 含义 | 判据 |
|---|---|---|
| `date_col_before` | 改之前的值 | 通常是 `(NULL)`;把它记下来,回滚就用这个值 |
| `date_col` | 改之后的值 | **必须是 `wgsj`** |
| `out_of_order_pairs` | 按完工时间倒序逐行比对的逆序对数 | **必须是 `0`** |
| `RESULT` | 自检结论 | **必须是 `PASS`** |
| `rows` / `newest` / `oldest` | 服务器实际行数 / 最新 / 最旧 | `newest` 应是列表第一行的时间 |

> 服务器行数与本包样例(开发机 1153 行)不同属正常,判据看上面四项,不看行数。

**⑤ 浏览器验收**

1. 打开 `http://36.140.66.163:8090`(服务器本机用 `http://localhost:8090`)→ 登录;
2. 进 **生产过程 → 完工明细**;
3. **Ctrl + F5 强制刷新**(元数据缓存 30 秒,若顺序没变,等 1 分钟再刷一次);
4. 看「完工时间」列:**从上到下应从大到小**(第一行是最大时间);点几个分页看下一页也应延续递减。

**⑥ 收尾**

- 把 ④ 的输出(`date_col` / `out_of_order_pairs` / `RESULT` / `rows` / `newest`)贴回开发机留档;
- 测试库也要一致的话再跑一次:`apply-db.bat HSDZ_MES_TEST`。

### 3.3 失败怎么办

| 卡在哪 | 现象 | 处置 |
|---|---|---|
| 步骤 ③ | `[FAIL] sqlcmd not found` | 服务器没装命令行工具 → 走 §四(SSMS 手工跑,效果一样) |
| 步骤 ③ 预检 | `[FAIL] cannot read dbo.yj_panel` | 库名写错或当前 Windows 账号没有读权限 → 用管理员 cmd 重试 |
| 步骤 ③ 执行 | `[FAIL] script failed - transaction rolled back` | **什么都没改**(单事务回滚)。看报错那一句:若是「缺少 WO_COMPLETION_LIST 面板 / 视图」,说明服务器库比 2026-10-16 旧,**别自己补**,把报错贴回开发机 |
| 步骤 ③ 自检 | `CHECK FAILED: date_col is not wgsj` | 脚本没生效(极少见,如被别的会话改回)→ 重跑一次;仍失败贴输出 |
| 步骤 ③ 自检 | `CHECK FAILED: completion rows are not newest-first` | 视图里 `wgsj` 有异常值(全 NULL / 类型不对)→ 贴 `newest`、`oldest` 和报错回来 |
| 步骤 ⑤ | 页面顺序还是旧的 | ① 先确认真的刷新了(强刷 / 等 30 秒);② 点其它列表(如「报工记录」)看是否按日期倒序 —— 若所有列表都不按日期排,是服务器 jar 太旧(本排序逻辑 2026-10-14 才有),需要换 jar,不属本包范围 |

> 修复脚本可**重复执行**:再跑一遍只会把同一行写成同一个值(幂等)。

---

## 四、没有 sqlcmd 时(SSMS 手工跑)

1. SSMS 连 `localhost`(Windows 身份验证),选中 **HSDZ_MES**;
2. 打开 `migrate-wo-completion-sort-20261021.sql`,**整段执行**(约 1 秒);
   - 结果区会打印 `[PASS] ...`;若报「缺少 WO_COMPLETION_LIST 面板 / 视图 / wgsj 列」,停止并贴回;
3. 再打开 `check-sort.sql` 执行:
   - `date_col` 必须是 `wgsj`;
   - `out_of_order_pairs` 必须是 `0`;
   - 最后一行必须是 `RESULT | PASS`;
4. 浏览器强刷验收(同 §3.2 ⑤)。

---

## 五、回滚(只改一行,不用恢复备份)

```cmd
sqlcmd -S localhost -d HSDZ_MES -E -Q "UPDATE dbo.yj_panel SET date_col=NULL WHERE panel_code='WO_COMPLETION_LIST'"
```

- 这只恢复「按 id 倒序」的旧行为(即用户报障的那个顺序),**不丢任何数据**;
- 如果 §3.2 ④ 的 `date_col_before` 不是 `(NULL)` 而是别的值,把 `NULL` 换成那个值。

---

## 六、本地已验证的证据(2026-10-21,两账套)

| 账套 | 行数 | 第一行(最新) | 最旧 | 逆序对 | 结论 |
|---|---|---|---|---|---|
| HSDZ_MES(正式) | 1153 | 2026-10-20 01:10:53 | 2026-09-06 16:40:00 | 0 | PASS |
| HSDZ_MES_TEST(测试) | 12 | 2026-10-16 18:01:12 | 2026-08-10 09:58:56 | 0 | PASS |

- 迁移两账套执行,`DbSync` 收敛到 `执行 0, 跳过 621, 失败 0`;重复执行 `[OK] 1 batches`;
- 浏览器同款接口探针 `tools/archive/_wo-completion-order-20261021/_check-api.mjs`:第一页 100 行逐行断言「完工时间」非递增,两账套 `[PASS]`。

---

## 七、前提与注意

1. **服务器库要有 `WO_COMPLETION_LIST` 面板与 `v_wo_completion_detail` 视图**(2026-10-16 起就有了)。
   没有的话脚本会明确报错、不改任何东西 —— 那说明服务器库太旧,需要先上基础迁移,贴报错回来。
2. **服务器 jar 要含 2026-10-14 的「列表按日期列倒序」逻辑**(现行包都满足)。
   验证方法:改完后「完工明细」第一行时间最大即生效;若所有列表都不按日期倒序,才是 jar 太旧。
3. **完工时间为空的行**会排在最后(排序本身不丢行)。
4. 本包**不碰** `scjl`、`v_wo_completion_detail`、`yj_field`、角色权限,也不改任何业务行。

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-10-21 | 建档:根因、一键脚本、自检、回滚、验收口径 |
