/* Shared gallery order and client-only preview configuration. */
(function(global){
  'use strict';
  const data=global.TANEM_SITE_DATA;
  if(!data)return;
  const gallery=Object.entries(data.media.gallery||{}).filter(([,items])=>items.length);
  gallery.sort(([a],[b])=>Number(b.trim().toLowerCase()==='салон')-Number(a.trim().toLowerCase()==='салон'));
  data.media.gallery=Object.fromEntries(gallery);
  const galleryDefault=gallery.find(([category])=>category.trim().toLowerCase()!=='салон')?.[0]||gallery[0]?.[0]||'';
  // Data-only preview: category cards are not claims about named employees.
  const loc=(ru,en)=>({ru,en,hy:'',uz:'',tg:''});
  const roles={
    'Волосы':loc('Парикмахер','Hair stylist'),
    'Ногти':loc('Nail-мастер','Nail technician'),
    'Массаж':loc('Массажист','Massage therapist'),
    'Косметология':loc('Косметолог','Cosmetologist'),
    'Лазерная эпиляция':loc('Лазерная эпиляция','Laser hair removal'),
    'Восковая депиляция':loc('Мастер депиляции','Waxing specialist'),
    'Ресницы':loc('Lash-мастер','Lash technician'),
    'Макияж':loc('Визажист','Makeup artist'),
    'Брови':loc('Бровист','Brow specialist'),
    'Перманентный макияж':loc('Мастер перманента','Permanent makeup artist')
  };
  if(data.mode==='production'){
    if(data.team.length){
      for(const master of data.team){
        if(master.firstName)master.name=master.firstName;
        else if(typeof master.name==='string')master.name=master.name.trim().split(/\s+/u)[0];
        else for(const lang of Object.keys(master.name||{}))if(master.name[lang])master.name[lang]=master.name[lang].trim().split(/\s+/u)[0];
      }
    }else if(data.previewConfig?.categoryMasterFallback){
      data.team=data.categoryOrder.filter(category=>data.services.some(s=>s.category===category)).map((category,index)=>({
        id:'category-master-'+(index+1),categoryPreview:true,
        name:loc('Мастер','Specialist'),role:roles[category]||loc(category, data.categoryLabels?.[category]?.en||category),
        about:loc('Информация о специалисте пока не заполнена.','Specialist information is not available yet.'),
        categories:[category],serviceIds:data.services.filter(s=>s.category===category).map(s=>s.id),
        work:data.media.gallery[category]||[],reviewIds:[]
      }));
    }
    // Fake duration values are restricted to the explicitly requested demonstration URL.
    if(data.previewConfig?.categoryMasterFallback&&typeof location!=='undefined'&&new URLSearchParams(location.search).get('preview')==='1'){
      const previewTimes={'service-001':'2 ч','service-002':'1,5 ч','service-003':'30 мин','service-004':'4 ч'};
      for(const service of data.services)if(previewTimes[service.id]){service.duration=previewTimes[service.id];service.previewDuration=true;}
    }
  }
  for(const master of data.team||[])if(master.categoryPreview){
    for(const value of [master.name,master.role,master.about])global.TANEM_SITE_I18N_ROWS?.push([value.ru,value.hy,value.en]);
  }
  global.TANEM_CONTENT={galleryDefault};
})(window);
