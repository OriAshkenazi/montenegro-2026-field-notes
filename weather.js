(() => {
  const $ = selector => document.querySelector(selector);
  const hubs = [
    {id:'tivat',name:'Tivat',region:'Coast · Bay of Kotor',lat:42.4300,lon:18.6960},
    {id:'kotor',name:'Kotor',region:'Coast · Bay of Kotor',lat:42.4247,lon:18.7712},
    {id:'budva',name:'Budva',region:'Coast · Adriatic',lat:42.2911,lon:18.8403},
    {id:'podgorica',name:'Podgorica',region:'Central · Capital',lat:42.4304,lon:19.2594},
    {id:'virpazar',name:'Virpazar',region:'Central · Lake Skadar',lat:42.2458,lon:19.0911},
    {id:'zabljak',name:'Žabljak',region:'Highlands · Durmitor',lat:43.1555,lon:19.1206},
    {id:'sedlo',name:'Sedlo Pass',region:'Highlands · P14',lat:43.0989,lon:19.0503},
    {id:'kolasin',name:'Kolašin',region:'Highlands · Northern',lat:42.8223,lon:19.5165}
  ];
  const cacheKey = 'mne-weather-forecast-v1';
  const montenegro = [[41.85,19.37],[41.99,19.22],[42.02,18.56],[42.36,18.45],[42.47,18.53],[42.61,18.68],[42.76,18.69],[42.90,18.80],[43.00,18.75],[43.17,18.83],[43.55,19.36],[43.54,19.62],[43.35,19.85],[43.23,20.10],[42.95,20.35],[42.61,20.36],[42.43,20.32],[42.24,20.28],[42.05,20.14],[41.89,19.98]];
  let payload = null, selectedDay = 0, selectedHub = 'zabljak', userSelectedHub = false;

  function escape(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function today() { return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Podgorica',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
  function dateLabel(day) { return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Podgorica',weekday:'short',day:'numeric',month:'short'}).format(new Date(`${day}T12:00:00+02:00`)); }
  function timeLabel(value, zone='Europe/Podgorica') {
    if(!value)return'—';
    const local=value.match(/T(\d{2}:\d{2})(?::\d{2})?$/);
    if(local)return local[1];
    const date=new Date(value);
    return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
  }
  function inMontenegro(lat,lon) { let inside=false; for(let i=0,j=montenegro.length-1;i<montenegro.length;j=i++){const [yi,xi]=montenegro[i],[yj,xj]=montenegro[j];if((xi>lon)!==(xj>lon)&&lat<(yj-yi)*(lon-xi)/(xj-xi)+yi)inside=!inside;}return inside; }
  function nearestHub(lat,lon) { return hubs.reduce((best,hub)=>{const distance=(hub.lat-lat)**2*Math.cos(lat*Math.PI/180)**2+(hub.lon-lon)**2;return !best||distance<best.distance?{id:hub.id,distance}:best;},null).id; }
  function setLocation(id) { if(!hubs.some(hub=>hub.id===id))return;selectedHub=id;renderHubPicker();renderDetail(); }
  function locateUser() { if(!navigator.geolocation)return;navigator.geolocation.getCurrentPosition(({coords})=>{if(!userSelectedHub&&inMontenegro(coords.latitude,coords.longitude))setLocation(nearestHub(coords.latitude,coords.longitude));},()=>{}, {enableHighAccuracy:false,timeout:5500,maximumAge:3600000}); }

  // SimpleMaps SVG uses a Mercator projection. This transform is fitted to its
  // georeferenced control points and checked against the eight route hubs.
  function mapPoint(lat,lon) {
    const x=393.9941009807577*lon-7141.24498785602;
    const mercator=Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
    const y=-22575.413767459533*mercator+19143.659419673462;
    return {x,y};
  }
  function renderHubPicker() {
    const main=$('#weatherMainMap'),coast=$('#weatherCoastMap'),list=$('#weatherHubList');if(!main||!coast||!list)return;
    const pointMarkup=(hub,coastView)=>{
      const point=mapPoint(hub.lat,hub.lon),active=hub.id===selectedHub;
      return `<g class="hub-marker${active?' is-selected':''}" data-hub="${hub.id}" role="button" tabindex="0" aria-label="Select ${escape(hub.name)} forecast" aria-pressed="${active}"><circle class="hub-hit" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${coastView?12:10}"/><circle class="hub-dot" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${coastView?5.5:4.5}"/></g>`;
    };
    const renderMap=(element,{viewBox,locations,coastView=false,title,description})=>{
      element.innerHTML=`<svg class="weather-hub-svg${coastView?' is-coast':''}" viewBox="${viewBox}" role="group" aria-label="${escape(title)}"><title>${escape(title)}</title><desc>${escape(description)}</desc><image href="./assets/montenegro.svg" x="0" y="0" width="1000" height="1000" preserveAspectRatio="xMidYMid meet"/>${locations.map(hub=>pointMarkup(hub,coastView)).join('')}</svg>`;
      element.querySelectorAll('[data-hub]').forEach(control=>{control.addEventListener('click',()=>chooseHub(control.dataset.hub));control.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();chooseHub(control.dataset.hub);}});});
    };
    renderMap(main,{viewBox:'0 0 1000 1000',locations:hubs,title:'Montenegro weather hub overview',description:'Eight selectable forecast hubs across Montenegro. City names are provided in the adjacent city list.'});
    renderMap(coast,{viewBox:'195 600 160 140',locations:hubs.filter(hub=>['tivat','kotor','budva'].includes(hub.id)),coastView:true,title:'Adriatic coast weather hubs',description:'Selectable Tivat, Kotor, and Budva forecast markers.'});
    list.innerHTML=hubs.map(hub=>`<button class="weather-hub-option${hub.id===selectedHub?' is-selected':''}" type="button" data-hub="${hub.id}" aria-pressed="${hub.id===selectedHub}"><span class="hub-option-dot" aria-hidden="true"></span><span><b>${escape(hub.name)}</b><small>${escape(hub.region)}</small></span></button>`).join('');
    list.querySelectorAll('[data-hub]').forEach(control=>control.addEventListener('click',()=>chooseHub(control.dataset.hub)));
  }
  function chooseHub(id) {
    const activeMap=document.activeElement?.closest('[data-weather-map]')?.dataset.weatherMap;
    userSelectedHub=true;selectedDay=0;setLocation(id);
    if(activeMap){const target=$(`[data-weather-map="${activeMap}"] [data-hub="${id}"]`);target?.focus({preventScroll:true});}
  }

  // Solar altitude -6 degrees marks civil dawn and dusk. Open-Meteo supplies the daily sunrise and sunset.
  function civilTwilight(day,lat,lon,rising,zone='Europe/Podgorica') {
    const [year,month,date]=day.split('-').map(Number),base=new Date(Date.UTC(year,month-1,date)),n=Math.floor((base-Date.UTC(year,0,0))/86400000),lngHour=lon/15,zenith=96;
    const t=n+((rising?6:18)-lngHour)/24,m=.9856*t-3.289;
    const wrap=x=>(x%360+360)%360;
    const l=wrap(m+1.916*Math.sin(m*Math.PI/180)+.020*Math.sin(2*m*Math.PI/180)+282.634);
    let ra=wrap(Math.atan(.91764*Math.tan(l*Math.PI/180))*180/Math.PI);ra+=Math.floor(l/90)*90-Math.floor(ra/90)*90;ra/=15;
    const sinDec=.39782*Math.sin(l*Math.PI/180),cosDec=Math.cos(Math.asin(sinDec));
    const cosH=(Math.cos(zenith*Math.PI/180)-sinDec*Math.sin(lat*Math.PI/180))/(cosDec*Math.cos(lat*Math.PI/180));if(cosH>1||cosH< -1)return'—';
    const h=(rising?360-Math.acos(cosH)*180/Math.PI:Math.acos(cosH)*180/Math.PI)/15;
    const utc=((h+ra-.06571*t-6.622-lngHour)%24+24)%24,instant=new Date(Date.UTC(year,month-1,date)+utc*3600000);
    return new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hour12:false}).format(instant);
  }
  function hourlyValue(data,day,field,hour=12) { const times=data.hourly?.time||[],index=times.findIndex(value=>value===`${day}T${String(hour).padStart(2,'0')}:00`);return index<0?null:data.hourly[field]?.[index]??null; }
  function metric(label,value,unit='') { return `<div class="weather-metric"><small>${label}</small><b>${value==null?'—':`${Math.round(value)}${unit}`}</b></div>`; }
  function renderCompare(id,elementId) {
    const hub=hubs.find(item=>item.id===id),element=$(`#${elementId}`),data=payload?.locations?.[id];if(!hub||!element)return;
    if(!data){element.innerHTML=`<header><div><small>${escape(hub.region)}</small><h3>${escape(hub.name)}</h3></div></header><p class="weather-empty">Forecast unavailable.</p>`;return;}
    const day=tripDates()[selectedDay]||tripDates()[0];if(!day){element.innerHTML=`<header><div><small>${escape(hub.region)}</small><h3>${escape(hub.name)}</h3></div></header><p class="weather-empty">The trip window is complete; no trip dates remain.</p>`;return;}
    const dayIndex=(data.daily.time||[]).indexOf(day);if(dayIndex<0){element.innerHTML=`<header><div><small>${escape(hub.region)}</small><h3>${escape(hub.name)}</h3></div></header><p class="weather-empty">Forecast data for ${dateLabel(day)} is not available yet.</p>`;return;}
    const max=data.daily.temperature_2m_max?.[dayIndex],sunset=data.daily.sunset?.[dayIndex],late=sunset&&timeLabel(sunset,data.timezone)>='17:30';
    const dawn=civilTwilight(day,hub.lat,hub.lon,true,data.timezone),dusk=civilTwilight(day,hub.lat,hub.lon,false,data.timezone);
    element.innerHTML=`<header><div><small>${escape(hub.region)} · ${dateLabel(day)}</small><h3>${escape(hub.name)}${id==='zabljak'?' · Durmitor':''}</h3></div><strong class="weather-temp">${max==null?'—':`${Math.round(max)}°`}</strong></header><div class="weather-metrics">${metric('Precipitation chance',data.daily.precipitation_probability_max?.[dayIndex],'%')}${metric('Peak wind gusts',data.daily.wind_gusts_10m_max?.[dayIndex],' km/h')}${metric('Cloud cover at noon',hourlyValue(data,day,'cloud_cover'),'%')}${metric('Daily low',data.daily.temperature_2m_min?.[dayIndex],'°')}</div><div class="weather-sunline"><b>${dateLabel(day)}</b> · Civil dawn ${dawn} · Sunrise ${timeLabel(data.daily.sunrise?.[dayIndex],data.timezone)} · Sunset ${timeLabel(sunset,data.timezone)} · Civil dusk ${dusk}${late?'<br><span class="cutoff-alert">Sunset is after the 17:30 driving cut-off.</span>':''}</div>`;
  }
  function tripDates() { const now=today(),first='2026-10-01',last='2026-10-06';if(now>last)return[];const start=now>first?now:first;return Array.from({length:7},(_,i)=>{const date=new Date(`${first}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+i);return date.toISOString().slice(0,10);}).filter(date=>date>=start&&date<=last); }
  function renderWarning() {
    const banner=$('#alpineWarning');if(!banner||!payload)return;const dates=tripDates(),risks=[];
    for(const id of ['zabljak','sedlo']){const hub=hubs.find(item=>item.id===id),daily=payload.locations?.[id]?.daily;if(!daily)continue;for(let i=0;i<daily.time.length;i++){const day=daily.time[i];if(!dates.includes(day))continue;const low=daily.temperature_2m_min?.[i],chance=daily.precipitation_probability_max?.[i];if((low!=null&&low<=2)||(chance!=null&&chance>60))risks.push(`${hub.name} · ${dateLabel(day)}${low!=null&&low<=2?` · low ${Math.round(low)}°C`:''}${chance!=null&&chance>60?` · precipitation ${Math.round(chance)}%`:''}`);}}
    banner.hidden=!risks.length;$('#alpineWarningDetails').textContent=risks.length?`Forecast threshold reached: ${risks.join('; ')}.`:'';
  }
  function renderDays() {
    const hub=hubs.find(item=>item.id===selectedHub),daily=payload?.locations?.[hub?.id]?.daily,container=$('#weatherDays');if(!daily||!container)return;
    const dates=tripDates();if(!dates.length){container.innerHTML='';$('#weatherLoading').textContent='The trip window is complete; no forecast dates remain.';$('#weatherLoading').hidden=false;$('#weatherForecast').hidden=true;return;}
    selectedDay=Math.min(selectedDay,dates.length-1);
    container.innerHTML=dates.map((day,position)=>({day,position,index:daily.time.indexOf(day)})).filter(item=>item.index>=0).map(({day,position,index:i})=>{const low=daily.temperature_2m_min?.[i],high=daily.temperature_2m_max?.[i],chance=daily.precipitation_probability_max?.[i],risk=(low!=null&&low<=2)||(chance??0)>60,dawn=civilTwilight(day,hub.lat,hub.lon,true,payload.locations[hub.id].timezone),dusk=civilTwilight(day,hub.lat,hub.lon,false,payload.locations[hub.id].timezone);return `<button type="button" class="weather-day" data-weather-day="${position}" aria-pressed="${position===selectedDay}"><span>${dateLabel(day)}</span><b>${high==null?'—':`${Math.round(high)}°`} / ${low==null?'—':`${Math.round(low)}°`}</b><small class="${risk?'weather-risk':''}">${chance==null?'—':`${Math.round(chance)}% rain`}${risk?' · caution':''}</small><small>☼ ${timeLabel(daily.sunrise?.[i],payload.locations[hub.id].timezone)} · Sunset ${timeLabel(daily.sunset?.[i],payload.locations[hub.id].timezone)}</small><small>Civil ${dawn}–${dusk}</small></button>`;}).join('');
    container.querySelectorAll('[data-weather-day]').forEach(button=>button.addEventListener('click',()=>{selectedDay=Number(button.dataset.weatherDay);renderDays();renderCompare('tivat','coastWeather');renderCompare('zabljak','alpineWeather');renderHourly();}));
  }
  function renderHourly() {
    const hub=hubs.find(item=>item.id===selectedHub),data=payload?.locations?.[hub?.id],hourly=data?.hourly,day=tripDates()[selectedDay],container=$('#hourlyScroller');if(!hub||!hourly||!container||!day)return;
    $('#hourlyTitle').textContent=`${hub.name} · ${dateLabel(day)} hourly outlook`;const indexes=hourly.time.map((value,i)=>value.startsWith(day)?i:-1).filter(i=>i>=0),maxRain=Math.max(1,...indexes.map(i=>hourly.rain?.[i]||0));
    container.innerHTML=indexes.map(i=>{const rain=hourly.rain?.[i]||0,chance=hourly.precipitation_probability?.[i],temp=hourly.temperature_2m?.[i],time=timeLabel(hourly.time[i],data.timezone),height=rain?Math.max(10,Math.round(rain/maxRain*100)):3;return `<div class="hour-cell" aria-label="${escape(time)}, ${temp==null?'temperature unavailable':`${Math.round(temp)} degrees`}, ${chance==null?'precipitation chance unavailable':`${Math.round(chance)} percent precipitation chance`}, ${rain.toFixed(1)} millimeters rain"><time>${escape(time)}</time><b>${temp==null?'—':`${Math.round(temp)}°`}</b><span class="hour-rain" title="${rain.toFixed(1)} mm rain"><i style="height:${height}%"></i></span><small>${rain.toFixed(1)} mm</small><span class="hour-precip">${chance==null?'—':`${Math.round(chance)}%`}</span></div>`;}).join('')||'<p class="weather-empty">Hourly forecast unavailable for this day.</p>';
  }
  function renderDetail() { const hub=hubs.find(item=>item.id===selectedHub);if(!hub)return;$('#weatherHubTitle').textContent=`${hub.name} · ${hub.region}`;$('#weatherLoading').hidden=!!payload;$('#weatherForecast').hidden=!payload;if(payload){renderDays();renderHourly();} }
  function display(data,mode) {
    payload=data;const badge=$('#weatherMode');badge.textContent=mode==='offline'?'Offline Mode - Showing Cached Forecast':mode==='cached'?'Saved forecast · checking for updates':'Live forecast';badge.classList.toggle('offline',mode==='offline');badge.classList.toggle('loading',mode==='cached');
    $('#weatherUpdated').textContent=`Last updated: ${new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(data.updatedAt))}`;$('#weatherError').hidden=true;$('#weatherLoading').hidden=true;$('#weatherForecast').hidden=false;
    renderCompare('tivat','coastWeather');renderCompare('zabljak','alpineWeather');renderDetail();renderWarning();
  }
  async function refresh() {
    const badge=$('#weatherMode'),error=$('#weatherError');if(!navigator.onLine){if(payload)display(payload,'offline');else{badge.textContent='Offline Mode - No Cached Forecast';badge.classList.add('offline');$('#weatherLoading').textContent='Forecast is not cached yet. Connect once to load weather data.';}return;}
    badge.textContent='Updating forecast…';badge.classList.add('loading');
    try {
      const url=new URL('https://api.open-meteo.com/v1/forecast'),params={latitude:hubs.map(hub=>hub.lat).join(','),longitude:hubs.map(hub=>hub.lon).join(','),hourly:'temperature_2m,precipitation_probability,rain,cloud_cover',daily:'temperature_2m_min,temperature_2m_max,precipitation_probability_max,wind_gusts_10m_max,sunrise,sunset',forecast_days:'16',timezone:'auto',temperature_unit:'celsius',wind_speed_unit:'kmh',precipitation_unit:'mm'};
      Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,value));const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`Forecast request returned ${response.status}.`);
      const body=await response.json(),rows=Array.isArray(body)?body:[body];if(rows.length!==hubs.length)throw new Error('Forecast response did not include all eight route hubs.');
      const locations={};hubs.forEach((hub,index)=>{if(!rows[index]?.daily?.time?.length||!rows[index]?.hourly?.time?.length)throw new Error(`Forecast data is incomplete for ${hub.name}.`);locations[hub.id]=rows[index];});
      const fresh={updatedAt:new Date().toISOString(),locations};try{localStorage.setItem(cacheKey,JSON.stringify(fresh));}catch{}display(fresh,'live');
    } catch(reason) { if(payload){display(payload,'offline');error.textContent=`Could not refresh weather (${reason.message}). Showing the last successful forecast.`;}else{error.textContent=`Weather forecast unavailable: ${reason.message}`;error.hidden=false;$('#weatherLoading').textContent='Reconnect to load the trip-window forecast.';badge.textContent='Forecast unavailable';badge.classList.add('offline');}error.hidden=false; }
  }
  function init() {
    try { const saved=JSON.parse(localStorage.getItem(cacheKey)||'null');if(saved?.locations)display(saved,navigator.onLine?'cached':'offline'); } catch {}
    if(!navigator.onLine&&!payload){$('#weatherMode').textContent='Offline Mode - No Cached Forecast';$('#weatherMode').classList.add('offline');$('#weatherLoading').textContent='Forecast is not cached yet. Connect once to load weather data.';}
    renderHubPicker();
    refresh();locateUser();addEventListener('online',refresh);
  }
  init();
})();
