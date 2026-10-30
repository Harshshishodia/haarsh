import { DatabaseSync } from 'node:sqlite'
import { createDecipheriv, createHash } from 'node:crypto'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'

const file=process.argv[2]; if(!file) throw new Error('Usage: npm run restore:verify -- /path/to/backup.vdbak')
const keyText=process.env.BACKUP_ENCRYPTION_KEY; if(!keyText) throw new Error('BACKUP_ENCRYPTION_KEY is required')
const key=Buffer.from(keyText,'hex'); if(key.length!==32) throw new Error('BACKUP_ENCRYPTION_KEY must be 32 bytes in hex')
const payload=readFileSync(resolve(file)); if(payload.subarray(0,4).toString()!=='VD01') throw new Error('Unsupported backup format')
const iv=payload.subarray(4,16),tag=payload.subarray(16,32),encrypted=payload.subarray(32); const decipher=createDecipheriv('aes-256-gcm',key,iv); decipher.setAuthTag(tag)
const plain=Buffer.concat([decipher.update(encrypted),decipher.final()]); const temp=resolve('/tmp',`vd-restore-${process.pid}.db`); writeFileSync(temp,plain)
const db=new DatabaseSync(temp,{readOnly:true}); const quick=db.prepare('PRAGMA quick_check').get(); const tables=db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table'").get(); const migrations=db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get(); db.close(); unlinkSync(temp)
if(quick.quick_check!=='ok') throw new Error(`Restore quick_check failed: ${quick.quick_check}`)
console.log(JSON.stringify({status:'ok',sha256:createHash('sha256').update(payload).digest('hex'),tables:tables.count,schemaVersion:migrations.version}))
