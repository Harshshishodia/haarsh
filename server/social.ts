import crypto from 'node:crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { db, audit } from './db.js'

type User = Record<string,unknown>
type AuthedRequest = Request & { user?:User }
type AuthMiddleware = (req:AuthedRequest,res:Response,next:NextFunction)=>unknown
const events=new Set(['Sagai','Haldi','Mehndi','Wedding'])
const hasLink=(text:string)=>/(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|in|org|net)\b)/i.test(text)
const socialEnabled=(key:string)=>(db.prepare('SELECT enabled FROM feature_flags WHERE key=?').get(key) as {enabled:number}|undefined)?.enabled===1
const uploadDir=resolve(process.env.DATA_DIR||'./data','uploads');mkdirSync(uploadDir,{recursive:true})
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1},fileFilter:(_req,file,done)=>done(null,['image/jpeg','image/png','image/webp','image/heic'].includes(file.mimetype))})
const notify=(guestId:string,actorId:string,kind:string,entityType:string,entityId:string,message:string)=>{
  if(guestId===actorId)return
  db.prepare('INSERT INTO notifications(id,guest_id,actor_id,kind,entity_type,entity_id,message) VALUES(?,?,?,?,?,?,?)').run(crypto.randomUUID(),guestId,actorId,kind,entityType,entityId,message)
}
const canPublish=(user:User)=>user.role==='admin'||user.role==='family'||Boolean((db.prepare('SELECT posting_approved FROM guest_profiles WHERE guest_id=?').get(String(user.id)) as {posting_approved:number}|undefined)?.posting_approved)
const postExists=(id:string)=>db.prepare("SELECT id,author_id,status FROM posts WHERE id=? AND status NOT IN ('deleted','hidden')").get(id) as {id:string,author_id:string,status:string}|undefined

export function socialRouter(requireAuth:AuthMiddleware,requireAdmin:AuthMiddleware){
  const router=Router()
  router.use(requireAuth)
  router.use((req,res,next)=>{
    const story=req.path.startsWith('/stories')
    if(!socialEnabled(story?'social.stories':'social.feed'))return res.status(503).json({error:'feature_not_enabled'})
    next()
  })

  router.post('/media',(req:AuthedRequest,res)=>{
    upload.single('file')(req,res,async error=>{
      if(error)return res.status(error instanceof multer.MulterError&&error.code==='LIMIT_FILE_SIZE'?413:400).json({error:'image_rejected'})
      if(!req.file)return res.status(415).json({error:'supported_image_required'})
      try{
        const key=`${crypto.randomUUID()}.webp`;const output=resolve(uploadDir,key)
        const info=await sharp(req.file.buffer,{limitInputPixels:40_000_000}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toFile(output)
        res.status(201).json({storageKey:`/api/social/media/${key}`,mediaType:'image',width:info.width,height:info.height,bytes:info.size})
      }catch{return res.status(400).json({error:'image_processing_failed'})}
    })
  })
  router.get('/media/:key',(req,res)=>{const key=String(req.params.key);if(!/^[0-9a-f-]{36}\.webp$/.test(key))return res.status(400).json({error:'invalid_media_key'});const file=resolve(uploadDir,key);if(!existsSync(file))return res.status(404).json({error:'media_not_found'});res.type('image/webp').set('cache-control','private, max-age=86400').sendFile(file)})

  router.get('/feed',(req:AuthedRequest,res)=>{
    const limit=Math.min(30,Math.max(1,Number(req.query.limit)||15)); const cursor=String(req.query.cursor||'9999-12-31T23:59:59Z'); const event=String(req.query.event||'')
    const rows=db.prepare(`SELECT p.id,p.caption,p.event_tag,p.pinned,p.alt_text,p.created_at,p.updated_at,g.id author_id,g.display_name,g.side,g.relation,gp.avatar_url,
      (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) like_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id AND c.status='published') comment_count,
      EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.guest_id=?) liked,
      EXISTS(SELECT 1 FROM saves s WHERE s.post_id=p.id AND s.guest_id=?) saved
      FROM posts p JOIN guests g ON g.id=p.author_id LEFT JOIN guest_profiles gp ON gp.guest_id=g.id
      WHERE p.status='published' AND p.created_at < ? AND (?='' OR p.event_tag=?)
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=? AND b.blocked_id=p.author_id) OR (b.blocker_id=p.author_id AND b.blocked_id=?))
      AND NOT EXISTS(SELECT 1 FROM mutes m WHERE m.guest_id=? AND m.muted_guest_id=p.author_id)
      ORDER BY p.pinned DESC,p.created_at DESC LIMIT ?`).all(String(req.user!.id),String(req.user!.id),cursor,event,event,String(req.user!.id),String(req.user!.id),String(req.user!.id),limit) as Record<string,unknown>[]
    const media=db.prepare('SELECT id,post_id,media_type,storage_key,width,height,duration_ms,position FROM post_media WHERE post_id=? ORDER BY position')
    res.json({posts:rows.map(row=>({...row,liked:Boolean(row.liked),saved:Boolean(row.saved),media:media.all(String(row.id))})),nextCursor:rows.length===limit?rows.at(-1)?.created_at:null})
  })

  router.post('/posts',(req:AuthedRequest,res)=>{
    const {caption='',eventTag=null,altText='',media=[]}=req.body||{}; const text=String(caption).trim()
    if(text.length>2200||hasLink(text))return res.status(400).json({error:hasLink(text)?'external_links_not_allowed':'caption_too_long'})
    if(eventTag&&!events.has(String(eventTag)))return res.status(400).json({error:'invalid_event'})
    if(!Array.isArray(media)||media.length>10)return res.status(400).json({error:'media_limit_10'})
    const validMedia=media.every((item:Record<string,unknown>,index:number)=>item.mediaType==='image'&&/^\/api\/social\/media\/[0-9a-f-]{36}\.webp$/.test(String(item.storageKey||''))&&Number(item.position??index)===index)
    if(!validMedia)return res.status(400).json({error:'invalid_media'})
    const id=crypto.randomUUID(); const publish=canPublish(req.user!); const status=publish?'published':'pending'
    db.exec('BEGIN')
    try{
      db.prepare('INSERT INTO posts(id,author_id,caption,event_tag,status,alt_text) VALUES(?,?,?,?,?,?)').run(id,String(req.user!.id),text,eventTag?String(eventTag):null,status,String(altText).slice(0,500))
      const insert=db.prepare('INSERT INTO post_media(id,post_id,media_type,storage_key,width,height,duration_ms,position) VALUES(?,?,?,?,?,?,?,?)')
      media.forEach((item:Record<string,unknown>,index:number)=>insert.run(crypto.randomUUID(),id,String(item.mediaType),String(item.storageKey),Number(item.width)||null,Number(item.height)||null,Number(item.durationMs)||null,index))
      if(!publish)db.prepare("INSERT INTO moderation_queue(id,entity_type,entity_id,reason) VALUES(?,'post',?,'new_guest_preapproval')").run(crypto.randomUUID(),id)
      db.exec('COMMIT')
    }catch(error){db.exec('ROLLBACK');throw error}
    audit(String(req.user!.id),'post_created','post',id,{status});res.status(201).json({id,status})
  })

  router.patch('/posts/:id',(req:AuthedRequest,res)=>{
    const post=db.prepare('SELECT author_id,status FROM posts WHERE id=?').get(String(req.params.id)) as {author_id:string,status:string}|undefined
    if(!post)return res.status(404).json({error:'post_not_found'})
    if(post.author_id!==req.user!.id&&req.user!.role!=='admin')return res.status(403).json({error:'not_allowed'})
    const caption=String(req.body?.caption??'').trim(); if(caption.length>2200||hasLink(caption))return res.status(400).json({error:'invalid_caption'})
    db.prepare('UPDATE posts SET caption=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(caption,String(req.params.id));audit(String(req.user!.id),'post_edited','post',String(req.params.id));res.json({saved:true})
  })
  router.delete('/posts/:id',(req:AuthedRequest,res)=>{
    const post=db.prepare('SELECT author_id FROM posts WHERE id=?').get(String(req.params.id)) as {author_id:string}|undefined
    if(!post)return res.status(404).json({error:'post_not_found'})
    if(post.author_id!==req.user!.id&&req.user!.role!=='admin')return res.status(403).json({error:'not_allowed'})
    db.prepare("UPDATE posts SET status='deleted',deleted_at=CURRENT_TIMESTAMP WHERE id=?").run(String(req.params.id));audit(String(req.user!.id),'post_deleted','post',String(req.params.id));res.status(204).end()
  })
  router.put('/posts/:id/like',(req:AuthedRequest,res)=>{
    const post=postExists(String(req.params.id));if(!post)return res.status(404).json({error:'post_not_found'})
    const result=db.prepare('INSERT OR IGNORE INTO post_likes(post_id,guest_id) VALUES(?,?)').run(String(req.params.id),String(req.user!.id));if(result.changes)notify(post.author_id,String(req.user!.id),'like','post',post.id,`${req.user!.display_name} liked your post`)
    res.json({liked:true,created:Boolean(result.changes)})
  })
  router.delete('/posts/:id/like',(req:AuthedRequest,res)=>{db.prepare('DELETE FROM post_likes WHERE post_id=? AND guest_id=?').run(String(req.params.id),String(req.user!.id));res.status(204).end()})
  router.put('/posts/:id/save',(req:AuthedRequest,res)=>{if(!postExists(String(req.params.id)))return res.status(404).json({error:'post_not_found'});db.prepare('INSERT OR IGNORE INTO saves(post_id,guest_id) VALUES(?,?)').run(String(req.params.id),String(req.user!.id));res.json({saved:true})})
  router.delete('/posts/:id/save',(req:AuthedRequest,res)=>{db.prepare('DELETE FROM saves WHERE post_id=? AND guest_id=?').run(String(req.params.id),String(req.user!.id));res.status(204).end()})
  router.get('/posts/:id/comments',(req,res)=>{
    const rows=db.prepare("SELECT c.id,c.parent_id,c.body,c.created_at,g.id author_id,g.display_name,g.side FROM comments c JOIN guests g ON g.id=c.author_id WHERE c.post_id=? AND c.status='published' ORDER BY c.created_at LIMIT 200").all(String(req.params.id));res.json({comments:rows})
  })
  router.post('/posts/:id/comments',(req:AuthedRequest,res)=>{
    const post=postExists(String(req.params.id));if(!post)return res.status(404).json({error:'post_not_found'});const body=String(req.body?.body||'').trim();if(body.length<1||body.length>1000||hasLink(body))return res.status(400).json({error:'invalid_comment'})
    const parentId=req.body?.parentId?String(req.body.parentId):null;if(parentId&&!db.prepare("SELECT 1 FROM comments WHERE id=? AND post_id=? AND status='published'").get(parentId,post.id))return res.status(400).json({error:'invalid_parent'})
    const id=crypto.randomUUID();db.prepare('INSERT INTO comments(id,post_id,author_id,parent_id,body) VALUES(?,?,?,?,?)').run(id,post.id,String(req.user!.id),parentId,body);notify(post.author_id,String(req.user!.id),'comment','post',post.id,`${req.user!.display_name} commented on your post`);res.status(201).json({id})
  })

  router.get('/stories',(req:AuthedRequest,res)=>{
    const rows=db.prepare(`SELECT s.id,s.author_id,s.media_type,s.storage_key,s.text_content,s.event_tag,s.expires_at,s.created_at,g.display_name,g.side,gp.avatar_url,
      EXISTS(SELECT 1 FROM story_views v WHERE v.story_id=s.id AND v.viewer_id=?) viewed,
      (SELECT COUNT(*) FROM story_views v WHERE v.story_id=s.id) view_count
      FROM stories s JOIN guests g ON g.id=s.author_id LEFT JOIN guest_profiles gp ON gp.guest_id=g.id
      WHERE s.status='published' AND s.expires_at>CURRENT_TIMESTAMP
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=? AND b.blocked_id=s.author_id) OR (b.blocker_id=s.author_id AND b.blocked_id=?)) ORDER BY s.created_at`).all(String(req.user!.id),String(req.user!.id),String(req.user!.id)) as Record<string,unknown>[]
    res.json({stories:rows.map(row=>({...row,viewed:Boolean(row.viewed),view_count:row.author_id===req.user!.id||req.user!.role==='admin'?row.view_count:undefined}))})
  })
  router.post('/stories',(req:AuthedRequest,res)=>{
    const {mediaType='text',storageKey=null,text='',eventTag=null}=req.body||{};if(!['image','video','text'].includes(mediaType)||String(text).length>500||hasLink(String(text)))return res.status(400).json({error:'invalid_story'})
    if(mediaType==='video'||mediaType==='image'&&!/^\/api\/social\/media\/[0-9a-f-]{36}\.webp$/.test(String(storageKey||'')))return res.status(400).json({error:mediaType==='video'?'video_not_enabled':'invalid_media'})
    const id=crypto.randomUUID();const publish=canPublish(req.user!);const status=publish?'published':'pending';const expires=new Date(Date.now()+86400000).toISOString()
    db.prepare('INSERT INTO stories(id,author_id,media_type,storage_key,text_content,event_tag,status,expires_at) VALUES(?,?,?,?,?,?,?,?)').run(id,String(req.user!.id),mediaType,storageKey,String(text).slice(0,500),eventTag,status,expires)
    if(!publish)db.prepare("INSERT INTO moderation_queue(id,entity_type,entity_id,reason) VALUES(?,'story',?,'new_guest_preapproval')").run(crypto.randomUUID(),id)
    res.status(201).json({id,status,expiresAt:expires})
  })
  router.put('/stories/:id/view',(req:AuthedRequest,res)=>{
    const story=db.prepare("SELECT author_id FROM stories WHERE id=? AND status='published' AND expires_at>CURRENT_TIMESTAMP").get(String(req.params.id)) as {author_id:string}|undefined;if(!story)return res.status(404).json({error:'story_not_found'})
    const result=db.prepare('INSERT OR IGNORE INTO story_views(story_id,viewer_id) VALUES(?,?)').run(String(req.params.id),String(req.user!.id));res.json({viewed:true,firstView:Boolean(result.changes)})
  })
  router.get('/stories/:id/viewers',(req:AuthedRequest,res)=>{
    const story=db.prepare('SELECT author_id FROM stories WHERE id=?').get(String(req.params.id)) as {author_id:string}|undefined;if(!story)return res.status(404).json({error:'story_not_found'});if(story.author_id!==req.user!.id&&req.user!.role!=='admin')return res.status(403).json({error:'viewer_names_private'})
    const viewers=db.prepare('SELECT g.id,g.display_name,g.side,v.first_viewed_at FROM story_views v JOIN guests g ON g.id=v.viewer_id WHERE v.story_id=? ORDER BY v.first_viewed_at DESC').all(String(req.params.id));res.json({viewers})
  })

  router.get('/profiles/:id',(req:AuthedRequest,res)=>{
    const profile=db.prepare(`SELECT g.id,g.display_name,g.side,g.relation,g.role,gp.bio,gp.avatar_url,(SELECT COUNT(*) FROM posts p WHERE p.author_id=g.id AND p.status='published') post_count FROM guests g LEFT JOIN guest_profiles gp ON gp.guest_id=g.id WHERE g.id=? AND g.status='active'`).get(String(req.params.id));if(!profile)return res.status(404).json({error:'profile_not_found'});res.json({profile})
  })
  router.put('/profile',(req:AuthedRequest,res)=>{
    const bio=String(req.body?.bio||'').trim();const avatarUrl=req.body?.avatarUrl?String(req.body.avatarUrl):null;if(bio.length>160||hasLink(bio)||avatarUrl&&!/^\/api\/social\/media\/[0-9a-f-]{36}\.webp$/.test(avatarUrl))return res.status(400).json({error:'invalid_profile'})
    db.prepare('INSERT INTO guest_profiles(guest_id,bio,avatar_url) VALUES(?,?,?) ON CONFLICT(guest_id) DO UPDATE SET bio=excluded.bio,avatar_url=excluded.avatar_url,updated_at=CURRENT_TIMESTAMP').run(String(req.user!.id),bio,avatarUrl);res.json({saved:true})
  })
  router.post('/reports',(req:AuthedRequest,res)=>{
    const {entityType,entityId,reason}=req.body||{};if(!['post','comment','story','profile'].includes(entityType)||!entityId||String(reason).trim().length<3)return res.status(400).json({error:'invalid_report'})
    const id=crypto.randomUUID();db.prepare('INSERT INTO reports(id,reporter_id,entity_type,entity_id,reason) VALUES(?,?,?,?,?)').run(id,String(req.user!.id),entityType,String(entityId),String(reason).slice(0,500));db.prepare("INSERT OR IGNORE INTO moderation_queue(id,entity_type,entity_id,reason) VALUES(?,?,?,'guest_report')").run(crypto.randomUUID(),entityType,String(entityId));res.status(201).json({id,status:'open'})
  })
  router.get('/notifications',(req:AuthedRequest,res)=>{const rows=db.prepare('SELECT id,kind,entity_type,entity_id,message,read_at,created_at FROM notifications WHERE guest_id=? ORDER BY created_at DESC LIMIT 100').all(String(req.user!.id));res.json({notifications:rows})})
  router.put('/notifications/read',(req:AuthedRequest,res)=>{db.prepare('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE guest_id=? AND read_at IS NULL').run(String(req.user!.id));res.json({read:true})})
  router.post('/blocks/:id',(req:AuthedRequest,res)=>{if(String(req.params.id)===req.user!.id)return res.status(400).json({error:'cannot_block_self'});db.prepare('INSERT OR IGNORE INTO blocks(blocker_id,blocked_id) VALUES(?,?)').run(String(req.user!.id),String(req.params.id));res.json({blocked:true})})
  router.delete('/blocks/:id',(req:AuthedRequest,res)=>{db.prepare('DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?').run(String(req.user!.id),String(req.params.id));res.status(204).end()})

  router.get('/moderation',requireAdmin,(req,res)=>{const rows=db.prepare("SELECT * FROM moderation_queue WHERE state='pending' ORDER BY created_at LIMIT 200").all();res.json({items:rows})})
  router.post('/moderation/:id',requireAdmin,(req:AuthedRequest,res)=>{
    const decision=String(req.body?.decision||'');if(!['approved','rejected'].includes(decision))return res.status(400).json({error:'invalid_decision'});const item=db.prepare("SELECT * FROM moderation_queue WHERE id=? AND state='pending'").get(String(req.params.id)) as Record<string,unknown>|undefined;if(!item)return res.status(404).json({error:'moderation_item_not_found'})
    db.exec('BEGIN');try{db.prepare('UPDATE moderation_queue SET state=?,reviewer_id=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?').run(decision,String(req.user!.id),String(req.params.id));const table=item.entity_type==='post'?'posts':item.entity_type==='story'?'stories':null;if(table)db.prepare(`UPDATE ${table} SET status=? WHERE id=?`).run(decision==='approved'?'published':'hidden',String(item.entity_id));db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}
    audit(String(req.user!.id),'content_moderated',String(item.entity_type),String(item.entity_id),{decision});res.json({decision})
  })
  return router
}
