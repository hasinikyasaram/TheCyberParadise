(()=>{var e={};e.id=244,e.ids=[244],e.modules={1131:e=>{function t(e){var t=Error("Cannot find module '"+e+"'");throw t.code="MODULE_NOT_FOUND",t}t.keys=()=>[],t.resolve=t,t.id=1131,e.exports=t},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4770:e=>{"use strict";e.exports=require("crypto")},8678:e=>{"use strict";e.exports=import("pg")},50:(e,t,i)=>{"use strict";i.a(e,async(e,r)=>{try{i.r(t),i.d(t,{originalPathname:()=>p,patchFetch:()=>c,requestAsyncStorage:()=>E,routeModule:()=>d,serverHooks:()=>T,staticGenerationAsyncStorage:()=>l});var s=i(9303),a=i(8716),n=i(670),o=i(6277),u=e([o]);o=(u.then?(await u)():u)[0];let d=new s.AppRouteRouteModule({definition:{kind:a.x.APP_ROUTE,page:"/api/copilot/suspicious-summary/route",pathname:"/api/copilot/suspicious-summary",filename:"route",bundlePath:"app/api/copilot/suspicious-summary/route"},resolvedPagePath:"/Users/hasini/BuildSecure/src/app/api/copilot/suspicious-summary/route.ts",nextConfigOutput:"",userland:o}),{requestAsyncStorage:E,staticGenerationAsyncStorage:l,serverHooks:T}=d,p="/api/copilot/suspicious-summary/route";function c(){return(0,n.patchFetch)({serverHooks:T,staticGenerationAsyncStorage:l})}r()}catch(e){r(e)}})},6277:(e,t,i)=>{"use strict";i.a(e,async(e,r)=>{try{i.r(t),i.d(t,{GET:()=>c});var s=i(7070),a=i(5456),n=i(7967),o=i(7833),u=e([a,n]);async function c(e){let t=await (0,a.j)(e);if(!t)return(0,o.m)("Authentication required");if("admin"!==t.user.role)return(0,o.Py)("Restricted: Only administrators can access suspicious security summaries");try{let e=await (0,n.o)(t);return s.NextResponse.json(e)}catch(e){return(0,o.Py)(e.message||"Access denied")}}[a,n]=u.then?(await u)():u,r()}catch(e){r(e)}})},7967:(e,t,i)=>{"use strict";i.a(e,async(e,r)=>{try{i.d(t,{o:()=>o});var s=i(5748),a=i(7662),n=e([s,a]);async function o(e,t=20){if("admin"!==e.user.role)throw await (0,a.b)({actorId:e.user.id,actorRole:e.user.role,action:"SUSPICIOUS_EVENTS_SUMMARY",decision:"DENIED",reason:"Unauthorized attempt by non-admin to generate suspicious security events summary"}),Error("FORBIDDEN: Only administrators can view suspicious security event summaries.");let i=(0,s.l)(),r=(await i.query(`SELECT action, reason, timestamp, ip_address
     FROM audit_log
     WHERE decision = 'DENIED' OR action LIKE 'SECURITY_ALERT%'
     ORDER BY timestamp DESC
     LIMIT $1`,[t])).rows,n="";if(0===r.length)n="No suspicious security events or policy denials recorded in the recent audit timeline.";else{let e=r.filter(e=>e.action.includes("PROBING")).length,t=r.filter(e=>e.action.includes("READ_SHIPMENT")||e.action.includes("UPDATE")).length;n=`Security Alert Summary: ${r.length} total blocked events detected. Breakdown: ${e} probing/enumeration alert(s), ${t} unauthorized access attempt(s). Row-level controls and rate limits successfully mitigated all detected vectors.`}return await (0,a.b)({actorId:e.user.id,actorRole:"admin",action:"SUSPICIOUS_EVENTS_SUMMARY",decision:"ALLOWED",reason:`Admin generated security summary for ${r.length} suspicious events`}),{summary:n,total_suspicious_events:r.length,recent_incidents:r,read_only:!0}}[s,a]=n.then?(await n)():n,r()}catch(e){r(e)}})},7662:(e,t,i)=>{"use strict";i.a(e,async(e,r)=>{try{i.d(t,{b:()=>o,x:()=>u});var s=i(5748),a=e([s]);function n(e){return e.replace(/(bearer\s+[a-zA-Z0-9_\-\.]+)/gi,"[REDACTED_TOKEN]").replace(/(password|secret|key)=([^\s&]+)/gi,"$1=[REDACTED]").slice(0,500)}async function o(e){let t=(0,s.l)(),i=n(e.reason),r=n(e.action),a=e.actorRole||"anonymous",o=e.actorId||null,u=e.shipmentId||null,c=e.ipAddress?e.ipAddress.slice(0,45):null;return(await t.query(`INSERT INTO audit_log (actor_id, actor_role, action, shipment_id, decision, reason, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, timestamp, actor_id, actor_role, action, shipment_id, decision, reason, ip_address, created_at`,[o,a,r,u,e.decision,i,c])).rows[0]}async function u(e,t=100){let i=(0,s.l)(),r=await i.query("SELECT role FROM profiles WHERE id = $1",[e]);if(0===r.rows.length||"admin"!==r.rows[0].role)throw await o({actorId:e,actorRole:r.rows[0]?.role||"anonymous",action:"AUDIT_LOG_READ",decision:"DENIED",reason:"Unauthorized attempt to inspect security audit logs (admin required)"}),Error("FORBIDDEN: Only administrators can read audit entries.");let a=await i.query(`SELECT id, timestamp, actor_id, actor_role, action, shipment_id, decision, reason, ip_address, created_at
     FROM audit_log
     ORDER BY timestamp DESC
     LIMIT $1`,[Math.min(t,500)]);return await o({actorId:e,actorRole:"admin",action:"AUDIT_LOG_READ",decision:"ALLOWED",reason:`Admin retrieved ${a.rows.length} audit log entries`}),a.rows}s=(a.then?(await a)():a)[0],r()}catch(e){r(e)}})},5456:(e,t,i)=>{"use strict";i.a(e,async(e,r)=>{try{i.d(t,{j:()=>n});var s=i(5748),a=e([s]);async function n(e){let t=e.headers.get("authorization"),i=e.headers.get("x-user-id"),r=null;if(i)/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(i)&&(r=i);else if(t&&t.startsWith("Bearer ")){let e=t.substring(7).trim();e.startsWith("user_")&&(r=e.replace("user_",""))}if(!r)return null;let a=(0,s.l)(),n=await a.query("SELECT id, role, full_name, email FROM profiles WHERE id = $1",[r]);if(0===n.rows.length)return null;let o=n.rows[0];return{user:{id:o.id,email:o.email,role:o.role,full_name:o.full_name}}}s=(a.then?(await a)():a)[0],r()}catch(e){r(e)}})},5748:(e,t,i)=>{"use strict";i.a(e,async(e,r)=>{try{i.d(t,{l:()=>o});var s=i(8678),a=i(9279),n=e([s]);s=(n.then?(await n)():n)[0];let u=null,c=null;function o(){if(c)return c;let e=process.env.DATABASE_URL||process.env.POSTGRES_URL;return e?(u||(u=new s.Pool({connectionString:e,ssl:{rejectUnauthorized:!1}})),{query:async(e,t)=>u.query(e,t),isTestDb:()=>!1}):(c||(c=function(){let e=(0,a.newDb)();e.public.registerFunction({name:"gen_random_uuid",returns:e.public.getType("uuid"),impure:!0,implementation:()=>crypto.randomUUID()}),e.public.registerFunction({name:"uuid_generate_v4",returns:e.public.getType("uuid"),impure:!0,implementation:()=>crypto.randomUUID()}),e.public.none(`
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
  `);let t=new(e.adapters.createPg()).Pool;return{query:async(e,i)=>t.query(e,i),isTestDb:()=>!0}}()),c)}r()}catch(e){r(e)}})},7833:(e,t,i)=>{"use strict";i.d(t,{Py:()=>n,aX:()=>s,ks:()=>o,m:()=>a});var r=i(7070);function s(e="Shipment not found"){return r.NextResponse.json({error:"NOT_FOUND",message:e},{status:404})}function a(e="Authentication required"){return r.NextResponse.json({error:"UNAUTHORIZED",message:e},{status:401})}function n(e="Permission denied"){return r.NextResponse.json({error:"FORBIDDEN",message:e},{status:403})}function o(e,t){return r.NextResponse.json({error:"BAD_REQUEST",message:e,...t?{details:t}:{}},{status:400})}}};var t=require("../../../../webpack-runtime.js");t.C(e);var i=e=>t(t.s=e),r=t.X(0,[276,69],()=>i(50));module.exports=r})();