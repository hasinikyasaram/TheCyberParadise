(()=>{var e={};e.id=416,e.ids=[416],e.modules={1131:e=>{function t(e){var t=Error("Cannot find module '"+e+"'");throw t.code="MODULE_NOT_FOUND",t}t.keys=()=>[],t.resolve=t,t.id=1131,e.exports=t},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4770:e=>{"use strict";e.exports=require("crypto")},8678:e=>{"use strict";e.exports=import("pg")},4276:(e,t,r)=>{"use strict";r.a(e,async(e,s)=>{try{r.r(t),r.d(t,{originalPathname:()=>l,patchFetch:()=>d,requestAsyncStorage:()=>T,routeModule:()=>c,serverHooks:()=>p,staticGenerationAsyncStorage:()=>E});var i=r(9303),a=r(8716),n=r(670),o=r(8372),u=e([o]);o=(u.then?(await u)():u)[0];let c=new i.AppRouteRouteModule({definition:{kind:a.x.APP_ROUTE,page:"/api/demo/layer-switches/route",pathname:"/api/demo/layer-switches",filename:"route",bundlePath:"app/api/demo/layer-switches/route"},resolvedPagePath:"/Users/hasini/BuildSecure/src/app/api/demo/layer-switches/route.ts",nextConfigOutput:"",userland:o}),{requestAsyncStorage:T,staticGenerationAsyncStorage:E,serverHooks:p}=c,l="/api/demo/layer-switches/route";function d(){return(0,n.patchFetch)({serverHooks:p,staticGenerationAsyncStorage:E})}s()}catch(e){s(e)}})},8372:(e,t,r)=>{"use strict";r.a(e,async(e,s)=>{try{r.r(t),r.d(t,{GET:()=>c,POST:()=>T});var i=r(7070),a=r(1067),n=r(5456),o=r(7411),u=r(7833),d=e([n]);n=(d.then?(await d)():d)[0];let E=a.Ry({bypassServerAuthCheck:a.O7().optional(),bypassAppStateMachineCheck:a.O7().optional(),bypassAntiEnumeration:a.O7().optional()});async function c(e){if(!(0,o.ie)())return(0,u.Py)("Demo layer switches are disabled outside demo mode");let t=await (0,n.j)(e);if(!t||"admin"!==t.user.role)return(0,u.Py)("Only administrators can inspect demo layer switches");let r=(0,o.Zp)(t.user.role);return i.NextResponse.json({switches:r,demo_mode:!0})}async function T(e){let t;if(!(0,o.ie)())return(0,u.Py)("Demo layer switches are disabled outside demo mode");let r=await (0,n.j)(e);if(!r)return(0,u.m)("Authentication required");if("admin"!==r.user.role)return(0,u.Py)("Only administrators can configure demo layer switches");try{t=await e.json()}catch{return(0,u.ks)("Invalid JSON body")}let s=E.safeParse(t);if(!s.success)return(0,u.ks)("Validation failed",s.error.format());try{let e=(0,o.qj)(s.data,r.user.role);return i.NextResponse.json({switches:e})}catch(e){return(0,u.Py)(e.message)}}s()}catch(e){s(e)}})},5456:(e,t,r)=>{"use strict";r.a(e,async(e,s)=>{try{r.d(t,{j:()=>n});var i=r(5748),a=e([i]);async function n(e){let t=e.headers.get("authorization"),r=e.headers.get("x-user-id"),s=null;if(r)/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r)&&(s=r);else if(t&&t.startsWith("Bearer ")){let e=t.substring(7).trim();e.startsWith("user_")&&(s=e.replace("user_",""))}if(!s)return null;let a=(0,i.l)(),n=await a.query("SELECT id, role, full_name, email FROM profiles WHERE id = $1",[s]);if(0===n.rows.length)return null;let o=n.rows[0];return{user:{id:o.id,email:o.email,role:o.role,full_name:o.full_name}}}i=(a.then?(await a)():a)[0],s()}catch(e){s(e)}})},5748:(e,t,r)=>{"use strict";r.a(e,async(e,s)=>{try{r.d(t,{l:()=>o});var i=r(8678),a=r(9279),n=e([i]);i=(n.then?(await n)():n)[0];let u=null,d=null;function o(){if(d)return d;let e=process.env.DATABASE_URL||process.env.POSTGRES_URL;return e?(u||(u=new i.Pool({connectionString:e,ssl:{rejectUnauthorized:!1}})),{query:async(e,t)=>u.query(e,t),isTestDb:()=>!1}):(d||(d=function(){let e=(0,a.newDb)();e.public.registerFunction({name:"gen_random_uuid",returns:e.public.getType("uuid"),impure:!0,implementation:()=>crypto.randomUUID()}),e.public.registerFunction({name:"uuid_generate_v4",returns:e.public.getType("uuid"),impure:!0,implementation:()=>crypto.randomUUID()}),e.public.none(`
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
  `);let t=new(e.adapters.createPg()).Pool;return{query:async(e,r)=>t.query(e,r),isTestDb:()=>!0}}()),d)}s()}catch(e){s(e)}})},7411:(e,t,r)=>{"use strict";r.d(t,{Zp:()=>a,ie:()=>i,qj:()=>n});let s={bypassServerAuthCheck:!1,bypassAppStateMachineCheck:!1,bypassAntiEnumeration:!1};function i(){return"true"===process.env.DEMO_MODE&&"true"===process.env.DEMO_MODE}function a(e){return i()&&"admin"===e?{...s}:{bypassServerAuthCheck:!1,bypassAppStateMachineCheck:!1,bypassAntiEnumeration:!1}}function n(e,t){if(!i())throw Error("SECURITY_ERROR: Demo layer switches are disabled outside demo mode.");if("admin"!==t)throw Error("SECURITY_ERROR: Only administrators can configure demo layer switches.");return void 0!==e.bypassServerAuthCheck&&(s.bypassServerAuthCheck=e.bypassServerAuthCheck),void 0!==e.bypassAppStateMachineCheck&&(s.bypassAppStateMachineCheck=e.bypassAppStateMachineCheck),void 0!==e.bypassAntiEnumeration&&(s.bypassAntiEnumeration=e.bypassAntiEnumeration),{...s}}},7833:(e,t,r)=>{"use strict";r.d(t,{Py:()=>n,aX:()=>i,ks:()=>o,m:()=>a});var s=r(7070);function i(e="Shipment not found"){return s.NextResponse.json({error:"NOT_FOUND",message:e},{status:404})}function a(e="Authentication required"){return s.NextResponse.json({error:"UNAUTHORIZED",message:e},{status:401})}function n(e="Permission denied"){return s.NextResponse.json({error:"FORBIDDEN",message:e},{status:403})}function o(e,t){return s.NextResponse.json({error:"BAD_REQUEST",message:e,...t?{details:t}:{}},{status:400})}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),s=t.X(0,[276,69,67],()=>r(4276));module.exports=s})();