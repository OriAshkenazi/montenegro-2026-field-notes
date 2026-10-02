const assert=require('node:assert');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('weather.js','utf8');
const enUi=JSON.parse(fs.readFileSync('locales/en.json','utf8')).ui,tEn=(key,vars)=>String(enUi[key]??key).replace(/\{(\w+)\}/g,(m,k)=>vars&&vars[k]!=null?vars[k]:m);
assert(source.includes("id:'perast',name:'Conte Hotel · Perast (reception/property anchor)'"));
assert(source.includes("name:'Runolist Chalet · Narodnih heroja (approximate pin)'"));
assert(source.includes('mne-weather-forecast-v4'), 'coordinate changes must invalidate saved forecast payload');
// The trip-window assertions assume the pre-trip view, so the clock is pinned to Sep 30 (any real date would drop past trip days).
const NOW=Date.parse('2026-09-30T10:00:00Z');class FixedDate extends Date{constructor(...a){super(...(a.length?a:[NOW]));}static now(){return NOW;}}
const today='2026-09-30';
const hubIds=['tivat','perast','budva','podgorica','virpazar','zabljak','sedlo','kolasin','piva','biogradska','tara','lovcen','kuk'];
function fixture(){
  const days=Array.from({length:16},(_,i)=>{const date=new Date(`${today}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+i);return date.toISOString().slice(0,10);});
  return hubIds.map(()=>{
    const hourlyTimes=days.flatMap(day=>Array.from({length:24},(_,hour)=>`${day}T${String(hour).padStart(2,'0')}:00`));
    return {timezone:'Europe/Podgorica',daily:{time:days,temperature_2m_min:days.map(()=>5),temperature_2m_max:days.map(()=>15),precipitation_probability_max:days.map(()=>40),wind_gusts_10m_max:days.map(()=>25),sunrise:days.map(day=>`${day}T06:45`),sunset:days.map(day=>`${day}T18:30`)},hourly:{time:hourlyTimes,temperature_2m:hourlyTimes.map(()=>12),precipitation_probability:hourlyTimes.map(()=>20),precipitation:hourlyTimes.map(()=>0),rain:hourlyTimes.map(()=>0),cloud_cover:hourlyTimes.map(()=>35)}};
  });
}
function run(rows,{online=true,cached=null}={}){
  const selectors=['#weatherHub','#weatherMode','#weatherUpdated','#weatherError','#weatherLoading','#weatherForecast','#weatherDays','#hourlyTitle','#hourlyScroller','#weatherHubTitle','#alpineWarning','#alpineWarningDetails','#coastWeather','#alpineWeather'];
  const elements=Object.fromEntries(selectors.map(selector=>[selector,{value:selector==='#weatherHub'?'zabljak':'',textContent:'',innerHTML:'',hidden:selector==='#weatherForecast'||selector==='#alpineWarning',classList:{add(){},toggle(){}},addEventListener(){},querySelectorAll(){return[]}}]));
  const store=new Map(cached?[["mne-weather-forecast-v4",JSON.stringify(cached)]]:[]);
  const context={t:tEn,document:{querySelector:selector=>elements[selector]},navigator:{onLine:online},localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)},fetch:async()=>({ok:true,json:async()=>rows}),addEventListener(){},URL,Intl,Date:FixedDate,Math,Number,String,JSON,Array,Error};
  vm.runInNewContext(source,context);return new Promise(resolve=>setImmediate(()=>resolve({elements,store})));
}

(async()=>{
  const rows=fixture(),tripDay='2026-10-02',offTripDay='2026-09-30';
  let result=await run(rows);
  assert.equal(result.elements['#weatherMode'].textContent,'Live forecast');
  assert(['piva','biogradska','tara','lovcen','kuk'].every(id=>result.elements['#weatherHubTitle'].innerHTML.includes(`value="${id}"`)), 'new route hubs must be available in the selector');
  assert.equal((result.elements['#weatherDays'].innerHTML.match(/class="weather-day"/g)||[]).length,6);
  assert(result.elements['#weatherDays'].innerHTML.includes('Thu, 1 Oct')||result.elements['#weatherDays'].innerHTML.includes('Thu 1 Oct'));
  assert.equal((result.elements['#hourlyScroller'].innerHTML.match(/class="hour-cell"/g)||[]).length,24);
  assert(result.elements['#hourlyScroller'].innerHTML.includes('20%')&&result.elements['#hourlyScroller'].innerHTML.includes('0.0 mm'),'positive precipitation probability can coexist with a zero modelled amount');
  assert(result.elements['#hourlyScroller'].innerHTML.includes('height:0%'),'zero modelled precipitation must not draw a nonzero amount bar');
  assert(result.elements['#coastWeather'].innerHTML.includes('Sunrise 06:45 · Sunset 18:30'),'API local times must not shift with the device time zone');
  assert(result.store.has('mne-weather-forecast-v4'));

  const offTrip=fixture(),outsideIndex=offTrip[5].daily.time.indexOf(offTripDay);offTrip[5].daily.temperature_2m_min[outsideIndex]=1;
  result=await run(offTrip);assert.equal(result.elements['#alpineWarning'].hidden,true,'weather outside the trip window must not warn');

  const cold=fixture(),coldIndex=cold[5].daily.time.indexOf(tripDay);cold[5].daily.temperature_2m_min[coldIndex]=2;
  result=await run(cold);assert.equal(result.elements['#alpineWarning'].hidden,false,'2°C alpine minimum must warn');

  const wet=fixture(),wetIndex=wet[6].daily.time.indexOf(tripDay);wet[6].daily.precipitation_probability_max[wetIndex]=61;
  result=await run(wet);assert.equal(result.elements['#alpineWarning'].hidden,false,'precipitation above 60% at Sedlo must warn');

  const lakeCold=fixture(),lakeColdIndex=lakeCold[9].daily.time.indexOf(tripDay);lakeCold[9].daily.temperature_2m_min[lakeColdIndex]=1;
  result=await run(lakeCold);assert.equal(result.elements['#alpineWarning'].hidden,false,'Biogradska Gora must be included in adjusted route weather warnings');
  assert(result.elements['#alpineWarningDetails'].textContent.includes('Biogradsko Lake'),'warning must identify the adjusted route hub');

  const lovcenCold=fixture(),lovcenIndex=lovcenCold[11].daily.time.indexOf(tripDay);lovcenCold[11].daily.temperature_2m_min[lovcenIndex]=1;
  result=await run(lovcenCold);assert.equal(result.elements['#alpineWarning'].hidden,false,'Lovćen must be included in adjusted route weather warnings');
  assert(result.elements['#alpineWarningDetails'].textContent.includes('Njegoš Mausoleum'),'warning must identify the Lovćen route hub');
  const kukWet=fixture(),kukIndex=kukWet[12].daily.time.indexOf(tripDay);kukWet[12].daily.precipitation_probability_max[kukIndex]=61;
  result=await run(kukWet);assert.equal(result.elements['#alpineWarning'].hidden,false,'Kuk must be included in adjusted route weather warnings');

  const saved={updatedAt:new FixedDate().toISOString(),locations:Object.fromEntries(hubIds.map((id,index)=>[id,fixture()[index]]))};
  result=await run([], {online:false,cached:saved});
  assert.equal(result.elements['#weatherMode'].textContent,'Offline Mode - Showing Cached Forecast');
  assert.equal(result.elements['#weatherForecast'].hidden,false);
  console.log('PASS: six trip dates only, 24-hour scroller, cache and offline rendering, and both alpine warning thresholds');
})().catch(error=>{console.error(error);process.exitCode=1;});
