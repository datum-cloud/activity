import{E as h,m as C,g as M,h as y,r,i as g,e as E,j as v}from"./index-Cpyx2Kcx.js";import{i as S,d as b,c as F,s as P,g as D,a as k,b as z,e as H,R as L,f as O,h as T}from"./components-DdpqaNbj.js";/**
 * @remix-run/react v2.17.4
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */function j(u){if(!u)return null;let m=Object.entries(u),s={};for(let[a,e]of m)if(e&&e.__type==="RouteErrorResponse")s[a]=new h(e.status,e.statusText,e.data,e.internal===!0);else if(e&&e.__type==="Error"){if(e.__subType){let i=window[e.__subType];if(typeof i=="function")try{let o=new i(e.message);o.stack=e.stack,s[a]=o}catch{}}if(s[a]==null){let i=new Error(e.message);i.stack=e.stack,s[a]=i}}else s[a]=e;return s}/**
 * @remix-run/react v2.17.4
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */let n,t,c=!1,f;new Promise(u=>{f=u}).catch(()=>{});function B(u){if(!t){if(window.__remixContext.future.v3_singleFetch){if(!n){let d=window.__remixContext.stream;S(d,"No stream found for single fetch decoding"),window.__remixContext.stream=void 0,n=b(d,window).then(_=>{window.__remixContext.state=_.value,n.value=!0}).catch(_=>{n.error=_})}if(n.error)throw n.error;if(!n.value)throw n}let i=F(window.__remixManifest.routes,window.__remixRouteModules,window.__remixContext.state,window.__remixContext.future,window.__remixContext.isSpaMode),o;if(!window.__remixContext.isSpaMode){o={...window.__remixContext.state,loaderData:{...window.__remixContext.state.loaderData}};let d=C(i,window.location,window.__remixContext.basename);if(d)for(let _ of d){let l=_.route.id,x=window.__remixRouteModules[l],w=window.__remixManifest.routes[l];x&&P(w,x,window.__remixContext.isSpaMode)&&(x.HydrateFallback||!w.hasLoader)?o.loaderData[l]=void 0:w&&!w.hasLoader&&(o.loaderData[l]=null)}o&&o.errors&&(o.errors=j(o.errors))}t=M({routes:i,history:y(),basename:window.__remixContext.basename,future:{v7_normalizeFormMethod:!0,v7_fetcherPersist:window.__remixContext.future.v3_fetcherPersist,v7_partialHydration:!0,v7_prependBasename:!0,v7_relativeSplatPath:window.__remixContext.future.v3_relativeSplatPath,v7_skipActionErrorRevalidation:window.__remixContext.future.v3_singleFetch===!0},hydrationData:o,mapRouteProperties:g,dataStrategy:window.__remixContext.future.v3_singleFetch&&!window.__remixContext.isSpaMode?k(window.__remixManifest,window.__remixRouteModules,()=>t):void 0,patchRoutesOnNavigation:D(window.__remixManifest,window.__remixRouteModules,window.__remixContext.future,window.__remixContext.isSpaMode,window.__remixContext.basename)}),t.state.initialized&&(c=!0,t.initialize()),t.createRoutesForHMR=z,window.__remixRouter=t,f&&f(t)}let[m,s]=r.useState(void 0),[a,e]=r.useState(t.state.location);return r.useLayoutEffect(()=>{c||(c=!0,t.initialize())},[]),r.useLayoutEffect(()=>t.subscribe(i=>{i.location!==a&&e(i.location)}),[a]),H(t,window.__remixManifest,window.__remixRouteModules,window.__remixContext.future,window.__remixContext.isSpaMode),r.createElement(r.Fragment,null,r.createElement(L.Provider,{value:{manifest:window.__remixManifest,routeModules:window.__remixRouteModules,future:window.__remixContext.future,criticalCss:m,isSpaMode:window.__remixContext.isSpaMode}},r.createElement(O,{location:a},r.createElement(T,{router:t,fallbackElement:null,future:{v7_startTransition:!0}}))),window.__remixContext.future.v3_singleFetch?r.createElement(r.Fragment,null):null)}var p,R=E;R.createRoot,p=R.hydrateRoot;r.startTransition(()=>{p(document,v.jsx(r.StrictMode,{children:v.jsx(B,{})}))});
