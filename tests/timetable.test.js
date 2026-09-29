const assert=require('node:assert');
const fs=require('node:fs');
const vm=require('node:vm');
const {execSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

const ctx={};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'timetable.js'),'utf8'),ctx);
const {projectTimetable,foodRows}=ctx;
const itinerary=JSON.parse(fs.readFileSync(path.join(root,'itinerary.json'),'utf8'));
function deepFreeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(deepFreeze);}return o;}

let segs=0,food=0,total=0;
for(const day of itinerary.routes.primary.days){
  deepFreeze(day);
  const rows=projectTimetable(day);
  const counts=new Map();
  for(const r of rows){
    assert(r.what&&r.what.trim(),`day ${day.day}: empty what`);
    assert(['morning','afternoon','evening','day'].includes(r.period));
    assert(Array.isArray(r.notes)&&Array.isArray(r.sourceIds)&&typeof r.when==='string'&&typeof r.details==='string');
    for(const id of r.sourceIds)counts.set(id,(counts.get(id)||0)+1);
  }
  for(const p of ['morning','afternoon','evening'])for(const s of day[p]||[]){
    assert.strictEqual(counts.get(s.id),1,`day ${day.day}: segment ${s.id} covered ${counts.get(s.id)||0}x`);segs++;
  }
  for(const item of foodRows(day.food)){
    const id=item.id||`food:${item.type}:${item.name}`;
    assert.strictEqual(counts.get(id),1,`day ${day.day}: food ${id} covered ${counts.get(id)||0}x`);food++;
  }
  total+=rows.length;
}
const tracked=execSync("git ls-files '*.json'",{cwd:root,encoding:'utf8'}).split('\n').filter(Boolean).sort();
assert.deepStrictEqual(tracked,['itinerary.json','package-lock.json','package.json','waypoints.json']);
console.log(`timetable: segments=${segs} food=${food} rows=${total}`);
