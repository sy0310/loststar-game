import { parcel } from './parcel';
import { echo } from './echo';
export const planets = [parcel, echo];
export const discoveries = parcel.regions.flatMap(r => r.discoveries);
export const discoveryById = (id:string) => discoveries.find(d => d.id === id);
export const planetById = (id:string) => planets.find(p => p.id === id);
