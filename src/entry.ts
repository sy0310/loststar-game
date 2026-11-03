declare const __D1_PREVIEW__:boolean;
const sample=new URLSearchParams(location.search).get('sample');
if(__D1_PREVIEW__||sample==='night-d1'||sample==='receipt-d1'){
  void import('./review/d1').then(({mountD1})=>mountD1(sample==='receipt-d1'?'receipt':'night'));
}else{
  void import('./main');
}
