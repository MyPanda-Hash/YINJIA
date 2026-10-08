"""新厂区 D仓 的 原料区 / 辅料及配件区 仓位生成(数据源 = 《仓库库位信息表》Sheet2 行30-48)。

原文(逐格 dump 见 dump-newplant.txt):
  大区 原材料区  (G31:I31) → 分区 列G=炭粉区 列H=炭粉区 列I=胶粉区
  大区 辅料及配件区(J31:O31) → 分区 列J=纸箱区 列K=端盖区 列L=PP棉区 列M=折叠棉 列N=网套&布区 列O=货架区
  列G: '1-36辅料' r33 / '1-36' r34 / '1-36' r35 / '成品区' r36:G38(合并,非仓位)
  列H: '炭1区1-36' … '炭6区1-36'
  列I: '胶粉1区1-36' … '胶粉5区1-36' / '设备区' r38(非仓位)
  列J: '1-7' r33 / '1-14' r34 / '1-14' r35 / '1-7' r36
  列K: '1-12' r33 / '1-12' r34      列L: '1-12'   列M: '1-24'   列N: '1-12'
  列O: 'H1-1/2/3/4' … 'H11-1/2/3/4'

编码规则(与老厂区/成品仓同源:照原文展开,不另发明):
  · 有序号区间又没有排/位的分区 ⇒ 区码 = 分区(或原文子区名), 排号 = NULL, 位号 = 序号(2位补零)
      编码 = <区码>-<位号补零>      例 纸箱区-01 / 炭1区-36 / 胶粉5-01
      地址 = 大区+存储分区+区码+位号+位   (无排,故不出现"排")
  · 货架区原文自带结构 H<排>-<位> ⇒ 区码=H, 排号=1..11, 位号=1..4
      编码 = H<排>-<位>            例 H1-1 / H11-4
"""
import io

D = []   # (大区, 存储分区, 区码, 排号, 位号, 层号, 仓位编码)

def seq(area, zone, code_head, lo, hi, pad=2):
    for i in range(lo, hi + 1):
        v = str(i).zfill(pad)
        D.append((area, zone, code_head, None, v, None, f'{code_head}-{v}'))

def rack(area, zone, code_head, rows, pos):
    for r in rows:
        for b in pos:
            D.append((area, zone, code_head, str(r), str(b), None, f'{code_head}{r}-{b}'))

# ── 原料区 ──
for n in range(1, 7):                       # 列H 炭粉区:炭1区…炭6区 各 1-36
    seq('原料区', '炭粉区', f'炭{n}区', 1, 36)
for n in range(1, 6):                       # 列I 胶粉区:胶粉1区…胶粉5区 各 1-36
    seq('原料区', '胶粉区', f'胶粉{n}区', 1, 36)
for n in range(1, 4):                       # 列G 炭粉区:'1-36辅料'/'1-36'/'1-36' 三格各作一组(⚠判断点1)
    seq('原料区', '炭粉区', f'炭粉区{n}', 1, 36)

# ── 辅料及配件区 ──
seq('辅料及配件区', '纸箱区',   '纸箱区',   1, 14)   # 列J 四格 1-7/1-14/1-14/1-7 取并集(⚠判断点2)
seq('辅料及配件区', '端盖区',   '端盖区',   1, 12)   # 列K 两格均 1-12 取并集(⚠判断点3)
seq('辅料及配件区', 'PP棉区',   'PP棉区',   1, 12)   # 列L
seq('辅料及配件区', '折叠棉',   '折叠棉',   1, 24)   # 列M
seq('辅料及配件区', '网套&布区', '网套布区', 1, 12)   # 列N(区码去掉 & 以便扫码/编码友好)
rack('辅料及配件区', '货架区',  'H', list(range(1, 12)), [1, 2, 3, 4])   # 列O H1…H11

seen, rows = set(), []
for r in D:
    if r[6] in seen:
        raise SystemExit(f'编码重复: {r[6]}')
    seen.add(r[6]); rows.append(r)

buf = io.StringIO()
buf.write(f'-- 由 tools/archive/_whloc-req/gen-newplant.py 生成(数据源 Sheet2 行30-48 原文)\n-- 合计 {len(rows)} 个仓位\n')
for (area, zone) in [('原料区', '炭粉区'), ('原料区', '胶粉区'), ('辅料及配件区', '纸箱区'), ('辅料及配件区', '端盖区'),
                     ('辅料及配件区', 'PP棉区'), ('辅料及配件区', '折叠棉'), ('辅料及配件区', '网套&布区'), ('辅料及配件区', '货架区')]:
    n = sum(1 for r in rows if r[0] == area and r[1] == zone)
    buf.write(f'--   {area:8} {zone:8} {n:4}\n')

buf.write("""
DECLARE @loc TABLE (
  大区 nvarchar(30), 存储分区 nvarchar(30), 区码 nvarchar(20),
  排号 nvarchar(10), 位号 nvarchar(10), 层号 nvarchar(10), 仓位编码 nvarchar(100));

INSERT INTO @loc (大区, 存储分区, 区码, 排号, 位号, 层号, 仓位编码) VALUES
""")
vals = []
for (area, zone, code, rown, pos, lay, full) in rows:
    rown_s = 'NULL' if rown is None else f"N'{rown}'"
    lay_s = 'NULL' if lay is None else f"N'{lay}'"
    vals.append(f"  (N'{area}',N'{zone}',N'{code}',{rown_s},N'{pos}',{lay_s},N'{full}')")
buf.write(',\n'.join(vals) + ';\n')

buf.write("""
DECLARE @ins int;
INSERT INTO dbo.bs_wh_loc (仓库, 仓库编码, 仓位编码, 仓位地址, 大区, 存储分区, 区码, 排号, 位号, 层号,
                           停用, asp_user1, asp_time1, asp_cancel)
SELECT N'D仓', N'CK-D', l.仓位编码,
       -- 地址 = 大区+存储分区+区码 [+ -排号排] +位号位 [+层号层];无排时不出现"排"(NULL 安全)
       l.大区 + l.存储分区 + l.区码
         + CASE WHEN l.排号 IS NOT NULL THEN N'-' + l.排号 + N'排' ELSE N'' END
         + l.位号 + N'位'
         + ISNULL(l.层号 + N'层', N''),
       l.大区, l.存储分区, l.区码, l.排号, l.位号, l.层号, 0, N'migration', SYSDATETIME(), N'N'
FROM @loc l
WHERE NOT EXISTS (SELECT 1 FROM dbo.bs_wh_loc x
                  WHERE x.仓位编码 = l.仓位编码 AND ISNULL(x.asp_cancel,'N') <> 'Y');
SET @ins = @@ROWCOUNT;
PRINT N'  ✓ 新厂区新增仓位 ' + CAST(@ins AS nvarchar(10)) + N' 行';
""")

out = r'D:\workspace\yinjia\tools\archive\_whloc-req\gen-newplant-rows.sql'
open(out, 'w', encoding='utf-8').write(buf.getvalue())
print('rows =', len(rows))
for (area, zone) in sorted({(r[0], r[1]) for r in rows}):
    print(f'  {area:8} {zone:8} {sum(1 for r in rows if r[0] == area and r[1] == zone):4}')
print('written ->', out)
