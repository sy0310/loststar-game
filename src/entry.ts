declare const __D1_PREVIEW__:boolean;
const sample=new URLSearchParams(location.search).get('sample');
const loaded=__D1_PREVIEW__||sample==='night-d1'||sample==='receipt-d1'
  ?import('./review/d1').then(({mountD1})=>mountD1(sample==='receipt-d1'?'receipt':'night'))
  :import('./main');
void loaded.catch(()=>{
  const app=document.getElementById('app');
  if(app)app.innerHTML='<p role="status" style="margin:25vh 24px;text-align:center;font:14px/1.8 system-ui,sans-serif;color:#e6d1b0">通信暂未接通，请刷新后重试。</p>';
});
