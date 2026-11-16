import {mountD1} from './review/d1';

// Vite chooses this static module only for the separate review build or an
// explicit development sample URL. The ordinary HTML keeps its original main.
const sample=new URLSearchParams(location.search).get('sample');
mountD1(sample==='receipt-d1'?'receipt':'night');
