import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const dbPath=process.argv[2]||'./firewell.sqlite',out=process.argv[3]||'./admin-exports';
const db=new DatabaseSync(dbPath,{readOnly:true});
mkdirSync(out,{recursive:true,mode:0o700});
for(const [file,sql] of [
 ['reports.jsonl',"SELECT f.id,f.account_id AS accountId,COALESCE(a.login,'Удалённый игрок') AS login,f.category,f.title,f.room_code AS roomCode,f.body,f.status,f.created_at AS createdAt FROM feedback f LEFT JOIN accounts a ON a.id=f.account_id ORDER BY f.id"],
 ['chat.jsonl',"SELECT m.id,m.account_id AS accountId,COALESCE(a.login,'Удалённый игрок') AS login,m.body,m.created_at AS createdAt FROM chat_messages m LEFT JOIN accounts a ON a.id=m.account_id ORDER BY m.id"]
]){
 const rows=db.prepare(sql).all();writeFileSync(join(out,file),rows.map(x=>JSON.stringify(x)).join('\n')+'\n',{mode:0o600});
 console.log(file+': '+rows.length+' records');
}
db.close();
