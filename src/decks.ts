import { validateDeck, type Aspect, type Card, type Cost } from './core.ts';

export type ArchetypeId = Aspect | 'neutral';
export const ARCHETYPES: readonly { id: ArchetypeId; name: string; state: string; organization: string }[] = [
  { id: 'red', name: 'Стальное королевство · Горная стража', state: 'Стальное королевство', organization: 'Горная стража' },
  { id: 'blue', name: 'Талдрейк · Воздушная флотилия', state: 'Талдрейк', organization: 'Воздушная флотилия' },
  { id: 'green', name: 'Сувар · Дозор Кайров', state: 'Королевство Сувар', organization: 'Дом Кайров' },
  { id: 'gold', name: 'Ивелтин · Королевские рыцари', state: 'Королевство Ивелтин', organization: 'Королевские рыцари' },
  { id: 'violet', name: 'Искажение · Сокровищница Ван Троупов', state: 'Сепер (игровая привязка альфы)', organization: 'Ван Троупы' },
  { id: 'neutral', name: 'Орден Хранителей · Новые хранители', state: 'Межгосударственный орден', organization: 'Новые хранители' },
];

type Unit = { name: string; cost: number; attack: number; health: number; traits?: Partial<Card> };
type Theme = { plain: Unit[]; effects: Unit[]; legends: [string, string]; item: string };
const themes: Record<ArchetypeId, Theme> = {
  red: {
    plain: [['Горный ополченец',1,2,1],['Рудокоп стали',2,2,2],['Стрелок перевала',2,3,1],['Кузнец заставы',3,3,3],['Всадник хребта',4,4,3],['Тяжёлый пехотинец',5,5,5]].map(unit),
    effects: [['Разведчик с перевала',1,1,1,{haste:true}],['Рыцарь горной стражи',2,2,3,{guard:true}],['Мастер первого удара',3,3,2,{firstStrike:true}],['Таранный всадник',3,3,3,{piercing:true}],['Пламенный авангард',4,4,2,{haste:true}],['Капитан дозора',4,3,5,{guard:true,firstStrike:true}],['Молотобоец королевства',5,5,4,{piercing:true}],['Двукратный натиск',6,5,5,{extraAttacks:1}]].map(unit),
    legends: ['Командор стального рубежа','Хранитель горного прохода'], item:'Знамя горной стражи',
  },
  blue: {
    plain: [['Матрос Талдрейка',1,1,2],['Доковый плотник',2,2,2],['Курсант аэродрома',2,2,3],['Палубный дозорный',3,3,2],['Штурманская команда',4,3,4],['Бортовой ветеран',5,4,5]].map(unit),
    effects: [['Быстрый курьер',1,1,2,{flying:true}],['Сторожевой дирижабль',2,2,3,{flying:true}],['Воздушный перехватчик',3,2,4,{flying:true,guard:true}],['Небесный дуэлянт',3,2,3,{flying:true,extraAttacks:1}],['Штурмовой пилот',4,4,3,{flying:true,firstStrike:true}],['Капитан флотилии',4,3,5,{guard:true}],['Небесный налётчик',5,5,4,{flying:true}],['Флагманский десант',6,5,6,{flying:true,extraAttacks:1}]].map(unit),
    legends: ['Адмирал талдрейкского неба','Мастер воздушных путей'], item:'Навигационный кристалл флотилии',
  },
  green: {
    plain: [['Суварский следопыт',1,1,2],['Лесной подмастерье',2,2,2],['Страж тропы',2,2,3],['Садовый зверь',3,3,3],['Суварский охотник',4,4,4],['Древесный исполин',5,5,5]].map(unit),
    effects: [['Живучий зверёк',1,1,2,{lifesteal:true}],['Защитник чащи',2,2,3,{guard:true}],['Хищник Сувара',3,3,2,{poisonHit:{strength:1,ticks:2}}],['Целитель рощи',3,2,4,{lifesteal:true}],['Лесная дозорная',4,4,3,{stealth:true}],['Корневой бастион',4,3,6,{guard:true,shield:1}],['Дикий оплот',5,4,5,{lifesteal:true}],['Страж зелёного рубежа',6,6,6,{guard:true}]].map(unit),
    legends: ['Старейшина рода Кайров','Защитница суварских рощ'], item:'Знамя дома Кайров',
  },
  gold: {
    plain: [['Ивелтинский рекрут',1,1,2],['Оруженосец короны',2,2,2],['Городской дозорный',2,2,3],['Пехотинец Ивелтина',3,3,3],['Конный рыцарь',4,4,4],['Королевский ветеран',5,5,5]].map(unit),
    effects: [['Рыцарь авангарда',1,1,2,{shield:1}],['Дворцовый страж',2,2,3,{guard:true}],['Медик короны',3,2,4,{lifesteal:true}],['Рыцарь щита',3,3,3,{guard:true,shield:1}],['Знаменосец Ивелтина',4,3,5,{guard:true}],['Судья поединка',4,4,3,{firstStrike:true}],['Кавалер ордена',5,4,5,{shield:2,lifesteal:true}],['Королевская гвардия',6,5,6,{guard:true,shield:1}]].map(unit),
    legends: ['Артур II вир Ивелтин','Андриан аур Медлир'], item:'Штандарт королевских рыцарей',
  },
  violet: {
    plain: [['Искатель сокровищницы',1,1,2],['Подручный Ван Троупов',2,2,2],['Сторож подвала',2,2,3],['Шифровальщик реликвий',3,3,2],['Сборщик механизмов',4,4,4],['Хранитель тайника',5,5,5]].map(unit),
    effects: [['Зовущий забытых',1,2,2,{sacrifice:true}],['Призрачный агент',2,2,3,{sacrifice:true,stealth:true}],['Хранитель неисправностей',2,2,3,{sacrifice:true,onDeath:{kind:'damageOpponent',amount:1}}],['Разведчик искажения',3,3,2,{sacrifice:true,haste:true}],['Оператор механизмов',4,3,4,{sacrifice:true,onDeath:{kind:'damageAllCreatures',amount:1}}],['Вестник Шоу',4,4,3,{sacrifice:true,poisonHit:{strength:1,ticks:2}}],['Страж забытого архива',5,4,5,{guard:true,sacrifice:true}]].map(unit),
    legends: ['Колдрейк Шоу','Цера Ван Троуп'], item:'Драгнир и Иммельсторн',
  },
  neutral: {
    plain: [['Послушник Ордена',1,1,2],['Дозорный Ордена',2,2,2],['Писарь утремера',2,2,3],['Странствующий хранитель',3,3,3],['Мастеровой Ордена',4,4,4],['Ветеран Хранителей',5,5,5]].map(unit),
    effects: [['Быстрый разведчик',1,1,1,{haste:true}],['Страж утремера',2,2,3,{guard:true}],['Инквизитор дозора',3,3,2,{firstStrike:true}],['Полевой лекарь',3,2,4,{lifesteal:true}],['Рыцарь знамени',4,4,3,{shield:1}],['Страж архивов',4,3,5,{guard:true}],['Мастер перехвата',5,4,5,{flying:true,guard:true}],['Свирус Жирникус',6,6,5,{piercing:true}]].map(unit),
    legends: ['Верховный хранитель Данте','Мейстер Глерторул'], item:'Полевое знамя Ордена',
  },
};
// New starter identities keep the agreed 18/70 vanilla share and two-copy limit.
const extraPlain: Record<ArchetypeId, string[]> = {
 red:['Гонец горной стражи','Рабочий литейного двора','Караульный рудника'],
 blue:['Сигнальщик причала','Такелажник флотилии','Смотритель ангара'],
 green:['Собиратель трав','Суварский лесоруб','Сторож питомника'],
 gold:['Вестовой короны','Кузнец Ивелтина','Дозорный бастиона'],
 violet:['Смотритель крипты','Переписчик сокровищницы','Ключник Ван Троупов'],
 neutral:['Гонец Хранителей','Снабженец утремера','Архивный смотритель'],
};
const extraEffects: Record<ArchetypeId, Unit[]> = {
 red:[unit(['Последний дозорный',3,2,3,{onDeath:{kind:'damageOpponent',amount:1}}]),unit(['Снабженец горной стражи',4,3,3,{onEntry:{kind:'draw',amount:1}}])],
 blue:[unit(['Летописец флотилии',3,2,2,{onEntry:{kind:'draw',amount:1}}]),unit(['Небесный завещатель',4,3,3,{flying:true,onDeath:{kind:'damageOpponent',amount:1}}])],
 green:[unit(['Травница Кайров',3,2,3,{onEntry:{kind:'healRuler',amount:2}}]),unit(['Вернувшийся следопыт',4,3,4,{secondChance:{kind:'healRuler',amount:2}}])],
 gold:[unit(['Госпитальер короны',3,2,3,{onEntry:{kind:'healRuler',amount:2}}]),unit(['Верный до конца',4,3,4,{guard:true,onDeath:{kind:'damageOpponent',amount:1}}])],
 violet:[unit(['Ученик Церы',3,2,2,{onEntry:{kind:'summonSkeleton',amount:1},sacrifice:true}]),unit(['Некромант родовой крипты',4,3,3,{secondChance:{kind:'summonSkeleton',amount:2},sacrifice:true}])],
 neutral:[unit(['Летописец Ордена',3,2,2,{onEntry:{kind:'draw',amount:1}}]),unit(['Последний часовой',4,3,4,{onDeath:{kind:'damageOpponent',amount:1}}])],
};
function unit(entry: (string | number | Partial<Card>)[]): Unit {
  const [name, cost, attack, health, traits] = entry;
  return { name: name as string, cost: cost as number, attack: attack as number, health: health as number, traits: traits as Partial<Card> | undefined };
}
function cost(color: ArchetypeId, amount: number): Cost { return { colored: color === 'neutral' ? {} : { [color]: 1 }, generic: Math.max(0, amount - (color === 'neutral' ? 0 : 1)) }; }
function identifier(color: string, name: string): string { return `${color}-${name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-')}`; }
function rewardPool(): [Card,Card,Card,Card,Card] {
  return [
    {id:'vt-echo',name:'Дворянский призрак Ван Троупов',nameEn:'Van Troupe Noble Ghost',kind:'creature',aspects:['violet'],attack:4,health:4,shield:1},
    {id:'vt-mechanism',name:'Некроартофакт Ван Троупов',nameEn:'Van Troupe Necro-Artifice',kind:'creature',aspects:['violet'],attack:5,health:3,firstStrike:true},
    {id:'vt-guardian',name:'Реликтовый страж Ван Троупов',nameEn:'Van Troupe Relic Sentinel',kind:'creature',aspects:['violet'],attack:3,health:6,guard:true},
    {id:'vt-specter',name:'Умертвие родовой крипты',nameEn:'Ancestral Crypt Revenant',kind:'creature',aspects:['violet'],attack:4,health:4,lifesteal:true},
    {id:'vt-spark',name:'Искра фамильной сокровищницы',nameEn:'Family Vault Spark',kind:'creature',aspects:['violet'],attack:3,health:3,createdToken:true,poisonHit:{strength:1,ticks:2}},
  ].map(card => ({...card, lore:{state:'Искажение', organization:'Дом Ван Троуп',summary:`${card.name} откликается на ритуал сокровищницы.`,
    note:'Награда ритуала из сокровищницы и некромантских артофактов Ван Троупов; название — игровая адаптация.'}})) as [Card,Card,Card,Card,Card];
}
export function testDeck(id: ArchetypeId): Card[] {
  const archetype = ARCHETYPES.find(a => a.id === id);
  if (!archetype) throw new Error('Неизвестная колода');
  const theme = themes[id], lore = { state: archetype.state, organization: archetype.organization };
  const basicNames: Record<ArchetypeId,[string,string]> = {
    red:['Горные угодья Стального королевства','Steel Kingdom Mountain Holdings'],
    blue:['Воздушные причалы Талдрейка','Taldraik Sky Moorings'],
    green:['Лесные владения Кайров','House Kair Woodland Domain'],
    gold:['Королевский двор Ивелтина','Iveltin Royal Court'],
    violet:['Родовая крипта Ван Троупов','Van Troupe Ancestral Crypt'],
    neutral:['Опорный двор Ордена','Keepers Chapterhouse'],
  };
  const neutralNames: [string,string] = ['Страннический стан Ордена','Keepers Wayfarer Camp'];
  const domainSites: Record<ArchetypeId,string[]> = {
    red:['Кузня рубежа','Рудный двор'],blue:['Ветровой причал','Мастерская штурманов'],
    green:['Тропа Кайров','Сторожевой лес'],gold:['Двор рыцарей','Смотровая башня'],
    violet:['Реликтовый подвал','Мавзолей рода'],neutral:[
      'Полевой архив','Дозорная стоянка','Дом путников','Склад припасов','Караульный стан',
      'Скрипторий Ордена','Смотровой пост','Школа Хранителей','Палатка лекаря','Мастеровой двор','Зал совета'],
  };
  // Thirteen different sites, two copies each. General deck rules still permit
  // unlimited basic Domains; the preset itself keeps every card at two copies.
  const sites = id==='neutral'
    ? [basicNames[id][0],neutralNames[0],...domainSites.neutral]
    : [basicNames[id][0],...additionalNames[id],...domainSites[id]];
  const siteNamesEn = id==='neutral'
    ? [basicNames[id][1],neutralNames[1],...domainSites.neutral.map((_,i)=>`Keepers Site ${i+1}`)]
    : [basicNames[id][1],...additionalNamesEn[id],...domainSites[id].map((_,i)=>`${id} Outpost ${i+1}`)];
  const domains: Card[] = Array.from({length:26},(_,i):Card=>{
    const site=Math.floor(i/2), colored=id!=='neutral'||site===0;
    const name=sites[site];
    return {
      id: `${id}-domain-${site}`,
      name,nameEn:siteNamesEn[site],
      kind:'domain',basic:true,
      produces:colored?(id==='neutral'?'gold':id):'neutral',
      lore:{...lore,summary:`${name} обеспечивает ${archetype.organization} энергией и укрытием.`,
        note:'Название базового Владения — игровая адаптация лорной недвижимости, не утверждение о конкретной карте мира.'},
    };
  });
  const creatures = (entries: Unit[], copies: number[]) => entries.flatMap((entry,i) => Array.from({length:copies[i]},(): Card => ({
    id:identifier(id,entry.name),name:entry.name,kind:'creature',aspects:id==='neutral'?[]:[id],
    cost:cost(id,entry.cost),attack:entry.attack,health:entry.health,...entry.traits,lore:
      id==='violet'?{...lore,summary:`${entry.name} служит дому Ван Троупов в Искажении.`,note:entry.traits?.sacrifice
        ?'Слуга культа Ван Троупов: нежить, культ или реликтовая механика; игровая интерпретация.'
        :'Обитатель владений Ван Троупов; игровое имя, не подтверждённое в вики.'}:{...lore,summary:`${entry.name} выступает на стороне ${archetype.organization}.`},
  })));
  const plain = [...theme.plain,...extraPlain[id].map((name,i)=>({...theme.plain[i],name}))];
  const vanilla = creatures(plain, plain.map(()=>2));
  const effectUnits = [...theme.effects,...extraEffects[id]];
  const effects = creatures(effectUnits, effectUnits.map(()=>2));
  const legends: Card[] = theme.legends.map((name,i)=>({id:identifier(id,name),name,
    ...(id==='violet'?{nameEn:i===0?'Coldrake Shaw':'Cera Van Troupe'}:{}),
    kind:'legend',aspects:id==='neutral'?[]:[id],
    unique:true,cost:cost(id,5+i),loyalty:4+i,
    // Two exclusive choices per turn: modest +1 Loyalty, or the stronger -2 Loyalty power.
    // Keep loyaltyAbility for saved legacy matches and older clients.
    loyaltyAbilities:[
      {delta:1,kind:'healRuler',amount:1},
      id==='violet'
        ? i===0 ? {delta:-2,kind:'recoverCreature',amount:1} : {delta:-2,kind:'raiseSacrifice',amount:1}
        : i===0 ? {delta:-2,kind:'healRuler',amount:4} : {delta:-2,kind:'damageOpponent',amount:2}
    ] as NonNullable<Card['loyaltyAbilities']>,
    loyaltyAbility:id==='violet'
      ? i===0 ? {delta:-2,kind:'recoverCreature',amount:1} : {delta:-2,kind:'raiseSacrifice',amount:1}
      : i===0 ? {delta:-2,kind:'healRuler',amount:4} : {delta:-2,kind:'damageOpponent',amount:2},
    lore:id==='violet'?{...lore,summary:i===0?'Лич Колдрейк Шоу возвращает погибших слуг в строй.':'Цера Ван Троуп собирает ритуальную свиту умертвий.',note:i===0
      ?'Колдрейк Шоу — лич. Возвращает Существо из сброса в руку; игровая трактовка некромантии.'
      :'Цера Ван Троуп — девушка, умертвие-некромант дома Ван Троуп; создаёт ритуальную Жертву и даёт дополнительный добор при исполнении Ритуала.'}:{...lore,summary:`${name} ведёт ${archetype.organization} в сражении.`}}));
  const artifact: Card = {id:identifier(id,theme.item),name:theme.item,kind:'artifact',aspects:id==='neutral'?[]:[id],
    unique:true,cost:cost(id,3),auraAttack:1,lore:{...lore,summary:`${theme.item} укрепляет бойцов ${archetype.organization}.`}};
  const techniques: Card[] = id==='violet' ? Array.from({length:2},():Card=>({id:'vt-ritual',name:'Призыв забытой реликвии',kind:'technique',aspects:['violet'],
    cost:cost('violet',3),ritual:{color:'violet',threshold:3,duration:2,rewardPool:rewardPool()},lore:{...lore,summary:'Культ приносит Жертв ради реликвии из сокровищницы.'}})) : [];
  const spellNames: Record<ArchetypeId,string> = {red:'Залп горной стражи',blue:'Донесение флотилии',green:'Настой Кайров',gold:'Помощь госпитальеров',violet:'Возвращение из крипты',neutral:'Полевое снабжение'};
  const spellEffects: Record<ArchetypeId,NonNullable<Card['techniqueEffect']>> = {
    red:{kind:'damageOpponent',amount:2},blue:{kind:'draw',amount:2},green:{kind:'healRuler',amount:4},
    gold:{kind:'healRuler',amount:4},violet:{kind:'reanimate',amount:1},neutral:{kind:'draw',amount:2}};
  const spells:Card[]=Array.from({length:2},()=>({id:identifier(id,spellNames[id]),name:spellNames[id],
    kind:'technique',aspects:id==='neutral'?[]:[id],cost:cost(id,id==='violet'?5:3),techniqueEffect:spellEffects[id],
    lore:{...lore,summary:`${spellNames[id]} помогает ${archetype.organization} переломить ход боя.`}}));
  const utility: Partial<Record<ArchetypeId,{name:string;effect:NonNullable<Card['techniqueEffect']>}>> = {
    blue:{name:'Приказ тишины',effect:{kind:'silence',amount:1}},
    green:{name:'Очищение рощи',effect:{kind:'cleanse',amount:1}},
    gold:{name:'Приют госпитальеров',effect:{kind:'cleanse',amount:1}},
    violet:{name:'Печать оков',effect:{kind:'bind',amount:2}},
    neutral:{name:'Указ Хранителей',effect:{kind:'silence',amount:1}},
  };
  const utilityName=utility[id]?.name??spellNames[id]+' · Резервы';
  const finalSpell:Card = {id:identifier(id,utilityName),name:utilityName,
    kind:'technique',aspects:id==='neutral'?[]:[id],cost:cost(id,3),techniqueEffect:utility[id]?.effect??spellEffects[id],
    lore:{...lore,summary:`${utilityName} помогает ${archetype.organization} удержать инициативу.`}};
  const deck = [...domains,...vanilla,...effects,...techniques,...spells,finalSpell,...legends,artifact];
  const issues = validateDeck(deck);
  if (issues.length) throw new Error(`${id}: ${issues.join('; ')}`);
  return deck;
}


/** Optional domains in the combined card pool. Not included in ANY preset deck. */
const additionalNames: Record<Aspect, readonly string[]> = {
  red:['Кузня Стального рубежа','Рудные копи Стального королевства','Горная караулка','Укреплённая перевальная застава','Сталелитейный двор','Двор казарменного кузнеца','Башня горной стражи','Крепость серпантинного тракта','Железнорудное поместье','Приграничный форпост'],
  blue:['Аэродром Талдрейка','Швартовочная башня','Док воздушной флотилии','Каютный порт Талдрейка','Обсерватория штурманов','Ангар дирижаблей','Башня аэронавигации','Талдрейкская гавань','Маяк ветров','Высотная верфь'],
  green:['Суварская лесная усадьба','Зелёный сторожевой кордон','Охотничья сторожка Кайров','Лесопильный двор Сувара','Заповедная дубрава','Домик лесного травника','Суварский питомник','Стражевое урочище','Тропа пограничного дозора','Роща дома Кайров'],
  gold:['Ивелтинский дворец','Конюшня королевских рыцарей','Королевский караульный двор','Бастион золотого знамени','Внутренняя крепость Ивелтина','Часовня придворных рыцарей','Королевский монетный двор','Зал коронных аудиенций','Площадь рыцарского смотра','Приказной двор Ивелтина'],
  violet:['Крипта Ван Троупов','Подземная сокровищница Ван Троупов','Лаборатория Церы','Некромантская галерея','Артофакторная мастерская культа','Мавзолей семейных реликтов','Тайный алтарь Жертвы','Усадьба сумрачного рода','Погреб с реликтовыми печатями','Забытая оружейная сокровищницы'],
};
const additionalNamesEn: Record<Aspect, readonly string[]> = {
  red:['Steel Border Forge','Steel Kingdom Ore Mines','Mountain Guardhouse','Fortified Pass Outpost','Steel Foundry Yard','Garrison Smithy','Mountain Watchtower','Winding Pass Fortress','Iron Estate','Border Stronghold'],
  blue:['Taldraik Airfield','Mooring Tower','Air Fleet Dock','Taldraik Cabin Port','Navigator Observatory','Airship Hangar','Aero-Navigation Tower','Taldraik Harbor','Wind Lighthouse','High-Altitude Shipyard'],
  green:['Suvar Forest Estate','Green Ranger Post','Kair Hunting Lodge','Suvar Sawmill Yard','Protected Oak Grove','Herbalist Cottage','Suvar Nursery','Woodland Watch','Border Patrol Trail','Kair Grove'],
  gold:['Iveltin Palace','Royal Knight Stables','Royal Guard Court','Golden Banner Bastion','Iveltin Inner Keep','Knightly Chapel','Royal Mint','Crown Audience Hall','Knightly Parade Square','Iveltin Chancellery'],
  violet:['Van Troupe Crypt','Van Troupe Underground Treasury','Cera’s Laboratory','Necromantic Gallery','Cult Artifice Workshop','Family Relic Mausoleum','Hidden Sacrifice Altar','Gloomborne Manor','Relic-Sealed Cellar','Forgotten Treasury Armory'],
};
export const EXTRA_DOMAINS: readonly Card[] = (Object.keys(additionalNames) as Aspect[]).flatMap(color =>
  additionalNames[color].map((name,i):Card=>({
    id:'extra-domain-'+color+'-'+(i+1),name,nameEn:additionalNamesEn[color][i],
    kind:'domain',basic:false,produces:color,aspects:[color],
    lore:{state:ARCHETYPES.find(a=>a.id===color)!.state,organization:ARCHETYPES.find(a=>a.id===color)!.organization,
      summary:`${name} снабжает владетеля энергией ${color}.`,
      note:'Новое игровое название недвижимости для расширенного каталога; не заявлено каноническим объектом на карте мира.'},
  })));


