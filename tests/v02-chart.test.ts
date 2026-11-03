import {it,expect} from 'vitest';
import {newGame,advance,restore,publicRadar,publicPlanets} from '../src/game/engine';
import {readyPlanet,stepStarChart,initialChart} from '../src/game/star-chart';
import {parcel} from '../src/content/parcel';import {echo} from '../src/content/echo';
const at=1800000000000;
it('continuous real listening has no early target, retries weak returns, never opens unfinished content',()=>{
 let s=newGame(at);expect(publicRadar(s,'interstellar').stage).toBe('searching');s=advance(s,at+46000);expect(publicRadar(s,'interstellar').stage).toBe('anomaly');expect(JSON.stringify(publicRadar(s,'interstellar'))).not.toMatch(/echo|回声|planet|position|count/);
 s=advance(s,at+90000);expect(publicRadar(s,'interstellar').stage).toBe('unconfirmed');expect(s.planets).toEqual(['parcel']);s=advance(s,at+103000);expect(publicRadar(s,'interstellar').stage).toBe('searching');expect(publicPlanets(s).map(p=>p.id)).toEqual(['parcel']);expect(readyPlanet(echo)).toBe(false);
});
it('only complete registered content reveals after a successful lock; arbitrary known records persist',()=>{
 const future={...parcel,id:'fixture-only',name:'测试航路',regions:parcel.regions.map(r=>({...r,id:'fixture-region'}))};
 const modules=[parcel,echo,future];let chart=initialChart();chart=stepStarChart(chart,72000,['parcel'],modules);expect(chart.scan.resolved).toBeNull();expect(chart.records).toHaveLength(1);
 chart=stepStarChart(chart,18000,['parcel'],modules);expect(chart.scan.resolved?.id).toBe('fixture-only');expect(chart.records).toHaveLength(2);const known=chart.records[1];expect(known.regions).toEqual(['fixture-region']);expect(known.x).toBeGreaterThan(0);
 chart=stepStarChart(chart,13000,['parcel','fixture-only'],modules);expect(chart.records[1]).toEqual(known);expect(chart.scan.resolved).toBeNull();
 expect(readyPlanet({...future,regions:[{...future.regions[0],discoveries:[]}]})).toBe(false);expect(readyPlanet({...future,regions:[{...future.regions[0],visualTheme:'unbuilt'}]})).toBe(false);
});
it('old known stars remain permanently and malformed optional coordinates do not wipe player balances',()=>{
 const s=newGame(at);s.resources=5432;const raw=JSON.parse(JSON.stringify(s));delete raw.chart;const migrated=restore(JSON.stringify(raw),at);expect(migrated.chart.records.map(r=>r.id)).toEqual(['parcel']);expect(migrated.resources).toBe(5432);
 const bad={...s,chart:{records:[{id:'parcel',x:999,y:-9}],scan:{elapsed:-1}}};expect(restore(JSON.stringify(bad),at).resources).toBe(5432);
});

it('已知旧航路保持可见，但不完整内容没有远征能力',()=>{const s=newGame(at);s.planets.push('echo');expect(publicPlanets(s).map(p=>p.id)).toContain('echo');expect(readyPlanet(echo)).toBe(false);});
