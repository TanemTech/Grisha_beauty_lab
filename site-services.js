(function(global){
  'use strict';
  const data=global.TANEM_SITE_DATA;
  const labels={
    ru:{book:'Записаться',options:'Варианты и цены',more:'Подробнее',less:'Свернуть',min:'мин',hour:'ч'},
    en:{book:'Book',options:'Options and prices',more:'Read more',less:'Collapse',min:'min',hour:'h'},
    hy:{book:'Ամրագրել',options:'Տարբերակներ և գներ',more:'Մանրամասն',less:'Փակել',min:'ր.',hour:'ժ.'},
    uz:{book:'Yozilish',options:'Variantlar va narxlar',more:'Batafsil',less:'Yig‘ish',min:'daq',hour:'soat'},
    tg:{book:'Сабт шудан',options:'Вариантҳо ва нархҳо',more:'Муфассал',less:'Пӯшидан',min:'дақ',hour:'соат'}
  };
  const words=lang=>labels[lang]||labels.ru;
  const localize=(value,lang)=>typeof value==='string'?value:(value?.[lang]??value?.ru??value?.en??'');
  const byId=new Map((data?.services||[]).map(service=>[service.id,service]));
  const language=()=>global.TANEM_REGION?.resolve(document.body?.dataset.brLang||document.documentElement.lang||data.defaultLocale)||'ru';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizePrice=value=>String(value||'').trim().replace(/[\u00a0\u202f]/g,' ')
    .replace(/^(?:от|from)\s+([\d ]+)\s+(?:до|to)\s+([\d ]+)\s*([₽֏€$£])$/iu,'$1–$2 $3')
    .replace(/([\d ])\s*[–—-]\s*(?=\d)/u,'$1–').replace(/ +/g,' ');
  const description=(service,lang)=>localize(service.description,lang).trim();
  function duration(value,lang){
    const raw=localize(value,lang),m=raw.match(/^(\d+(?:[.,]\d+)?)\s*(мин(?:ут(?:а|ы)?)?|min(?:utes?)?|ч(?:ас(?:а|ов)?)?|h(?:ours?)?)\.?$/iu);
    if(!m)return raw;
    const n=Number(m[1].replace(',','.')),minutes=/^(мин|min)/iu.test(m[2])?n:n*60;
    const {min,hour}=words(lang);
    if(minutes<60)return minutes+' '+min;
    const hours=minutes/60;
    if(Number.isInteger(hours*2))return new Intl.NumberFormat(lang,{maximumFractionDigits:1}).format(hours)+' '+hour;
    return Math.floor(hours)+' '+hour+' '+Math.round(minutes%60)+' '+min;
  }
  function priceMarkup(value,device,lang){
    const price=normalizePrice(value),range=price.match(/^([\d ]+)[–-]([\d ]+)\s*([₽֏€$£])$/u);
    const from=lang==='en'?'from':lang==='hy'?'սկսած':'от';
    const display=range?from+' '+range[1].trim()+' '+range[3]:price;
    return '<span class="tanem-service-price">'+escape(display)+'</span>';
  }
  function lengthPrice(variants,lang){
    const prices=variants.map(variant=>normalizePrice(localize(variant.price,lang)).match(/^(?:(от|from)\s+)?([\d ]+)(?:–([\d ]+))?\s*([₽֏€$£])$/iu)).filter(Boolean);
    const currency=prices[0]?.[4];
    if(!currency||!prices.every(price=>price[4]===currency))return '';
    const amounts=prices.map(price=>Number(price[2].replace(/ /g,'')));
    const format=amount=>String(amount).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
    const low=Math.min(...amounts),high=Math.max(...prices.map(price=>Number((price[3]||price[2]).replace(/ /g,''))));
    const uncertain=prices.length!==variants.length||prices.some(price=>price[1]||price[3]);
    return (high===low&&uncertain?(lang==='en'?'from ':'от '):'')+format(low)+(high===low?'':'–'+format(high))+' '+currency;
  }
  function render(service,device,lang=language()){
    const title=localize(service.title,lang).replace(/\u00ad/g,''),variants=(service.variants||[]).filter(v=>localize(v.label,lang)||localize(v.price,lang)||localize(v.duration,lang));
    const range=lengthPrice(variants,lang);
    const copy=description(service,lang),price=(service.variantType==='length'?range:'')||localize(service.price,lang)||range,time=duration(service.duration,lang);
    const id='service-description-'+device+'-'+(service.profileId||'catalogue')+'-'+service.id;
    const copyLabels=words(lang),book=copyLabels.book;
    const tariffRows=variants.map(variant=>{
      const originalLabel=localize(variant.label,lang);
      const shortLabels=lang==='ru'?{'Короткие волосы':'Короткие','Средняя длина':'Средние','Длинные волосы':'Длинные','Супердлинные волосы':'Супердлинные'}:{};
      const label=service.variantType==='length'?(shortLabels[originalLabel]||originalLabel):originalLabel;
      const time=duration(variant.duration,lang);
      const price=normalizePrice(localize(variant.price,lang));
      return '<div><dt>'+escape(label)+'</dt><dd>'+(time?'<span class="tanem-variant-duration">'+escape(time)+'</span>':'')+
        (price?'<span>'+escape(price)+'</span>':'')+'</dd></div>';
    }).join('');
    const tariffs=tariffRows?'<dl class="tanem-service-tariffs">'+tariffRows+'</dl>':'';
    const optionsLabel=copyLabels.options;
    const options=variants.length?'<details class="tanem-service-options"><summary><span class="tanem-options-label">'+escape(optionsLabel)+' +</span></summary><div class="tanem-options-panel">'+tariffs+'</div></details>':'';
    const prose=copy?'<div class="tanem-service-description"><p id="'+escape(id)+'">'+escape(copy)+'</p></div>':'';
    const more=copy?'<button class="tanem-service-more" type="button" aria-expanded="false" aria-controls="'+escape(id)+'" hidden>'+copyLabels.more+'</button>':'';
    return '<article class="'+(device==='desktop'?'dct-service-card':'tn31-service-row')+' tanem-service-card" data-tanem-service-id="'+escape(service.id)+'" data-tanem-profile="'+escape(service.profileId||'catalogue')+'" data-tanem-layout="'+device+'" data-tanem-lang="'+lang+'">'+
      '<strong class="tanem-service-title '+(device==='desktop'?'dct-service-card-title':'tn31-service-name')+'">'+escape(title).replace(/([+/])/g,'$1<wbr>')+'</strong>'+
      '<div class="tanem-service-copy">'+prose+'</div>'+
      '<div class="tanem-service-side">'+(time?'<small class="tanem-service-duration"'+(service.previewDuration?' title="'+(lang==='en'?'Demonstration only':'Тестовое значение')+'"':'')+'><svg class="tanem-duration-clock" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.2"/><path d="M8 4.5V8l2.3 1.5"/></svg><span class="tanem-duration-text">'+escape(time)+'</span></small>':'')+(price?priceMarkup(price,device,lang):'<span class="tanem-service-price">'+book+'</span>')+'</div>'+more+options+
      '<button class="tanem-service-book" type="button" '+(device==='desktop'?'data-service-book':'data-book-service')+' aria-label="'+book+': '+escape(title)+'"></button></article>';
  }
  function measure(card){
    const box=card.querySelector('.tanem-service-description');if(!box){positionPrice(card);return;}
    const paragraph=box.querySelector('p'),button=card.querySelector('.tanem-service-more');
    box.classList.add('is-measuring');
    const needsMore=paragraph.getBoundingClientRect().height>(parseFloat(getComputedStyle(paragraph).lineHeight)||18)*2+1.5;
    box.classList.remove('is-measuring');
    button.hidden=!needsMore;
    if(!needsMore){box.classList.remove('is-expanded');button.setAttribute('aria-expanded','false')}
    positionPrice(card);
  }
  function positionPrice(card){
    if(card.querySelector('.is-expanded,.tanem-service-options[open]'))return;
    const side=card.querySelector('.tanem-service-side');if(!side||!card.clientHeight)return;
    const copy=card.querySelector('.tanem-service-copy');
    const top=Math.max(0,((copy?.offsetHeight||0)-side.offsetHeight)/2);
    card.style.setProperty('--tanem-price-top',top+'px');
  }
  function enhance(scope){
    scope.querySelectorAll('.tanem-service-card').forEach(card=>{
      const options=card.querySelector('.tanem-service-options');
      if(options&&!options.dataset.bound){
        options.dataset.bound='true';
        const summary=options.querySelector('summary'),panel=options.querySelector('.tanem-options-panel');
        const label=summary.querySelector('.tanem-options-label');
        const baseLabel=label.textContent.slice(0,-2);
        const initialExpanded=options.dataset.expanded===undefined?options.open:options.dataset.expanded==='true';
        let animation=null,animationTimer=0,animationRun=0;
        const syncGlint=()=>{label.style.animationDelay='-'+Math.round(performance.now()%5000)+'ms'};
        const updateLabel=expanded=>{
          label.textContent=baseLabel+(expanded?' −':' +');
          summary.setAttribute('aria-expanded',String(expanded));
          options.dataset.expanded=String(expanded);
        };
        updateLabel(initialExpanded);
        syncGlint();
        summary.addEventListener('click',event=>{
          event.preventDefault();event.stopPropagation();
          const wasVisible=options.open;
          if(!wasVisible)positionPrice(card);
          const from=panel.getBoundingClientRect().height;
          const computedOpacity=wasVisible?Number.parseFloat(getComputedStyle(panel).opacity):0;
          animation?.cancel();animation=null;
          global.clearTimeout(animationTimer);
          const run=++animationRun;
          const expanded=options.dataset.expanded!=='true';
          options.open=true;
          updateLabel(expanded);

          // A closed <details> hides its panel. Open it, measure its natural
          // height, then establish a real zero-height start before animating.
          const naturalHeight=expanded?panel.getBoundingClientRect().height:0;
          if(!wasVisible&&expanded){
            panel.style.height='0px';
            panel.style.opacity='0';
          }
          panel.style.overflow='hidden';
          if(!wasVisible&&expanded)panel.getBoundingClientRect();

          const reduce=global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          const to=expanded?naturalHeight:0;
          const fromHeight=wasVisible?from:0;
          const fromOpacity=wasVisible&&Number.isFinite(computedOpacity)?computedOpacity:0;
          const duration=260;
          const clearPanelStyles=()=>{
            panel.style.removeProperty('height');
            panel.style.removeProperty('opacity');
            panel.style.removeProperty('overflow');
          };
          if(reduce||typeof panel.animate!=='function'||Math.abs(to-fromHeight)<1){
            clearPanelStyles();
            options.open=expanded;
            if(!expanded){syncGlint();positionPrice(card);}
            return;
          }
          const current=panel.animate(
            [{height:fromHeight+'px',opacity:fromOpacity},{height:to+'px',opacity:expanded?1:0}],
            {duration,easing:'cubic-bezier(.22,1,.36,1)'}
          );
          animation=current;
          const finish=()=>{
            if(run!==animationRun)return;
            global.clearTimeout(animationTimer);
            animation=null;
            clearPanelStyles();
            options.open=expanded;
            if(!expanded){syncGlint();positionPrice(card);}
          };
          current.onfinish=finish;
          animationTimer=global.setTimeout(()=>{
            if(run!==animationRun)return;
            current.cancel();
            finish();
          },duration+180);
        });
      }
      const button=card.querySelector('.tanem-service-more');
      if(button&&!button.dataset.bound){
        button.dataset.bound='true';
        button.onclick=event=>{
          event.preventDefault();event.stopPropagation();
          const expanded=button.getAttribute('aria-expanded')!=='true';
          if(expanded)positionPrice(card);
          button.setAttribute('aria-expanded',String(expanded));
          card.querySelector('.tanem-service-description')?.classList.toggle('is-expanded',expanded);
          button.textContent=(expanded?words(language()).less:words(language()).more);
          measure(card);
        };
      }
      measure(card);
    });
  }
  function refresh(){
    const lang=language();
    document.querySelectorAll('.tanem-service-card').forEach(card=>{
      if(card.dataset.tanemLang===lang)return;
      const service=byId.get(card.dataset.tanemServiceId);if(!service)return;
      const expanded=card.querySelector('.tanem-service-more')?.getAttribute('aria-expanded')==='true';
      const currentOptions=card.querySelector('.tanem-service-options');
      const optionsOpen=currentOptions?(currentOptions.dataset.expanded===undefined?currentOptions.open:currentOptions.dataset.expanded==='true'):false;
      const holder=document.createElement('div');holder.innerHTML=render({...service,profileId:card.dataset.tanemProfile},card.dataset.tanemLayout,lang);
      const next=holder.firstElementChild;
      // Keep booking listeners on the existing button when changing the language.
      const oldBook=card.querySelector('.tanem-service-book'),newBook=next.querySelector('.tanem-service-book');
      oldBook.setAttribute('aria-label',newBook.getAttribute('aria-label'));newBook.replaceWith(oldBook);
      card.replaceChildren(...next.childNodes);card.dataset.tanemLang=lang;
      const options=card.querySelector('.tanem-service-options');
      if(options){
        options.open=!!optionsOpen;
        options.dataset.expanded=String(!!optionsOpen);
        const summary=options.querySelector('summary');
        summary.setAttribute('aria-expanded',String(!!optionsOpen));
        const label=options.querySelector('.tanem-options-label');
        if(label)label.textContent=label.textContent.slice(0,-2)+(optionsOpen?' −':' +');
      }
      if(expanded){const button=card.querySelector('.tanem-service-more');if(button){button.setAttribute('aria-expanded','true');button.textContent=words(lang).less;card.querySelector('.tanem-service-description')?.classList.add('is-expanded')}}
    });
    enhance(document);
  }
  global.TANEM_SERVICES={render,enhance,normalizePrice,description,duration};
  if(typeof document!=='undefined'){
    let frame=0;
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;refresh()})};
    global.addEventListener('salon-template:languagechange',schedule);
    global.addEventListener('resize',schedule,{passive:true});
    document.fonts?.ready.then(schedule).catch(()=>{});
  }
})(window);
