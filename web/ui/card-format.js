/** Shared, explicit energy notation used by card faces and deck filters. */
export const energyNames={red:'Красная',blue:'Синяя',green:'Зелёная',gold:'Золотая',violet:'Фиолетовая',neutral:'Нейтральная'};
const symbols={red:'К',blue:'С',green:'З',gold:'Ж',violet:'Ф',neutral:'Н'};
export function energyValue(card){return (card.cost?.generic||0)+Object.values(card.cost?.colored||{}).reduce((sum,value)=>sum+value,0)}
export function formatCost(card){
 if(card.kind==='domain')return 'Энергия: '+(energyNames[card.produces]||'Любая');
 const parts=Object.entries(card.cost?.colored||{}).filter(([,n])=>n).map(([color,n])=>symbols[color]+' '+n);
 if(card.cost?.generic)parts.push('Любая '+card.cost.generic);
 return 'Стоимость: '+(parts.join(' · ')||'0');
}
