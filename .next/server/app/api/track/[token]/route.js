(()=>{var e={};e.id=589,e.ids=[589],e.modules={1131:e=>{function t(e){var t=Error("Cannot find module '"+e+"'");throw t.code="MODULE_NOT_FOUND",t}t.keys=()=>[],t.resolve=t,t.id=1131,e.exports=t},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4770:e=>{"use strict";e.exports=require("crypto")},8678:e=>{"use strict";e.exports=import("pg")},5313:(e,t,r)=>{"use strict";r.a(e,async(e,i)=>{try{r.r(t),r.d(t,{originalPathname:()=>p,patchFetch:()=>c,requestAsyncStorage:()=>l,routeModule:()=>u,serverHooks:()=>T,staticGenerationAsyncStorage:()=>E});var n=r(9303),a=r(8716),s=r(670),o=r(4169),d=e([o]);o=(d.then?(await d)():d)[0];let u=new n.AppRouteRouteModule({definition:{kind:a.x.APP_ROUTE,page:"/api/track/[token]/route",pathname:"/api/track/[token]",filename:"route",bundlePath:"app/api/track/[token]/route"},resolvedPagePath:"/Users/hasini/BuildSecure/src/app/api/track/[token]/route.ts",nextConfigOutput:"",userland:o}),{requestAsyncStorage:l,staticGenerationAsyncStorage:E,serverHooks:T}=u,p="/api/track/[token]/route";function c(){return(0,s.patchFetch)({serverHooks:T,staticGenerationAsyncStorage:E})}i()}catch(e){i(e)}})},4169:(e,t,r)=>{"use strict";r.a(e,async(e,i)=>{try{r.r(t),r.d(t,{GET:()=>T});var n=r(7070),a=r(4770),s=r.n(a),o=r(5748),d=r(7662),c=r(7833),u=r(4235),l=r(2456),E=e([o,d,l]);async function T(e,{params:t}){let r=e.headers.get("x-forwarded-for")?.split(",")[0].trim()||"127.0.0.1",i=`ip:${r}`;if((0,l.st)(i))return n.NextResponse.json({error:"TOO_MANY_REQUESTS",message:"Security Notice: Repeated failed lookups detected from this IP. Requests temporarily restricted."},{status:429});let a=await (0,l.Dn)(`${i}:tracking`,10,6e4);if(!a.allowed)return n.NextResponse.json({error:"RATE_LIMIT_EXCEEDED",message:a.reason},{status:429,headers:{"Retry-After":"60"}});let E=u.hq.safeParse(t);if(!E.success)return await (0,l.Yy)(i),(0,c.ks)("Invalid tracking token format");let T=E.data.token,p=s().createHash("sha256").update(T).digest("hex"),_=(0,o.l)(),m=await _.query(`SELECT tracking_number, status, current_location, origin_city, destination_city, updated_at
     FROM shipments
     WHERE tracking_token_hash = $1`,[p]);if(0===m.rows.length){let e=await (0,l.Yy)(i);return await (0,d.b)({actorRole:"anonymous",action:"PUBLIC_TRACKING_LOOKUP",decision:"DENIED",reason:`Invalid tracking token probe from IP [${r}]${e.isBlocked?" (Source now blocked)":""}`,ipAddress:r}),(0,c.aX)("Tracking record not found")}let N=m.rows[0];return await (0,d.b)({actorRole:"anonymous",action:"PUBLIC_TRACKING_LOOKUP",decision:"ALLOWED",reason:`Public tracking lookup for ${N.tracking_number} (coarse location returned)`,ipAddress:r}),n.NextResponse.json({tracking_number:N.tracking_number,status:N.status,current_location:N.current_location,origin_city:N.origin_city,destination_city:N.destination_city,last_updated:N.updated_at})}[o,d,l]=E.then?(await E)():E,i()}catch(e){i(e)}})},7662:(e,t,r)=>{"use strict";r.a(e,async(e,i)=>{try{r.d(t,{b:()=>o,x:()=>d});var n=r(5748),a=e([n]);function s(e){return e.replace(/(bearer\s+[a-zA-Z0-9_\-\.]+)/gi,"[REDACTED_TOKEN]").replace(/(password|secret|key)=([^\s&]+)/gi,"$1=[REDACTED]").slice(0,500)}async function o(e){let t=(0,n.l)(),r=s(e.reason),i=s(e.action),a=e.actorRole||"anonymous",o=e.actorId||null,d=e.shipmentId||null,c=e.ipAddress?e.ipAddress.slice(0,45):null;return(await t.query(`INSERT INTO audit_log (actor_id, actor_role, action, shipment_id, decision, reason, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, timestamp, actor_id, actor_role, action, shipment_id, decision, reason, ip_address, created_at`,[o,a,i,d,e.decision,r,c])).rows[0]}async function d(e,t=100){let r=(0,n.l)(),i=await r.query("SELECT role FROM profiles WHERE id = $1",[e]);if(0===i.rows.length||"admin"!==i.rows[0].role)throw await o({actorId:e,actorRole:i.rows[0]?.role||"anonymous",action:"AUDIT_LOG_READ",decision:"DENIED",reason:"Unauthorized attempt to inspect security audit logs (admin required)"}),Error("FORBIDDEN: Only administrators can read audit entries.");let a=await r.query(`SELECT id, timestamp, actor_id, actor_role, action, shipment_id, decision, reason, ip_address, created_at
     FROM audit_log
     ORDER BY timestamp DESC
     LIMIT $1`,[Math.min(t,500)]);return await o({actorId:e,actorRole:"admin",action:"AUDIT_LOG_READ",decision:"ALLOWED",reason:`Admin retrieved ${a.rows.length} audit log entries`}),a.rows}n=(a.then?(await a)():a)[0],i()}catch(e){i(e)}})},5748:(e,t,r)=>{"use strict";r.a(e,async(e,i)=>{try{r.d(t,{l:()=>o});var n=r(8678),a=r(9279),s=e([n]);n=(s.then?(await s)():s)[0];let d=null,c=null;function o(){if(c)return c;let e=process.env.DATABASE_URL||process.env.POSTGRES_URL;return e?(d||(d=new n.Pool({connectionString:e,ssl:{rejectUnauthorized:!1}})),{query:async(e,t)=>d.query(e,t),isTestDb:()=>!1}):(c||(c=function(){let e=(0,a.newDb)();e.public.registerFunction({name:"gen_random_uuid",returns:e.public.getType("uuid"),impure:!0,implementation:()=>crypto.randomUUID()}),e.public.registerFunction({name:"uuid_generate_v4",returns:e.public.getType("uuid"),impure:!0,implementation:()=>crypto.randomUUID()}),e.public.none(`
    CREATE TABLE profiles (
      id UUID PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('customer', 'driver', 'admin')),
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE shipments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tracking_number TEXT NOT NULL UNIQUE,
      tracking_token_hash TEXT NOT NULL UNIQUE,
      customer_id UUID NOT NULL REFERENCES profiles(id),
      status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'assigned', 'picked_up', 'in_transit', 'delivered')),
      origin_city TEXT NOT NULL,
      destination_city TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      current_location TEXT NOT NULL DEFAULT 'Dispatch Center',
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_id UUID NOT NULL REFERENCES shipments(id),
      driver_id UUID NOT NULL REFERENCES profiles(id),
      assigned_by UUID NOT NULL REFERENCES profiles(id),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE shipment_status_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_id UUID NOT NULL REFERENCES shipments(id),
      from_status TEXT NOT NULL CHECK (from_status IN ('created', 'assigned', 'picked_up', 'in_transit', 'delivered')),
      to_status TEXT NOT NULL CHECK (to_status IN ('created', 'assigned', 'picked_up', 'in_transit', 'delivered')),
      actor_id UUID NOT NULL REFERENCES profiles(id),
      location TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actor_id UUID REFERENCES profiles(id),
      actor_role TEXT NOT NULL DEFAULT 'anonymous',
      action TEXT NOT NULL,
      shipment_id UUID,
      decision TEXT NOT NULL CHECK (decision IN ('ALLOWED', 'DENIED')),
      reason TEXT NOT NULL,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);let t=new(e.adapters.createPg()).Pool;return{query:async(e,r)=>t.query(e,r),isTestDb:()=>!0}}()),c)}i()}catch(e){i(e)}})},7833:(e,t,r)=>{"use strict";r.d(t,{Py:()=>s,aX:()=>n,ks:()=>o,m:()=>a});var i=r(7070);function n(e="Shipment not found"){return i.NextResponse.json({error:"NOT_FOUND",message:e},{status:404})}function a(e="Authentication required"){return i.NextResponse.json({error:"UNAUTHORIZED",message:e},{status:401})}function s(e="Permission denied"){return i.NextResponse.json({error:"FORBIDDEN",message:e},{status:403})}function o(e,t){return i.NextResponse.json({error:"BAD_REQUEST",message:e,...t?{details:t}:{}},{status:400})}},2456:(e,t,r)=>{"use strict";r.a(e,async(e,i)=>{try{r.d(t,{Dn:()=>s,Yy:()=>o,st:()=>d});var n=r(7662),a=e([n]);n=(a.then?(await a)():a)[0];let c=new Map,u=new Map;async function s(e,t,r){let i=Date.now(),n=c.get(e);return!n||i>n.resetAt?(c.set(e,{count:1,resetAt:i+r}),{allowed:!0,remaining:t-1,resetAt:i+r}):n.count>=t?{allowed:!1,remaining:0,resetAt:n.resetAt,reason:"Rate limit exceeded. Please retry after cooldown."}:(n.count+=1,{allowed:!0,remaining:t-n.count,resetAt:n.resetAt})}async function o(e,t){let r=Date.now(),i=u.get(e);if(!i||r-i.lastAttempt>3e5)return i={count:1,lastAttempt:r,isBlockedUntil:0},u.set(e,i),{isBlocked:!1,alertLogged:!1};if(i.isBlockedUntil>r)return{isBlocked:!0,alertLogged:!1};if(i.count+=1,i.lastAttempt=r,i.count>=5){i.isBlockedUntil=r+9e5;let t=e.replace(/[^a-zA-Z0-9_\-.:]/g,"").slice(0,45);return await (0,n.b)({actorRole:"anonymous",action:"SECURITY_ALERT_PROBING_DETECTED",decision:"DENIED",reason:`Probing attack detected: repeated failed tracking token lookups (${i.count} failures) from source [${t}]. Blocked for 15 minutes.`,ipAddress:t}),{isBlocked:!0,alertLogged:!0}}return{isBlocked:!1,alertLogged:!1}}function d(e){let t=u.get(e);return!!t&&t.isBlockedUntil>Date.now()}i()}catch(e){i(e)}})},4235:(e,t,r)=>{"use strict";r.d(t,{Dh:()=>s,WQ:()=>a,hn:()=>c,hq:()=>d,jd:()=>n,uf:()=>o});var i=r(1067);let n=i.Z_().uuid({message:"Invalid UUID identifier"}),a=i.Ry({origin_city:i.Z_().min(2).max(100).trim(),destination_city:i.Z_().min(2).max(100).trim(),delivery_address:i.Z_().min(5).max(300).trim(),notes:i.Z_().max(1e3).default("").transform(e=>e.trim())}),s=i.Ry({status:i.Km(["assigned","picked_up","in_transit","delivered"],{errorMap:()=>({message:"Invalid status value"})}),location:i.Z_().min(2).max(100).trim(),notes:i.Z_().max(1e3).optional().default("")}),o=i.Ry({driver_id:n}),d=i.Ry({token:i.Z_().min(16).max(128).regex(/^[a-zA-Z0-9_-]+$/,{message:"Invalid tracking token format"})}),c=i.Ry({id:n})}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),i=t.X(0,[276,69,67],()=>r(5313));module.exports=i})();