import { DatabaseSync } from 'node:sqlite'
import { createCipheriv, randomBytes, createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'

const source=resolve(process.env.DATA_DIR||'./data','wedding.db')
const targetDir=resolve(process.env.BACKUP_DIR||'./backups'); mkdirSync(targetDir,{recursive:true})
const keyText=process.env.BACKUP_ENCRYPTION_KEY
if(!keyText) throw new Error('BACKUP_ENCRYPTION_KEY is required (64 hex characters)')
const key=Buffer.from(keyText,'hex'); if(key.length!==32) throw new Error('BACKUP_ENCRYPTION_KEY must be 32 bytes in hex')
const stamp=new Date().toISOString().replace(/[:.]/g,'-'); const snapshot=resolve(targetDir,`snapshot-${stamp}.db`)
const db=new DatabaseSync(source,{readOnly:true}); db.exec(`VACUUM INTO '${snapshot.replaceAll("'","''")}'`); db.close()
const plain=readFileSync(snapshot); const iv=randomBytes(12); const cipher=createCipheriv('aes-256-gcm',key,iv); const encrypted=Buffer.concat([cipher.update(plain),cipher.final()]); const tag=cipher.getAuthTag()
const output=resolve(targetDir,`wedding-${stamp}.vdbak`); writeFileSync(output,Buffer.concat([Buffer.from('VD01'),iv,tag,encrypted])); unlinkSync(snapshot)
const sha=createHash('sha256').update(readFileSync(output)).digest('hex'); writeFileSync(`${output}.sha256`,`${sha}  ${output.split('/').pop()}\n`)
console.log(JSON.stringify({status:'ok',backup:output,sha256:sha,bytes:encrypted.length}))
