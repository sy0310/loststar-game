const ids=['receipt','tape','nested','stamp','cosmic-parcel','bell'];
const bays=ids.map((id,i)=>({id,x:[.23,.50,.79,.20,.50,.81][i]*768,y:(i<3?.555:.821)*960,w:i<3?198:216}));
const visits=[3,1,5,0,4,2];const hub={x:384,y:918};
function path(a:{x:number;y:number},b:{x:number;y:number},f:number){const corner={x:b.x,y:a.y},l1=Math.abs(b.x-a.x),l2=Math.abs(b.y-a.y),d=Math.max(0,Math.min(1,f))*(l1+l2);return d<l1?{x:a.x+Math.sign(b.x-a.x)*d,y:a.y}:{x:corner.x,y:a.y+Math.sign(b.y-a.y)*(d-l1)};}
const lerp=(a:number,b:number,f:number)=>a+(b-a)*f;
export function baseRobotPose(seconds:number){
 const time=Math.max(0,seconds),index=Math.floor(time/14)%visits.length,bay=bays[visits[index]],t=time%14,service={x:visits[index]%3===0?270:500,y:bay.y+42};
 let action:'walk'|'observe'|'open'|'lift'|'inspect'|'place'|'wipe'|'return',position=service,lift=0,opening=0;
 if(t<4){action='walk';position=path(hub,service,t/4);}else if(t<5.5)action='observe';else if(t<6.2){action='open';opening=(t-5.5)/.7;}else if(t<7.2){action='lift';opening=1;lift=t-6.2;}else if(t<8.2){action='inspect';opening=1;lift=1;}else if(t<9.2){action='place';opening=1;lift=1-(t-8.2);}else if(t<10){action='wipe';opening=1-(t-9.2)/.8;}else{action='return';position=path(service,hub,(t-10)/4);}
 const facing=bay.x<position.x?-1:1,hand={x:position.x+facing*30,y:position.y-54},item={x:lerp(bay.x,hand.x,lift),y:lerp(bay.y-bay.w*.49,hand.y,lift)};
 return {...position,action,target:bay.id,lift,opening,facing,hand,item,width:108};
}
