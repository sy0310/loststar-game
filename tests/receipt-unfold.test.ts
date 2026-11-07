import {expect,it} from 'vitest';
import {receiptUnfoldGeometry} from '../src/render/receipt-experiment';

it('真正展开增加内纸而保持顶部铰点，末端离实际底盘至少三像素',()=>{
  const center={x:175,y:445.9268292682927},frame=66.92682926829268;
  const hinge={x:184.1,y:423.4};
  for(const receiverY of [505.384146,496.933582,497.397488]){
    const options={center,frame,receiverY,curlV:.795,hinge};
    const closed=receiptUnfoldGeometry(options,0),open=receiptUnfoldGeometry(options,1);
    expect(open.hinge).toEqual(hinge);expect(closed.hinge).toEqual(hinge);
    expect(open.top).toBe(closed.top);
    expect(open.bottom).toBeGreaterThan(closed.bottom+14);
    expect(open.bottom).toBeLessThanOrEqual(receiverY-3+.000001);
    expect(open.bottom-open.top).toBeLessThanOrEqual(82);
    expect(open.extension).toBeLessThanOrEqual(15);
    expect(receiptUnfoldGeometry(options,-1)).toEqual(closed);
    expect(receiptUnfoldGeometry(options,2)).toEqual(open);
  }
});
