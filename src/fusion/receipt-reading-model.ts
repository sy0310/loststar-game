/** Read-only selection of real caller-supplied observations. Never creates evidence or rewards. */
export interface ReceiptReadingRecord {id:string;at:number;detail:string;source?:string;code?:string;orientation?:string}
export function receiptReadingRecords(records:readonly ReceiptReadingRecord[],level:number){
 const seen=new Set<string>();
 return records.filter(r=>{
  if(!r.id||seen.has(r.id)||!Number.isFinite(r.at)||!r.detail.trim())return false;
  seen.add(r.id);return true;
 }).slice(0,Math.min(2,Math.max(0,Math.floor(level))));
}
export function receiptReadingLabel(record:ReceiptReadingRecord){
 return record.code??/\bP(?:03|30)\b/.exec(`${record.source??''} ${record.detail}`.toUpperCase())?.[0]??'现场条目';
}
