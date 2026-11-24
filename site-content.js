/* Data preparation shared by both layouts. No network calls or AI at runtime. */
(function(global){
  'use strict';
  const data=global.TANEM_SITE_DATA;
  if(!data)return;
  const local=(value,lang='ru')=>typeof value==='string'?value:(value?.[lang]||value?.ru||'');
  const labels=(ru,en)=>({ru,en});
  // Roles describe confirmed work only; neither seniority nor qualifications are inferred.
  const specialties=[
    {match:/ногт|маникюр|педикюр/i,role:labels('Nail-мастер','Nail technician')},
    {match:/колорист|окрашив/i,role:labels('Колорист','Colourist')},
    {match:/волос|парикмах|стриж|уклад/i,role:labels('Парикмахер','Hair stylist')},
    {match:/косметолог/i,role:labels('Косметолог','Beauty therapist')},
    {match:/бров/i,role:labels('Бровист','Brow stylist')},
    {match:/ресниц/i,role:labels('Lash-мастер','Lash technician')},
    {match:/перманент/i,role:labels('Мастер перманента','Permanent makeup artist')},
    {match:/макияж/i,role:labels('Визажист','Makeup artist')},
    {match:/массаж/i,role:labels('Массажист','Massage therapist')},
    {match:/эпиляц|депиляц/i,role:labels('Мастер эпиляции','Hair removal specialist')}
  ];
  const firstName=value=>String(value||'').trim().split(/\s+/u)[0]||'';
  const gallery=Object.entries(data.media.gallery||{}).filter(([,items])=>items.length);
  gallery.sort(([a],[b])=>Number(b.trim().toLowerCase()==='салон')-Number(a.trim().toLowerCase()==='салон'));
  data.media.gallery=Object.fromEntries(gallery);
  const galleryDefault=gallery.find(([category])=>category.trim().toLowerCase()!=='салон')?.[0]||gallery[0]?.[0]||'';
  const profiles=(data.team||[]).map(master=>{
    // firstName can be supplied explicitly when the source lists surname first.
    const name=master.firstName||master.name;
    const shortName=typeof name==='string'?firstName(name):Object.fromEntries(Object.entries(name||{}).map(([lang,value])=>[lang,firstName(value)]));
    const confirmed=(master.serviceIds||[]).map(id=>data.services.find(service=>service.id===id)).filter(Boolean);
    const categoryText=(master.categories||[]).concat(confirmed.map(s=>s.category)).join(' ');
    const role=local(master.role)?master.role:specialties.find(item=>item.match.test(categoryText))?.role||'';
    const categories=master.categories||[];
    const serviceIds=master.serviceIds===undefined?data.services.filter(s=>categories.includes(s.category)).map(s=>s.id):master.serviceIds;
    const work=master.work===undefined?categories.flatMap(category=>data.media.gallery[category]||[]):master.work;
    return {...master,name:shortName,role,serviceIds,work,workScope:master.work===undefined?'salon':master.workScope};
  });
  // An absent staff list is represented by salon departments, never invented people.
  if(!profiles.length&&data.mode==='production'){
    for(const category of data.categoryOrder||[]){
      const services=data.services.filter(service=>service.category===category);
      if(!services.length)continue;
      const work=data.media.gallery[category]||[];
      const name=data.categoryLabels?.[category]||labels(category,category);
      profiles.push({id:'direction-'+profiles.length,kind:'direction',name,role:'',
        about:labels('Услуги и работы салона по этому направлению.','Salon services and work in this category.'),
        photo:typeof work[0]==='string'?work[0]:work[0]?.src||'',categories:[category],
        serviceIds:services.map(service=>service.id),work,reviewIds:[]});
    }
  }
  global.TANEM_CONTENT={specialties,firstName,profiles,galleryDefault,directions:!data.team?.length&&profiles.length>0};
  // Register new short names for the existing language switchers.
  const rows=global.TANEM_SITE_I18N_ROWS||[];
  profiles.forEach(profile=>{for(const value of [profile.name,profile.role,profile.about])if(value?.ru)rows.push([value.ru,value.hy||value.en||value.ru,value.en||value.ru]);});
  global.TANEM_SITE_I18N_ROWS=rows;
})(window);
