const base=process.env.BASE_URL||'http://127.0.0.1:4173'
const checks=[]
async function check(name,fn){try{await fn();checks.push({name,state:'passed'})}catch(error){checks.push({name,state:'failed',error:error.message})}}
await check('security_headers',async()=>{const r=await fetch(`${base}/api/health`);for(const h of ['content-security-policy','x-content-type-options','x-frame-options','referrer-policy','x-request-id'])if(!r.headers.get(h))throw new Error(`missing_${h}`)})
await check('admin_requires_auth',async()=>{const r=await fetch(`${base}/api/hardening/status`);if(r.status!==401)throw new Error(`expected_401_got_${r.status}`)})
await check('cross_origin_write_blocked',async()=>{const r=await fetch(`${base}/api/auth/challenges`,{method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json'},body:'{}'});if(r.status!==403)throw new Error(`expected_403_got_${r.status}`)})
await check('oversized_json_rejected',async()=>{const r=await fetch(`${base}/api/auth/challenges`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({padding:'x'.repeat(300000)})});if(r.status!==413)throw new Error(`expected_413_got_${r.status}`)})
await check('telegram_webhook_closed_without_secret',async()=>{const r=await fetch(`${base}/api/webhooks/telegram`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});if(![401,503].includes(r.status))throw new Error(`expected_401_or_503_got_${r.status}`)})
console.log(JSON.stringify({state:checks.every(c=>c.state==='passed')?'passed':'failed',checks},null,2));if(checks.some(c=>c.state==='failed'))process.exit(1)
