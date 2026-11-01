import openpyxl, re, json, collections
P = r"C:\Users\vigna\Documents\WeChat Files\wxid_9he2bhyytczm22\FileStorage\File\2026-10\引出列表_BOM单_20261019174847.xlsx"
wb = openpyxl.load_workbook(P, read_only=True, data_only=True)
ws = wb["列表数据"]
rows = list(ws.iter_rows(min_row=2, values_only=True))
out = []
out.append("data rows: %d" % len(rows))
def s(v):
    if v is None: return None
    if isinstance(v, str):
        v = v.strip()
        return v if v else None
    return v
blocks=[]; cur=None; bad=[]
for i, r in enumerate(rows, 2):
    def g(j): return s(r[j-1]) if len(r) >= j else None
    pc = g(2)
    if pc is not None:
        cur = {"excel_row": i, "产品编码": pc, "产品名称": g(1), "规格型号": g(3),
               "编码": g(10), "默认BOM": g(16), "使用状态": g(15),
               "工艺路线编码": g(25), "工艺路线名称": g(26), "用量分子0": g(11), "用量分母0": g(13),
               "子件": []}
        blocks.append(cur)
    if cur is None:
        bad.append(i); continue
    cur["子件"].append({"物料编码": g(4), "物料名称": g(5), "子件规格": g(6), "单位": g(8),
                       "分子": g(11), "分母": g(13), "行备注": g(32)})
out.append("blocks: %d" % len(blocks))
out.append("orphan rows (before first block): %r" % bad[:10])
prods = collections.Counter(b["产品编码"] for b in blocks)
out.append("distinct products: %d" % len(prods))
out.append("blocks per product distribution: %r" % dict(collections.Counter(prods.values())))
# 编码 unique?
codes = [b["编码"] for b in blocks]
out.append("codes None: %d; duplicates: %r" % (sum(1 for c in codes if c is None), [k for k,v in collections.Counter(codes).items() if v>1][:10]))
# 编码 pattern
pat = re.compile(r'^(.*)_V(\d+)$')
nop = [c for c in codes if c and not pat.match(c)]
out.append("codes not matching _V<digits>: %d sample %r" % (len(nop), nop[:10]))
# version suffix vs product code prefix
mismatch=[]
for b in blocks:
    c=b["编码"]; 
    if c:
        mm=pat.match(c)
        if mm and mm.group(1)!=b["产品编码"]: mismatch.append((b["产品编码"], c))
out.append("code prefix != product code: %d sample %r" % (len(mismatch), mismatch[:10]))
# 默认BOM values
out.append("默认BOM values: %r" % dict(collections.Counter(str(b["默认BOM"]) for b in blocks)))
out.append("使用状态 values: %r" % dict(collections.Counter(str(b["使用状态"]) for b in blocks)))
# empty child codes
nchild0 = sum(1 for b in blocks if not b["子件"]); 
out.append("blocks with 0 children: %d" % nchild0)
empty_mat = sum(1 for b in blocks for c in b["子件"] if not c["物料编码"])
out.append("child rows with empty 物料编码: %d" % empty_mat)
# child count distribution
out.append("child counts: total=%d, min=%d, max=%d, avg=%.2f" % (sum(len(b['子件']) for b in blocks), min(len(b['子件']) for b in blocks), max(len(b['子件']) for b in blocks), sum(len(b['子件']) for b in blocks)/len(blocks)))
# numerators/denominators variety
nums = collections.Counter(str(c["分子"]) for b in blocks for c in b["子件"])
dens = collections.Counter(str(c["分母"]) for b in blocks for c in b["子件"])
out.append("分子 distinct %d: %r" % (len(nums), nums.most_common(12)))
out.append("分母 distinct %d: %r" % (len(dens), dens.most_common(8)))
nonnum = [(b["产品编码"], b["编码"], c) for b in blocks for c in b["子件"] if not isinstance(c["分子"], (int,float)) or not isinstance(c["分母"], (int,float))]
out.append("non-numeric 分子/分母: %d sample %r" % (len(nonnum), nonnum[:5]))
# product name/spec missing
out.append("blocks missing 产品名称: %d, 规格型号: %d, 工艺路线名称: %d, 默认BOM: %d" % (
    sum(1 for b in blocks if not b["产品名称"]), sum(1 for b in blocks if not b["规格型号"]),
    sum(1 for b in blocks if not b["工艺路线名称"]), sum(1 for b in blocks if not b["默认BOM"])))
# first 3 blocks summary
for b in blocks[:3]:
    out.append("SAMPLE block: %s | %s | spec=%s | 编码=%s | 默认=%s | 状态=%s | route=%s | children=%d" % (b["产品编码"], b["产品名称"], b["规格型号"], b["编码"], b["默认BOM"], b["使用状态"], b["工艺路线名称"], len(b["子件"])))
# products with multiple blocks and their codes
multi = {p: [b for b in blocks if b["产品编码"]==p] for p,v in prods.items() if v>1}
out.append("products with multiple blocks: %d" % len(multi))
for p in list(multi)[:15]:
    out.append("  MULTI %s -> %r" % (p, [(b["编码"], b["默认BOM"], len(b["子件"])) for b in multi[p]]))
json.dump([{k:v for k,v in b.items() if k!="子件"} | {"子件": b["子件"]} for b in blocks], open(r"D:\workspace\yinjia\tools\archive\_asm-bom-import-20261030\excel-blocks.json","w",encoding="utf-8"), ensure_ascii=False)
open(r"D:\workspace\yinjia\tools\archive\_asm-bom-import-20261030\_analyze.txt","w",encoding="utf-8").write("\n".join(out))
print("done")
