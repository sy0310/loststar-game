// Shared by the real night model and the workshop's exact capability descriptions.
export const tapeSpeed=(level:number)=>.56-level*.06;
export const bellHoldMs=(level:number)=>1100+level*200;

export const securityStrengths=(slots:readonly (string|null)[],levels:[number,number]):[number,number]=>slots.map(id=>id==='beacon'?levels[0]:id==='gate'?levels[1]:0) as [number,number];
