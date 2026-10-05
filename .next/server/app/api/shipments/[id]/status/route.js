(()=>{var e={};e.id=851,e.ids=[851],e.modules={1131:e=>{function t(e){var t=Error("Cannot find module '"+e+"'");throw t.code="MODULE_NOT_FOUND",t}t.keys=()=>[],t.resolve=t,t.id=1131,e.exports=t},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4770:e=>{"use strict";e.exports=require("crypto")},8678:e=>{"use strict";e.exports=import("pg")},7986:(e,t,i)=>{"use strict";i.a(e,async(e,s)=>{try{i.r(t),i.d(t,{originalPathname:()=>p,patchFetch:()=>u,requestAsyncStorage:()=>E,routeModule:()=>c,serverHooks:()=>l,staticGenerationAsyncStorage:()=>T});var r=i(9303),a=i(8716),n=i(670),o=i(3632),d=e([o]);o=(d.then?(await d)():d)[0];let c=new r.AppRouteRouteModule({definition:{kind:a.x.APP_ROUTE,page:"/api/shipments/[id]/status/route",pathname:"/api/shipments/[id]/status",filename:"route",bundlePath:"app/api/shipments/[id]/status/route"},resolvedPagePath:"/Users/hasini/BuildSecure/src/app/api/shipments/[id]/status/route.ts",nextConfigOutput:"",userland:o}),{requestAsyncStorage:E,staticGenerationAsyncStorage:T,serverHooks:l}=c,p="/api/shipments/[id]/status/route";function u(){return(0,n.patchFetch)({serverHooks:l,staticGenerationAsyncStorage:T})}s()}catch(e){s(e)}})},3632:(e,t,i)=>{"use strict";i.a(e,async(e,s)=>{try{i.r(t),i.d(t,{POST:()=>T});var r=i(7070),a=i(5456),n=i(5748),o=i(7662),d=i(7833),u=i(4235),c=i(4787),E=e([a,n,o,c]);async function T(e,{params:t}){let i;let s=await (0,a.j)(e);if(!s)return await (0,o.b)({actorRole:"anonymous",action:"UPDATE_SHIPMENT_STATUS",decision:"DENIED",reason:"Unauthenticated request to update status"}),(0,d.m)();if("driver"!==s.user.role&&"admin"!==s.user.role)return await (0,o.b)({actorId:s.user.id,actorRole:s.user.role,action:"UPDATE_SHIPMENT_STATUS",decision:"DENIED",reason:`Role '${s.user.role}' is not permitted to update shipment status`}),(0,d.Py)("Only drivers and administrators can update status");let E=u.hn.safeParse(t);if(!E.success)return(0,d.ks)("Invalid shipment ID");try{i=await e.json()}catch{return(0,d.ks)("Invalid JSON body")}let T=u.Dh.safeParse(i);if(!T.success)return(0,d.ks)("Validation failed",T.error.format());let l=(0,n.l)();try{let e=await (0,c.Cs)(l,{shipmentId:E.data.id,newStatus:T.data.status,actorId:s.user.id,actorRole:s.user.role,location:T.data.location,notes:T.data.notes});return r.NextResponse.json({shipment:e})}catch(e){if(e instanceof c.qG)return(0,d.Py)(e.message);if(e instanceof c.RW)return(0,d.ks)(e.message);return(0,d.ks)("Failed to update shipment status")}}[a,n,o,c]=E.then?(await E)():E,s()}catch(e){s(e)}})},7662:(e,t,i)=>{"use strict";i.a(e,async(e,s)=>{try{i.d(t,{b:()=>o,x:()=>d});var r=i(5748),a=e([r]);function n(e){return e.replace(/(bearer\s+[a-zA-Z0-9_\-\.]+)/gi,"[REDACTED_TOKEN]").replace(/(password|secret|key)=([^\s&]+)/gi,"$1=[REDACTED]").slice(0,500)}async function o(e){let t=(0,r.l)(),i=n(e.reason),s=n(e.action),a=e.actorRole||"anonymous",o=e.actorId||null,d=e.shipmentId||null,u=e.ipAddress?e.ipAddress.slice(0,45):null;return(await t.query(`INSERT INTO audit_log (actor_id, actor_role, action, shipment_id, decision, reason, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, timestamp, actor_id, actor_role, action, shipment_id, decision, reason, ip_address, created_at`,[o,a,s,d,e.decision,i,u])).rows[0]}async function d(e,t=100){let i=(0,r.l)(),s=await i.query("SELECT role FROM profiles WHERE id = $1",[e]);if(0===s.rows.length||"admin"!==s.rows[0].role)throw await o({actorId:e,actorRole:s.rows[0]?.role||"anonymous",action:"AUDIT_LOG_READ",decision:"DENIED",reason:"Unauthorized attempt to inspect security audit logs (admin required)"}),Error("FORBIDDEN: Only administrators can read audit entries.");let a=await i.query(`SELECT id, timestamp, actor_id, actor_role, action, shipment_id, decision, reason, ip_address, created_at
     FROM audit_log
     ORDER BY timestamp DESC
     LIMIT $1`,[Math.min(t,500)]);return await o({actorId:e,actorRole:"admin",action:"AUDIT_LOG_READ",decision:"ALLOWED",reason:`Admin retrieved ${a.rows.length} audit log entries`}),a.rows}r=(a.then?(await a)():a)[0],s()}catch(e){s(e)}})},5456:(e,t,i)=>{"use strict";i.a(e,async(e,s)=>{try{i.d(t,{j:()=>n});var r=i(5748),a=e([r]);async function n(e){let t=e.headers.get("authorization"),i=e.headers.get("x-user-id"),s=null;if(i)/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(i)&&(s=i);else if(t&&t.startsWith("Bearer ")){let e=t.substring(7).trim();e.startsWith("user_")&&(s=e.replace("user_",""))}if(!s)return null;let a=(0,r.l)(),n=await a.query("SELECT id, role, full_name, email FROM profiles WHERE id = $1",[s]);if(0===n.rows.length)return null;let o=n.rows[0];return{user:{id:o.id,email:o.email,role:o.role,full_name:o.full_name}}}r=(a.then?(await a)():a)[0],s()}catch(e){s(e)}})},5748:(e,t,i)=>{"use strict";i.a(e,async(e,s)=>{try{i.d(t,{l:()=>o});var r=i(8678),a=i(9279),n=e([r]);r=(n.then?(await n)():n)[0];let d=null,u=null;function o(){if(u)return u;let e=process.env.DATABASE_URL||process.env.POSTGRES_URL;return e?(d||(d=new r.Pool({connectionString:e,ssl:{rejectUnauthorized:!1}})),{query:async(e,t)=>d.query(e,t),isTestDb:()=>!1}):(u||(u=function(){let e=(0,a.newDb)();e.public.registerFunction({name:"gen_random_uuid",returns:e.public.getType("uuid"),impure:!0,implementation:()=>crypto.randomUUID()}),e.public.registerFunction({name:"uuid_generate_v4",returns:e.public.getType("uuid"),impure:!0,implementation:()=>crypto.randomUUID()}),e.public.none(`
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
  `);let t=new(e.adapters.createPg()).Pool;return{query:async(e,i)=>t.query(e,i),isTestDb:()=>!0}}()),u)}s()}catch(e){s(e)}})},7833:(e,t,i)=>{"use strict";i.d(t,{Py:()=>n,aX:()=>r,ks:()=>o,m:()=>a});var s=i(7070);function r(e="Shipment not found"){return s.NextResponse.json({error:"NOT_FOUND",message:e},{status:404})}function a(e="Authentication required"){return s.NextResponse.json({error:"UNAUTHORIZED",message:e},{status:401})}function n(e="Permission denied"){return s.NextResponse.json({error:"FORBIDDEN",message:e},{status:403})}function o(e,t){return s.NextResponse.json({error:"BAD_REQUEST",message:e,...t?{details:t}:{}},{status:400})}},4787:(e,t,i)=>{"use strict";i.a(e,async(e,s)=>{try{i.d(t,{Cs:()=>d,Gf:()=>o,RW:()=>u,qG:()=>c});var r=i(2114),a=i(7662),n=e([a]);a=(n.then?(await n)():n)[0];class u extends Error{constructor(e){super(e),this.name="StateTransitionError"}}class c extends Error{constructor(e){super(e),this.name="UnauthorizedTransitionError"}}async function o(e,t,i){return(await e.query(`SELECT 1 FROM assignments
     WHERE shipment_id = $1 AND driver_id = $2 AND is_active = TRUE`,[t,i])).rows.length>0}async function d(e,t){let{shipmentId:i,newStatus:s,actorId:n,actorRole:d,location:E,notes:T,ipAddress:l}=t,p=await e.query("SELECT * FROM shipments WHERE id = $1",[i]);if(0===p.rows.length)throw await (0,a.b)({actorId:n,actorRole:d,action:"UPDATE_SHIPMENT_STATUS",shipmentId:i,decision:"DENIED",reason:"Shipment does not exist",ipAddress:l}),new u("Shipment not found");let m=p.rows[0];if("driver"===d&&!await o(e,i,n))throw await (0,a.b)({actorId:n,actorRole:"driver",action:"UPDATE_SHIPMENT_STATUS",shipmentId:i,decision:"DENIED",reason:"Driver is not actively assigned to this shipment",ipAddress:l}),new c("Driver is not actively assigned to this shipment");if(!function(e,t){let i=r.j[e];return!!i&&i.includes(t)}(m.status,s)){let e=`Invalid status transition from '${m.status}' to '${s}' (must follow created -> assigned -> picked_up -> in_transit -> delivered)`;throw await (0,a.b)({actorId:n,actorRole:d,action:"UPDATE_SHIPMENT_STATUS",shipmentId:i,decision:"DENIED",reason:e,ipAddress:l}),new u(e)}let _=await e.query(`UPDATE shipments
     SET status = $1, current_location = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,[s,E,i]);return await e.query(`INSERT INTO shipment_status_events (shipment_id, from_status, to_status, actor_id, location, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,[i,m.status,s,n,E,T||""]),await (0,a.b)({actorId:n,actorRole:d,action:"UPDATE_SHIPMENT_STATUS",shipmentId:i,decision:"ALLOWED",reason:`Status successfully updated from '${m.status}' to '${s}'`,ipAddress:l}),_.rows[0]}s()}catch(e){s(e)}})},2114:(e,t,i)=>{"use strict";i.d(t,{j:()=>s});let s={created:["assigned"],assigned:["picked_up"],picked_up:["in_transit"],in_transit:["delivered"],delivered:[]}},4235:(e,t,i)=>{"use strict";i.d(t,{Dh:()=>n,WQ:()=>a,hn:()=>u,hq:()=>d,jd:()=>r,uf:()=>o});var s=i(1067);let r=s.Z_().uuid({message:"Invalid UUID identifier"}),a=s.Ry({origin_city:s.Z_().min(2).max(100).trim(),destination_city:s.Z_().min(2).max(100).trim(),delivery_address:s.Z_().min(5).max(300).trim(),notes:s.Z_().max(1e3).default("").transform(e=>e.trim())}),n=s.Ry({status:s.Km(["assigned","picked_up","in_transit","delivered"],{errorMap:()=>({message:"Invalid status value"})}),location:s.Z_().min(2).max(100).trim(),notes:s.Z_().max(1e3).optional().default("")}),o=s.Ry({driver_id:r}),d=s.Ry({token:s.Z_().min(16).max(128).regex(/^[a-zA-Z0-9_-]+$/,{message:"Invalid tracking token format"})}),u=s.Ry({id:r})}};var t=require("../../../../../webpack-runtime.js");t.C(e);var i=e=>t(t.s=e),s=t.X(0,[276,69,67],()=>i(7986));module.exports=s})();