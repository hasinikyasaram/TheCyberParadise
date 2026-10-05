(()=>{var e={};e.id=117,e.ids=[117],e.modules={1131:e=>{function t(e){var t=Error("Cannot find module '"+e+"'");throw t.code="MODULE_NOT_FOUND",t}t.keys=()=>[],t.resolve=t,t.id=1131,e.exports=t},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4770:e=>{"use strict";e.exports=require("crypto")},8678:e=>{"use strict";e.exports=import("pg")},2145:(e,t,i)=>{"use strict";i.a(e,async(e,r)=>{try{i.r(t),i.d(t,{originalPathname:()=>m,patchFetch:()=>u,requestAsyncStorage:()=>E,routeModule:()=>c,serverHooks:()=>l,staticGenerationAsyncStorage:()=>T});var s=i(9303),a=i(8716),n=i(670),o=i(6151),d=e([o]);o=(d.then?(await d)():d)[0];let c=new s.AppRouteRouteModule({definition:{kind:a.x.APP_ROUTE,page:"/api/shipments/[id]/route",pathname:"/api/shipments/[id]",filename:"route",bundlePath:"app/api/shipments/[id]/route"},resolvedPagePath:"/Users/hasini/BuildSecure/src/app/api/shipments/[id]/route.ts",nextConfigOutput:"",userland:o}),{requestAsyncStorage:E,staticGenerationAsyncStorage:T,serverHooks:l}=c,m="/api/shipments/[id]/route";function u(){return(0,n.patchFetch)({serverHooks:l,staticGenerationAsyncStorage:T})}r()}catch(e){r(e)}})},6151:(e,t,i)=>{"use strict";i.a(e,async(e,r)=>{try{i.r(t),i.d(t,{GET:()=>T});var s=i(7070),a=i(5456),n=i(5748),o=i(7662),d=i(7833),u=i(4235),c=i(4787),E=e([a,n,o,c]);async function T(e,{params:t}){let i=await (0,a.j)(e);if(!i)return await (0,o.b)({actorRole:"anonymous",action:"READ_SHIPMENT",decision:"DENIED",reason:"Unauthenticated request to read shipment"}),(0,d.m)();let r=u.hn.safeParse(t);if(!r.success)return(0,d.ks)("Invalid shipment ID format");let E=r.data.id,T=(0,n.l)(),l=await T.query("SELECT * FROM shipments WHERE id = $1",[E]);if(0===l.rows.length)return await (0,o.b)({actorId:i.user.id,actorRole:i.user.role,action:"READ_SHIPMENT",shipmentId:E,decision:"DENIED",reason:"Shipment ID does not exist"}),(0,d.aX)();let m=l.rows[0],p=!1;return("admin"===i.user.role?p=!0:"customer"===i.user.role?p=m.customer_id===i.user.id:"driver"===i.user.role&&(p=await (0,c.Gf)(T,m.id,i.user.id)),p)?(await (0,o.b)({actorId:i.user.id,actorRole:i.user.role,action:"READ_SHIPMENT",shipmentId:E,decision:"ALLOWED",reason:`Authorized read of shipment ${m.tracking_number} by ${i.user.role}`}),s.NextResponse.json({shipment:m})):(await (0,o.b)({actorId:i.user.id,actorRole:i.user.role,action:"READ_SHIPMENT",shipmentId:E,decision:"DENIED",reason:`Unauthorized read attempt by role '${i.user.role}' on shipment owned by '${m.customer_id}' (anti-enumeration 404 returned)`}),(0,d.aX)())}[a,n,o,c]=E.then?(await E)():E,r()}catch(e){r(e)}})},7662:(e,t,i)=>{"use strict";i.a(e,async(e,r)=>{try{i.d(t,{b:()=>o,x:()=>d});var s=i(5748),a=e([s]);function n(e){return e.replace(/(bearer\s+[a-zA-Z0-9_\-\.]+)/gi,"[REDACTED_TOKEN]").replace(/(password|secret|key)=([^\s&]+)/gi,"$1=[REDACTED]").slice(0,500)}async function o(e){let t=(0,s.l)(),i=n(e.reason),r=n(e.action),a=e.actorRole||"anonymous",o=e.actorId||null,d=e.shipmentId||null,u=e.ipAddress?e.ipAddress.slice(0,45):null;return(await t.query(`INSERT INTO audit_log (actor_id, actor_role, action, shipment_id, decision, reason, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, timestamp, actor_id, actor_role, action, shipment_id, decision, reason, ip_address, created_at`,[o,a,r,d,e.decision,i,u])).rows[0]}async function d(e,t=100){let i=(0,s.l)(),r=await i.query("SELECT role FROM profiles WHERE id = $1",[e]);if(0===r.rows.length||"admin"!==r.rows[0].role)throw await o({actorId:e,actorRole:r.rows[0]?.role||"anonymous",action:"AUDIT_LOG_READ",decision:"DENIED",reason:"Unauthorized attempt to inspect security audit logs (admin required)"}),Error("FORBIDDEN: Only administrators can read audit entries.");let a=await i.query(`SELECT id, timestamp, actor_id, actor_role, action, shipment_id, decision, reason, ip_address, created_at
     FROM audit_log
     ORDER BY timestamp DESC
     LIMIT $1`,[Math.min(t,500)]);return await o({actorId:e,actorRole:"admin",action:"AUDIT_LOG_READ",decision:"ALLOWED",reason:`Admin retrieved ${a.rows.length} audit log entries`}),a.rows}s=(a.then?(await a)():a)[0],r()}catch(e){r(e)}})},5456:(e,t,i)=>{"use strict";i.a(e,async(e,r)=>{try{i.d(t,{j:()=>n});var s=i(5748),a=e([s]);async function n(e){let t=e.headers.get("authorization"),i=e.headers.get("x-user-id"),r=null;if(i)/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(i)&&(r=i);else if(t&&t.startsWith("Bearer ")){let e=t.substring(7).trim();e.startsWith("user_")&&(r=e.replace("user_",""))}if(!r)return null;let a=(0,s.l)(),n=await a.query("SELECT id, role, full_name, email FROM profiles WHERE id = $1",[r]);if(0===n.rows.length)return null;let o=n.rows[0];return{user:{id:o.id,email:o.email,role:o.role,full_name:o.full_name}}}s=(a.then?(await a)():a)[0],r()}catch(e){r(e)}})},5748:(e,t,i)=>{"use strict";i.a(e,async(e,r)=>{try{i.d(t,{l:()=>o});var s=i(8678),a=i(9279),n=e([s]);s=(n.then?(await n)():n)[0];let d=null,u=null;function o(){if(u)return u;let e=process.env.DATABASE_URL||process.env.POSTGRES_URL;return e?(d||(d=new s.Pool({connectionString:e,ssl:{rejectUnauthorized:!1}})),{query:async(e,t)=>d.query(e,t),isTestDb:()=>!1}):(u||(u=function(){let e=(0,a.newDb)();e.public.registerFunction({name:"gen_random_uuid",returns:e.public.getType("uuid"),impure:!0,implementation:()=>crypto.randomUUID()}),e.public.registerFunction({name:"uuid_generate_v4",returns:e.public.getType("uuid"),impure:!0,implementation:()=>crypto.randomUUID()}),e.public.none(`
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
  `);let t=new(e.adapters.createPg()).Pool;return{query:async(e,i)=>t.query(e,i),isTestDb:()=>!0}}()),u)}r()}catch(e){r(e)}})},7833:(e,t,i)=>{"use strict";i.d(t,{Py:()=>n,aX:()=>s,ks:()=>o,m:()=>a});var r=i(7070);function s(e="Shipment not found"){return r.NextResponse.json({error:"NOT_FOUND",message:e},{status:404})}function a(e="Authentication required"){return r.NextResponse.json({error:"UNAUTHORIZED",message:e},{status:401})}function n(e="Permission denied"){return r.NextResponse.json({error:"FORBIDDEN",message:e},{status:403})}function o(e,t){return r.NextResponse.json({error:"BAD_REQUEST",message:e,...t?{details:t}:{}},{status:400})}},4787:(e,t,i)=>{"use strict";i.a(e,async(e,r)=>{try{i.d(t,{Cs:()=>d,Gf:()=>o,RW:()=>u,qG:()=>c});var s=i(2114),a=i(7662),n=e([a]);a=(n.then?(await n)():n)[0];class u extends Error{constructor(e){super(e),this.name="StateTransitionError"}}class c extends Error{constructor(e){super(e),this.name="UnauthorizedTransitionError"}}async function o(e,t,i){return(await e.query(`SELECT 1 FROM assignments
     WHERE shipment_id = $1 AND driver_id = $2 AND is_active = TRUE`,[t,i])).rows.length>0}async function d(e,t){let{shipmentId:i,newStatus:r,actorId:n,actorRole:d,location:E,notes:T,ipAddress:l}=t,m=await e.query("SELECT * FROM shipments WHERE id = $1",[i]);if(0===m.rows.length)throw await (0,a.b)({actorId:n,actorRole:d,action:"UPDATE_SHIPMENT_STATUS",shipmentId:i,decision:"DENIED",reason:"Shipment does not exist",ipAddress:l}),new u("Shipment not found");let p=m.rows[0];if("driver"===d&&!await o(e,i,n))throw await (0,a.b)({actorId:n,actorRole:"driver",action:"UPDATE_SHIPMENT_STATUS",shipmentId:i,decision:"DENIED",reason:"Driver is not actively assigned to this shipment",ipAddress:l}),new c("Driver is not actively assigned to this shipment");if(!function(e,t){let i=s.j[e];return!!i&&i.includes(t)}(p.status,r)){let e=`Invalid status transition from '${p.status}' to '${r}' (must follow created -> assigned -> picked_up -> in_transit -> delivered)`;throw await (0,a.b)({actorId:n,actorRole:d,action:"UPDATE_SHIPMENT_STATUS",shipmentId:i,decision:"DENIED",reason:e,ipAddress:l}),new u(e)}let _=await e.query(`UPDATE shipments
     SET status = $1, current_location = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,[r,E,i]);return await e.query(`INSERT INTO shipment_status_events (shipment_id, from_status, to_status, actor_id, location, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,[i,p.status,r,n,E,T||""]),await (0,a.b)({actorId:n,actorRole:d,action:"UPDATE_SHIPMENT_STATUS",shipmentId:i,decision:"ALLOWED",reason:`Status successfully updated from '${p.status}' to '${r}'`,ipAddress:l}),_.rows[0]}r()}catch(e){r(e)}})},2114:(e,t,i)=>{"use strict";i.d(t,{j:()=>r});let r={created:["assigned"],assigned:["picked_up"],picked_up:["in_transit"],in_transit:["delivered"],delivered:[]}},4235:(e,t,i)=>{"use strict";i.d(t,{Dh:()=>n,WQ:()=>a,hn:()=>u,hq:()=>d,jd:()=>s,uf:()=>o});var r=i(1067);let s=r.Z_().uuid({message:"Invalid UUID identifier"}),a=r.Ry({origin_city:r.Z_().min(2).max(100).trim(),destination_city:r.Z_().min(2).max(100).trim(),delivery_address:r.Z_().min(5).max(300).trim(),notes:r.Z_().max(1e3).default("").transform(e=>e.trim())}),n=r.Ry({status:r.Km(["assigned","picked_up","in_transit","delivered"],{errorMap:()=>({message:"Invalid status value"})}),location:r.Z_().min(2).max(100).trim(),notes:r.Z_().max(1e3).optional().default("")}),o=r.Ry({driver_id:s}),d=r.Ry({token:r.Z_().min(16).max(128).regex(/^[a-zA-Z0-9_-]+$/,{message:"Invalid tracking token format"})}),u=r.Ry({id:s})}};var t=require("../../../../webpack-runtime.js");t.C(e);var i=e=>t(t.s=e),r=t.X(0,[276,69,67],()=>i(2145));module.exports=r})();