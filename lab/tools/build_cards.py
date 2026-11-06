# Builds lab/cards.json from Project Ignis' cards.cdb: python build_cards.py <cards.cdb> <out.json>
import sqlite3, sys, json
c = sqlite3.connect(sys.argv[1])
cols = ','.join('str%d' % i for i in range(1, 17))
out = {}
for row in c.execute(f'select d.id,d.alias,d.setcode,d.type,d.atk,d.def,d.level,d.race,d.attribute,t.name,{cols} from datas d join texts t on t.id=d.id'):
    code, alias, setcode, typ, atk, df, level, race, attr, name, *strs = row
    while strs and not strs[-1]:
        strs.pop()
    out[code] = [alias, setcode, typ, atk, df, level, race, attr, name] + ([strs] if strs else [])
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
