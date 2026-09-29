const assert=require('node:assert');
const fs=require('node:fs');
const {execSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {projectTimetable,foodRows,foodKey,splitSentences,fmt,parse}=require(path.join(root,'timetable.js'));

// ---- unit tests ----
assert.deepStrictEqual(splitSentences('Leave around 06:45. Check AMSCG.'),['Leave around 06:45.','Check AMSCG.']);
assert.deepStrictEqual(splitSentences('Parking is €1.20/hour from Oct 1–May 31; carry coins. Walk 3.6 km.'),['Parking is €1.20/hour from Oct 1–May 31; carry coins.','Walk 3.6 km.']);
assert.strictEqual(splitSentences('Return by the 16:00 target and never continue beyond 17:30.').length,1);
assert.strictEqual(splitSentences('Meet approx. noon at St. Stefan. Then go.').length,2);
assert.deepStrictEqual(splitSentences(''),[]);
assert.strictEqual(parse('06:45'),405);
assert.strictEqual(fmt(405),'06:45');
assert.strictEqual(foodKey({id:'x',type:'meal',name:'n'}),'x');
assert.strictEqual(foodKey({type:'meal',name:'n'}),'meal:n');
{
  const r=projectTimetable({day:9,startAt:'08:00',morning:[
    {id:'a',type:'DRIVE',title:'Drive out',text:'Leave around 06:45. Bring cash.',driveMin:{adjusted:60}},
    {id:'b',type:'CAUTION',text:'Watch the road.'},
    {id:'c',type:'SIGHT',title:'Late stop',fixedAt:'08:50',dwellMin:30,text:'Enjoy the view.'},
    {id:'d',type:'SIGHT',title:'Too early',fixedAt:'08:00',text:'Go.'}]});
  assert.deepStrictEqual(r.rows.map(x=>x.when),['08:00–09:00','09:00–09:30','09:30']);
  assert.deepStrictEqual(r.rows[0].sourceIds,['a','b']);
  assert.strictEqual(r.totals.driveAdjustedMin,60);
  assert.strictEqual(r.conflicts.length,1);
  assert.strictEqual(r.conflicts[0].id,'d');
}

// ---- data assertions ----
const itinerary=JSON.parse(fs.readFileSync(path.join(root,'itinerary.json'),'utf8'));
const waypoints=JSON.parse(fs.readFileSync(path.join(root,'waypoints.json'),'utf8'));
const wpIds=new Set(waypoints.waypoints.map(p=>p.id));
function deepFreeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(deepFreeze);}return o;}
function compact(list){return list.slice(0,10).join(', ')+(list.length>10?` … (${list.length} total)`:` (${list.length} total)`);}
function check(name,offenders){assert.strictEqual(offenders.length,0,`${name}: ${compact(offenders)}`);}

const bad={cover:[],food:[],what:[],sentence:[],order:[],conflict:[],leg:[],drive:[],title:[],mutate:[]};
let segs=0,food=0,total=0;
for(const day of itinerary.routes.primary.days){
  deepFreeze(day);
  let result;
  try{result=projectTimetable(day);}catch(e){bad.mutate.push(`day ${day.day}: ${e.message}`);continue;}
  const {rows,conflicts}=result;
  const counts=new Map();
  for(const r of rows){
    assert(['morning','afternoon','evening','day'].includes(r.period));
    assert(Array.isArray(r.notes)&&Array.isArray(r.details)&&Array.isArray(r.sourceIds)&&typeof r.when==='string');
    if(!r.what||!r.what.trim()||r.what.includes('…'))bad.what.push(`day ${day.day}:${r.sourceIds[0]}`);
    for(const s of [...r.details,...r.notes])if(/^\d{1,2}\b/.test(s)||/^[a-z]/.test(s))bad.sentence.push(`${r.sourceIds[0]}:"${s.slice(0,20)}"`);
    for(const id of r.sourceIds)counts.set(id,(counts.get(id)||0)+1);
  }
  let last=-Infinity;
  for(const r of rows)if(typeof r.start==='number'){if(r.start<last)bad.order.push(`day ${day.day}:${r.sourceIds[0]}`);last=r.start;}
  for(const c of conflicts)bad.conflict.push(c.id);
  for(const p of ['morning','afternoon','evening'])for(const s of day[p]||[]){
    if(counts.get(s.id)!==1)bad.cover.push(`${s.id}(${counts.get(s.id)||0}x)`);
    segs++;
    if(s.leg)for(const id of [s.leg.from,...(s.leg.via||[]),s.leg.to])if(!wpIds.has(id))bad.leg.push(`${s.id}:${id}`);
    if(s.leg&&!s.driveMin)bad.drive.push(s.id);
    if(s.type!=='CAUTION'&&s.note!==true&&!s.title)bad.title.push(s.id);
  }
  for(const item of foodRows(day.food)){
    const id=foodKey(item);
    if(counts.get(id)!==1)bad.food.push(`${id}(${counts.get(id)||0}x)`);
    food++;
  }
  total+=rows.length;
}
check('segments not covered exactly once',bad.cover);
check('food not consumed exactly once',bad.food);
check('empty or ellipsis what',bad.what);
check('details/notes sentence starts with digit or lowercase',bad.sentence);
check('timed rows go backwards',bad.order);
check('projectTimetable threw',bad.mutate);
check('leg waypoint ids missing from waypoints.json',bad.leg);
check('segments with leg lack driveMin',bad.drive);
check('segments lack title',bad.title);
check('schedule conflicts',bad.conflict);
const tracked=execSync("git ls-files '*.json'",{cwd:root,encoding:'utf8'}).split('\n').filter(Boolean).sort();
// Locale dictionaries are keyed by the itinerary's English text, not a parallel dataset.
assert.deepStrictEqual(tracked,['itinerary.json','locales/en.json','locales/he.json','package-lock.json','package.json','waypoints.json']);
console.log(`timetable: segments=${segs} food=${food} rows=${total}`);
