(()=>{var e={};e.id=364,e.ids=[364],e.modules={1131:e=>{function t(e){var t=Error("Cannot find module '"+e+"'");throw t.code="MODULE_NOT_FOUND",t}t.keys=()=>[],t.resolve=t,t.id=1131,e.exports=t},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4770:e=>{"use strict";e.exports=require("crypto")},8678:e=>{"use strict";e.exports=import("pg")},6385:(e,t,r)=>{"use strict";r.a(e,async(e,i)=>{try{r.r(t),r.d(t,{originalPathname:()=>m,patchFetch:()=>u,requestAsyncStorage:()=>E,routeModule:()=>c,serverHooks:()=>l,staticGenerationAsyncStorage:()=>T});var s=r(9303),a=r(8716),n=r(670),o=r(2124),d=e([o]);o=(d.then?(await d)():d)[0];let c=new s.AppRouteRouteModule({definition:{kind:a.x.APP_ROUTE,page:"/api/shipments/route",pathname:"/api/shipments",filename:"route",bundlePath:"app/api/shipments/route"},resolvedPagePath:"/Users/hasini/BuildSecure/src/app/api/shipments/route.ts",nextConfigOutput:"",userland:o}),{requestAsyncStorage:E,staticGenerationAsyncStorage:T,serverHooks:l}=c,m="/api/shipments/route";function u(){return(0,n.patchFetch)({serverHooks:l,staticGenerationAsyncStorage:T})}i()}catch(e){i(e)}})},2124:(e,t,r)=>{"use strict";r.a(e,async(e,i)=>{try{r.r(t),r.d(t,{GET:()=>l,POST:()=>m});var s=r(7070),a=r(4770),n=r.n(a),o=r(5456),d=r(5748),u=r(7662),c=r(4235),E=r(7833),T=e([o,d,u]);async function l(e){let t=await (0,o.j)(e);if(!t)return await (0,u.b)({actorRole:"anonymous",action:"LIST_SHIPMENTS",decision:"DENIED",reason:"Unauthenticated request to list shipments"}),(0,E.m)();let r=(0,d.l)(),i=[];return"customer"===t.user.role?i=(await r.query("SELECT * FROM shipments WHERE customer_id = $1 ORDER BY created_at DESC",[t.user.id])).rows:"driver"===t.user.role?i=(await r.query(`SELECT s.* FROM shipments s
       INNER JOIN assignments a ON a.shipment_id = s.id
       WHERE a.driver_id = $1 AND a.is_active = TRUE
       ORDER BY s.created_at DESC`,[t.user.id])).rows:"admin"===t.user.role&&(i=(await r.query("SELECT * FROM shipments ORDER BY created_at DESC")).rows),await (0,u.b)({actorId:t.user.id,actorRole:t.user.role,action:"LIST_SHIPMENTS",decision:"ALLOWED",reason:`Retrieved ${i.length} authorized shipments for ${t.user.role}`}),s.NextResponse.json({shipments:i})}async function m(e){let t;let r=await (0,o.j)(e);if(!r)return await (0,u.b)({actorRole:"anonymous",action:"CREATE_SHIPMENT",decision:"DENIED",reason:"Unauthenticated request to create shipment"}),(0,E.m)();if("customer"!==r.user.role&&"admin"!==r.user.role)return await (0,u.b)({actorId:r.user.id,actorRole:r.user.role,action:"CREATE_SHIPMENT",decision:"DENIED",reason:`Role '${r.user.role}' is not authorized to create shipments`}),(0,E.Py)("Only customers and admins can create shipments");try{t=await e.json()}catch{return(0,E.ks)("Invalid JSON body")}let i=c.WQ.safeParse(t);if(!i.success)return(0,E.ks)("Validation failed",i.error.format());let{origin_city:a,destination_city:T,delivery_address:l,notes:m}=i.data,p=r.user.id,N="ST-"+n().randomBytes(4).toString("hex").toUpperCase(),_=n().randomBytes(24).toString("hex"),L=n().createHash("sha256").update(_).digest("hex"),U=(0,d.l)(),R=(await U.query(`INSERT INTO shipments (
       tracking_number, tracking_token_hash, customer_id, status,
       origin_city, destination_city, delivery_address, notes
     )
     VALUES ($1, $2, $3, 'created', $4, $5, $6, $7)
     RETURNING *`,[N,L,p,a,T,l,m])).rows[0];return await (0,u.b)({actorId:r.user.id,actorRole:r.user.role,action:"CREATE_SHIPMENT",shipmentId:R.id,decision:"ALLOWED",reason:`Shipment created with tracking ${N}`}),s.NextResponse.json({shipment:R,public_tracking_token:_},{status:201})}[o,d,u]=T.then?(await T)():T,i()}catch(e){i(e)}})},7662:(e,t,r)=>{"use strict";r.a(e,async(e,i)=>{try{r.d(t,{b:()=>o,x:()=>d});var s=r(5748),a=e([s]);function n(e){return e.replace(/(bearer\s+[a-zA-Z0-9_\-\.]+)/gi,"[REDACTED_TOKEN]").replace(/(password|secret|key)=([^\s&]+)/gi,"$1=[REDACTED]").slice(0,500)}async function o(e){let t=(0,s.l)(),r=n(e.reason),i=n(e.action),a=e.actorRole||"anonymous",o=e.actorId||null,d=e.shipmentId||null,u=e.ipAddress?e.ipAddress.slice(0,45):null;return(await t.query(`INSERT INTO audit_log (actor_id, actor_role, action, shipment_id, decision, reason, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, timestamp, actor_id, actor_role, action, shipment_id, decision, reason, ip_address, created_at`,[o,a,i,d,e.decision,r,u])).rows[0]}async function d(e,t=100){let r=(0,s.l)(),i=await r.query("SELECT role FROM profiles WHERE id = $1",[e]);if(0===i.rows.length||"admin"!==i.rows[0].role)throw await o({actorId:e,actorRole:i.rows[0]?.role||"anonymous",action:"AUDIT_LOG_READ",decision:"DENIED",reason:"Unauthorized attempt to inspect security audit logs (admin required)"}),Error("FORBIDDEN: Only administrators can read audit entries.");let a=await r.query(`SELECT id, timestamp, actor_id, actor_role, action, shipment_id, decision, reason, ip_address, created_at
     FROM audit_log
     ORDER BY timestamp DESC
     LIMIT $1`,[Math.min(t,500)]);return await o({actorId:e,actorRole:"admin",action:"AUDIT_LOG_READ",decision:"ALLOWED",reason:`Admin retrieved ${a.rows.length} audit log entries`}),a.rows}s=(a.then?(await a)():a)[0],i()}catch(e){i(e)}})},5456:(e,t,r)=>{"use strict";r.a(e,async(e,i)=>{try{r.d(t,{j:()=>n});var s=r(5748),a=e([s]);async function n(e){let t=e.headers.get("authorization"),r=e.headers.get("x-user-id"),i=null;if(r)/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r)&&(i=r);else if(t&&t.startsWith("Bearer ")){let e=t.substring(7).trim();e.startsWith("user_")&&(i=e.replace("user_",""))}if(!i)return null;let a=(0,s.l)(),n=await a.query("SELECT id, role, full_name, email FROM profiles WHERE id = $1",[i]);if(0===n.rows.length)return null;let o=n.rows[0];return{user:{id:o.id,email:o.email,role:o.role,full_name:o.full_name}}}s=(a.then?(await a)():a)[0],i()}catch(e){i(e)}})},5748:(e,t,r)=>{"use strict";r.a(e,async(e,i)=>{try{r.d(t,{l:()=>o});var s=r(8678),a=r(9279),n=e([s]);s=(n.then?(await n)():n)[0];let d=null,u=null;function o(){if(u)return u;let e=process.env.DATABASE_URL||process.env.POSTGRES_URL;return e?(d||(d=new s.Pool({connectionString:e,ssl:{rejectUnauthorized:!1}})),{query:async(e,t)=>d.query(e,t),isTestDb:()=>!1}):(u||(u=function(){let e=(0,a.newDb)();e.public.registerFunction({name:"gen_random_uuid",returns:e.public.getType("uuid"),impure:!0,implementation:()=>crypto.randomUUID()}),e.public.registerFunction({name:"uuid_generate_v4",returns:e.public.getType("uuid"),impure:!0,implementation:()=>crypto.randomUUID()}),e.public.none(`
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
  `);let t=new(e.adapters.createPg()).Pool;return{query:async(e,r)=>t.query(e,r),isTestDb:()=>!0}}()),u)}i()}catch(e){i(e)}})},7833:(e,t,r)=>{"use strict";r.d(t,{Py:()=>n,aX:()=>s,ks:()=>o,m:()=>a});var i=r(7070);function s(e="Shipment not found"){return i.NextResponse.json({error:"NOT_FOUND",message:e},{status:404})}function a(e="Authentication required"){return i.NextResponse.json({error:"UNAUTHORIZED",message:e},{status:401})}function n(e="Permission denied"){return i.NextResponse.json({error:"FORBIDDEN",message:e},{status:403})}function o(e,t){return i.NextResponse.json({error:"BAD_REQUEST",message:e,...t?{details:t}:{}},{status:400})}},4235:(e,t,r)=>{"use strict";r.d(t,{Dh:()=>n,WQ:()=>a,hn:()=>u,hq:()=>d,jd:()=>s,uf:()=>o});var i=r(1067);let s=i.Z_().uuid({message:"Invalid UUID identifier"}),a=i.Ry({origin_city:i.Z_().min(2).max(100).trim(),destination_city:i.Z_().min(2).max(100).trim(),delivery_address:i.Z_().min(5).max(300).trim(),notes:i.Z_().max(1e3).default("").transform(e=>e.trim())}),n=i.Ry({status:i.Km(["assigned","picked_up","in_transit","delivered"],{errorMap:()=>({message:"Invalid status value"})}),location:i.Z_().min(2).max(100).trim(),notes:i.Z_().max(1e3).optional().default("")}),o=i.Ry({driver_id:s}),d=i.Ry({token:i.Z_().min(16).max(128).regex(/^[a-zA-Z0-9_-]+$/,{message:"Invalid tracking token format"})}),u=i.Ry({id:s})}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),i=t.X(0,[276,69,67],()=>r(6385));module.exports=i})();