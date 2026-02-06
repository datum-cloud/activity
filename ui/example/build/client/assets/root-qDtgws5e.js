import{f,k as x,r as i,j as e,O as y}from"./index-ZeLdoy4t.js";import{h as S,j as w,_ as k,k as a,M as j,l as g,S as M}from"./components-1g_U_R6J.js";/**
 * @remix-run/react v2.17.4
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */let l="positions";function E({getKey:t,...c}){let{isSpaMode:d}=S(),n=f(),m=x();w({getKey:t,storageKey:l});let u=i.useMemo(()=>{if(!t)return null;let s=t(n,m);return s!==n.key?s:null},[]);if(d)return null;let p=((s,h)=>{if(!window.history.state||!window.history.state.key){let r=Math.random().toString(32).slice(2);window.history.replaceState({key:r},"")}try{let o=JSON.parse(sessionStorage.getItem(s)||"{}")[h||window.history.state.key];typeof o=="number"&&window.scrollTo(0,o)}catch(r){console.error(r),sessionStorage.removeItem(s)}}).toString();return i.createElement("script",k({},c,{suppressHydrationWarning:!0,dangerouslySetInnerHTML:{__html:`(${p})(${a(JSON.stringify(l))}, ${a(JSON.stringify(u))})`}}))}const L="/assets/index-DAeIbcp-.css",O=()=>[{rel:"stylesheet",href:L}],H=()=>[{title:"Activity Explorer"},{name:"description",content:"Explore audit logs and activities"}],v=`
  (function() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      document.documentElement.classList.add('dark');
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });
  })();
`;function R({children:t}){return e.jsxs("html",{lang:"en",children:[e.jsxs("head",{children:[e.jsx("meta",{charSet:"utf-8"}),e.jsx("meta",{name:"viewport",content:"width=device-width, initial-scale=1"}),e.jsx("script",{dangerouslySetInnerHTML:{__html:v}}),e.jsx(j,{}),e.jsx(g,{})]}),e.jsxs("body",{children:[t,e.jsx(E,{}),e.jsx(M,{})]})]})}function b(){return e.jsx(y,{})}export{R as Layout,b as default,O as links,H as meta};
