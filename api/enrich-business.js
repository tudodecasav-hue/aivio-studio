export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Método não permitido'});
  const safeJson=()=>{try{if(!req.body)return{};return typeof req.body==='string'?JSON.parse(req.body):req.body}catch{return{}}};
  try{
    const body=safeJson();
    const raw=String(body.text||body.description||'').trim();
    const businessName=String(body.businessName||'').trim();
    const category=String(body.category||'').trim();
    const city=String(body.city||'').trim();
    if(!raw&&!businessName) return res.status(400).json({error:'Informe o nome do negócio ou cole as informações do negócio.'});
    const clean=s=>String(s||'').replace(/\s+/g,' ').replace(/\s+([,.!?;:])/g,'$1').trim();
    const facts=[];
    const push=(field,value,source='texto fornecido',status='fornecido')=>{const v=clean(value);if(v&&!facts.some(x=>x.field===field&&x.value===v))facts.push({field,value:v,source,status});};
    const urls=[...raw.matchAll(/https?:\/\/[^\s<>'"]+/gi)].map(m=>m[0].replace(/[),.;]+$/,''));
    const phone=raw.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}/)?.[0];
    const whatsapp=raw.match(/(?:whatsapp|wpp|zap)[^\d]{0,12}((?:\+?55\s?)?\(?\d{2}\)?\s?\d{4,5}[-.\s]?\d{4})/i)?.[1];
    const email=raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    if(businessName)push('nome',businessName,'usuário');
    if(category)push('categoria',category,'usuário');
    if(city)push('cidade',city,'usuário');
    if(phone)push('telefone',phone);
    if(whatsapp)push('whatsapp',whatsapp);
    if(email)push('email',email);
    const addressLine=raw.match(/(?:endereço|endereco|localiza(?:ção|cao)|rua|av\.?|avenida)[^\n]{5,160}/i)?.[0];
    if(addressLine)push('endereço',addressLine);
    const rating=raw.match(/(?:nota|avalia(?:ção|cao)|rating)[^\d]{0,12}(\d[,.]\d)/i)?.[1];
    const reviews=raw.match(/(?:avalia(?:ções|coes)|reviews)[^\d]{0,20}(\d[\d.]*)/i)?.[1];
    if(rating)push('avaliação',rating);
    if(reviews)push('número de avaliações',reviews);
    const sourceResults=urls.map(url=>({url,type:'URL fornecida',status:'a verificar'}));

    // External enrichment is optional. A provider outage must never break site creation.
    if(process.env.GOOGLE_PLACES_API_KEY&&(businessName||raw)){
      try{
        const q=encodeURIComponent([businessName,category,city].filter(Boolean).join(' '));
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),7000);
        const r=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','X-Goog-Api-Key':process.env.GOOGLE_PLACES_API_KEY,'X-Goog-FieldMask':'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.googleMapsUri,places.photos'},body:JSON.stringify({textQuery:q,languageCode:'pt-BR',regionCode:'BR',maxResultCount:5})});
        clearTimeout(timer);
        if(r.ok){
          const j=await r.json();
          (j.places||[]).forEach((p,i)=>{const src=`Google Places #${i+1}`;if(p.displayName?.text)push('nome',p.displayName.text,src,'encontrado');if(p.formattedAddress)push('endereço',p.formattedAddress,src,'encontrado');if(p.nationalPhoneNumber||p.internationalPhoneNumber)push('telefone',p.nationalPhoneNumber||p.internationalPhoneNumber,src,'encontrado');if(p.websiteUri)sourceResults.push({url:p.websiteUri,type:'site oficial provável',status:'encontrado',source:src});if(p.rating)push('avaliação',String(p.rating),src,'encontrado');if(p.userRatingCount)push('número de avaliações',String(p.userRatingCount),src,'encontrado');if(p.googleMapsUri)sourceResults.push({url:p.googleMapsUri,type:'Google Maps',status:'encontrado',source:src});});
        }else sourceResults.push({type:'Google Places',status:'indisponível',reason:`HTTP ${r.status}`});
      }catch(err){sourceResults.push({type:'Google Places',status:'indisponível',reason:'falha temporária'});}
    }

    const excluded=['adicionar website','adicionar informações ausentes','horários de pico','ver todos os comentários','rotas','avaliar','compartilhar','salvar','ligar'];
    const cleanedRaw=raw.split(/\n|[|•]/).map(clean).filter(x=>x&&x.length>2&&!excluded.some(e=>x.toLowerCase().includes(e)));
    const categories={restaurante:['cardápio','pratos em destaque','delivery','horário','localização','avaliações','whatsapp'],barbearia:['serviços','profissionais','galeria','preços','agendamento','whatsapp'],'salão':['serviços','profissionais','galeria','preços','agendamento'],clinica:['especialidades','profissionais','estrutura','procedimentos','agendamento','localização'],academia:['modalidades','planos','estrutura','horários','professores','matrícula'],hotel:['acomodações','serviços','galeria','localização','reservas'],loja:['produtos','coleções','preços','galeria','contato']};
    const key=Object.keys(categories).find(k=>(category+' '+raw).toLowerCase().includes(k));
    return res.status(200).json({ok:true,mode:'paste+enrichment',business:{name:businessName||facts.find(x=>x.field==='nome')?.value||'',category:category||facts.find(x=>x.field==='categoria')?.value||'',city:city||facts.find(x=>x.field==='cidade')?.value||''},facts,cleanedText:cleanedRaw.join('\n'),sources:sourceResults,sections:categories[key]||['hero','sobre','serviços e produtos','galeria','prova social','informações','contato'],rules:{neverInvent:true,sourceLabels:true,manualReviewForConflicts:true}});
  }catch(e){
    console.error('AIVIO enrichment error',e);
    // Return a usable result from the pasted content instead of failing the whole creation flow.
    const body=safeJson();
    const raw=String(body.text||body.description||'').trim();
    return res.status(200).json({ok:true,degraded:true,mode:'paste-only',business:{name:String(body.businessName||'').trim(),category:String(body.category||'').trim(),city:String(body.city||'').trim()},facts:[],sources:[],cleanedText:raw,sections:['hero','sobre','serviços e produtos','galeria','prova social','informações','contato'],rules:{neverInvent:true,sourceLabels:true,manualReviewForConflicts:true}});
  }
}
