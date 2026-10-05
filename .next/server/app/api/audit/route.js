(()=>{var e={};e.id=701,e.ids=[701],e.modules={1131:e=>{function t(e){var t=Error("Cannot find module '"+e+"'");throw t.code="MODULE_NOT_FOUND",t}t.keys=()=>[],t.resolve=t,t.id=1131,e.exports=t},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4770:e=>{"use strict";e.exports=require("crypto")},8678:e=>{"use strict";e.exports=import("pg")},6333:(e,t,r)=>{"use strict";r.a(e,async(e,i)=>{try{r.r(t),r.d(t,{originalPathname:()=>N,patchFetch:()=>u,requestAsyncStorage:()=>c,routeModule:()=>T,serverHooks:()=>l,staticGenerationAsyncStorage:()=>E});var a=r(9303),s=r(8716),n=r(670),o=r(2975),d=e([o]);o=(d.then?(await d)():d)[0];let T=new a.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/audit/route",pathname:"/api/audit",filename:"route",bundlePath:"app/api/audit/route"},resolvedPagePath:"/Users/hasini/BuildSecure/src/app/api/audit/route.ts",nextConfigOutput:"",userland:o}),{requestAsyncStorage:c,staticGenerationAsyncStorage:E,serverHooks:l}=T,N="/api/audit/route";function u(){return(0,n.patchFetch)({serverHooks:l,staticGenerationAsyncStorage:E})}i()}catch(e){i(e)}})},2975:(e,t,r)=>{"use strict";r.a(e,async(e,i)=>{try{r.r(t),r.d(t,{GET:()=>u});var a=r(7070),s=r(5456),n=r(7662),o=r(7833),d=e([s,n]);async function u(e){let t=await (0,s.j)(e);if(!t)return(0,o.m)("Authentication required to view audit logs");if("admin"!==t.user.role)return(0,o.Py)("Security Alert: Audit logs are restricted to administrators");try{let e=await (0,n.x)(t.user.id,100);return a.NextResponse.json({logs:e})}catch(e){return(0,o.Py)(e.message||"Access denied")}}[s,n]=d.then?(await d)():d,i()}catch(e){i(e)}})},7662:(e,t,r)=>{"use strict";r.a(e,async(e,i)=>{try{r.d(t,{b:()=>o,x:()=>d});var a=r(5748),s=e([a]);function n(e){return e.replace(/(bearer\s+[a-zA-Z0-9_\-\.]+)/gi,"[REDACTED_TOKEN]").replace(/(password|secret|key)=([^\s&]+)/gi,"$1=[REDACTED]").slice(0,500)}async function o(e){let t=(0,a.l)(),r=n(e.reason),i=n(e.action),s=e.actorRole||"anonymous",o=e.actorId||null,d=e.shipmentId||null,u=e.ipAddress?e.ipAddress.slice(0,45):null;return(await t.query(`INSERT INTO audit_log (actor_id, actor_role, action, shipment_id, decision, reason, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, timestamp, actor_id, actor_role, action, shipment_id, decision, reason, ip_address, created_at`,[o,s,i,d,e.decision,r,u])).rows[0]}async function d(e,t=100){let r=(0,a.l)(),i=await r.query("SELECT role FROM profiles WHERE id = $1",[e]);if(0===i.rows.length||"admin"!==i.rows[0].role)throw await o({actorId:e,actorRole:i.rows[0]?.role||"anonymous",action:"AUDIT_LOG_READ",decision:"DENIED",reason:"Unauthorized attempt to inspect security audit logs (admin required)"}),Error("FORBIDDEN: Only administrators can read audit entries.");let s=await r.query(`SELECT id, timestamp, actor_id, actor_role, action, shipment_id, decision, reason, ip_address, created_at
     FROM audit_log
     ORDER BY timestamp DESC
     LIMIT $1`,[Math.min(t,500)]);return await o({actorId:e,actorRole:"admin",action:"AUDIT_LOG_READ",decision:"ALLOWED",reason:`Admin retrieved ${s.rows.length} audit log entries`}),s.rows}a=(s.then?(await s)():s)[0],i()}catch(e){i(e)}})},5456:(e,t,r)=>{"use strict";r.a(e,async(e,i)=>{try{r.d(t,{j:()=>n});var a=r(5748),s=e([a]);async function n(e){let t=e.headers.get("authorization"),r=e.headers.get("x-user-id"),i=null;if(r)/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r)&&(i=r);else if(t&&t.startsWith("Bearer ")){let e=t.substring(7).trim();e.startsWith("user_")&&(i=e.replace("user_",""))}if(!i)return null;let s=(0,a.l)(),n=await s.query("SELECT id, role, full_name, email FROM profiles WHERE id = $1",[i]);if(0===n.rows.length)return null;let o=n.rows[0];return{user:{id:o.id,email:o.email,role:o.role,full_name:o.full_name}}}a=(s.then?(await s)():s)[0],i()}catch(e){i(e)}})},5748:(e,t,r)=>{"use strict";r.a(e,async(e,i)=>{try{r.d(t,{l:()=>o});var a=r(8678),s=r(9279),n=e([a]);a=(n.then?(await n)():n)[0];let d=null,u=null;function o(){if(u)return u;let e=process.env.DATABASE_URL||process.env.POSTGRES_URL;return e?(d||(d=new a.Pool({connectionString:e,ssl:{rejectUnauthorized:!1}})),{query:async(e,t)=>d.query(e,t),isTestDb:()=>!1}):(u||(u=function(){let e=(0,s.newDb)();e.public.registerFunction({name:"gen_random_uuid",returns:e.public.getType("uuid"),impure:!0,implementation:()=>crypto.randomUUID()}),e.public.registerFunction({name:"uuid_generate_v4",returns:e.public.getType("uuid"),impure:!0,implementation:()=>crypto.randomUUID()}),e.public.none(`
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
  `);let t=new(e.adapters.createPg()).Pool;return{query:async(e,r)=>t.query(e,r),isTestDb:()=>!0}}()),u)}i()}catch(e){i(e)}})},7833:(e,t,r)=>{"use strict";r.d(t,{Py:()=>n,aX:()=>a,ks:()=>o,m:()=>s});var i=r(7070);function a(e="Shipment not found"){return i.NextResponse.json({error:"NOT_FOUND",message:e},{status:404})}function s(e="Authentication required"){return i.NextResponse.json({error:"UNAUTHORIZED",message:e},{status:401})}function n(e="Permission denied"){return i.NextResponse.json({error:"FORBIDDEN",message:e},{status:403})}function o(e,t){return i.NextResponse.json({error:"BAD_REQUEST",message:e,...t?{details:t}:{}},{status:400})}}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),i=t.X(0,[276,69],()=>r(6333));module.exports=i})();