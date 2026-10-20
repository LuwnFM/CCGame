// Full client localization: Russian remains the authoritative rule text.
const KEY='firewell_locale';
let language=localStorage.getItem(KEY)==='en'?'en':'ru';
const labels=[
['Войти в игру','Enter the game'],['Создай профиль с постоянным ID или войди под своим логином.','Create a permanent player ID or sign into your profile.'],
['Адрес игрового сервера','Game server address'],['Для локальной игры оставить пустым','Leave blank for local play'],
['Локально сервер и страница работают по одному адресу. Для клиента Vercel нужен HTTPS-адрес игрового сервера.','Locally the client and server share one address. Hosted clients require an HTTPS game-server address.'],
['Логин','Username'],['3–20 букв, цифр или _','3–20 letters, numbers or _'],['Пароль профиля','Account password'],
['Не менее 10 символов','At least 10 characters'],['Пароль доступа к альфе','Alpha access password'],
['Зарегистрироваться','Register'],['Войти','Sign in'],['Сменить логин','Change username'],['Выйти','Sign out'],
['Удалить профиль','Delete profile'],['Искать соперника','Find an opponent'],['Твоя колода','Your deck'],
['Начать поиск','Find a match'],['Отменить поиск','Cancel matchmaking'],['Матч по коду','Private room'],
['Создать комнату','Create room'],['Код комнаты','Room code'],['Войти по коду','Join room'],
['Общий чат','Global chat'],['Сообщение (до 500 символов)','Message (up to 500 characters)'],
['Загрузить ранние сообщения','Load older messages'],['Отправить','Send'],['Повторная отправка через','Send again in'],
['Мои колоды','My decks'],['Собирай из карт всех шести стартовых наборов: 70 карт и не меньше 26 Владений.','Build decks from all available cards: exactly 70 cards, at least 26 Domains.'],
['Открыть редактор колоды','Open deck builder'],['Ошибки, проблемы и идеи','Bugs, problems and ideas'],
['Категория','Category'],['Ошибка / баг','Bug report'],['Проблема с игрой','Gameplay issue'],
['Идея / улучшение','Idea / improvement'],['Краткий заголовок','Short title'],
['Что произошло или что улучшить?','What happened or what should be improved?'],
['Код матча (необязательно)','Match code (optional)'],['Например, A1B2C3D4','For example, A1B2C3D4'],
['Описание','Description'],['Опиши ситуацию, шаги воспроизведения, ожидаемый и фактический результат','Describe the issue, steps to reproduce, expected and actual results'],
['Отчёт привязывается к вашему постоянному ID и сохраняется на сервере.','Reports are linked to your permanent ID and saved on the server.'],
['Отправить обращение','Submit report'],['Мои обращения','My reports'],['Обновить','Refresh'],
['Редактор колоды','Deck builder'],['Начать с','Start from'],['Загрузить','Load'],
['Имя','Name'],['Моя колода','My deck'],['Сохранить','Save'],['Назад','Back'],
['Карты в колоде','Cards in deck'],['Все стартовые карты','All available cards'],['Найти карту','Find a card'],
['Все аспекты','All aspects'],['Красный','Red'],['Синий','Blue'],['Зелёный','Green'],
['Золотой','Gold'],['Фиолетовый','Violet'],['Нейтральный','Neutral'],
['В лобби','Back to lobby'],['Выборочный муллиган','Selective mulligan'],
['Отметь карты для замены или оставь руку.','Choose cards to replace or keep your opening hand.'],
['Подтвердить руку','Confirm hand'],['Ритуал Жертвы','Sacrifice Ritual'],
['Выбери источник и ровно N Жертв из обеих зон.','Choose a source and exactly N Sacrifices from both zones.'],
['Провести ритуал','Perform ritual'],['Награда','Reward'],
['Выбери одно из трёх предложений. При полном поле выбери заменяемое Существо.','Choose one of three rewards. If the field is full, choose a Creature to replace.'],
['Соперник','Opponent'],['Легенды','Legends'],['Основное поле · 8','Main field · 8'],
['Вспомогательное поле · 4','Auxiliary field · 4'],['Владения','Domains'],
['Рука','Hand'],['Атаковать Владетеля','Attack Ruler'],['Пропустить перехват','Skip intercept'],['Завершить ход','End turn'],
['В сети','Online'],['Не подключено','Disconnected'],['Альфа · дуэль 1×1','Alpha · 1v1 duel'],
['Готово','Ready'],['Истощено','Exhausted'],['Сохранено','Saved'],['Удалить','Delete'],
['Колода удалена','Deck deleted'],['Колода сохранена','Deck saved'],
[' · своя',' · custom'],[' карт',' cards'],['Владений','Domains'],['Колода ','Deck '],
[' · Рука ',' · Hand '],[' · Сброс ',' · Discard '],[' · Энергия ',' · Energy '],
['Ход ','Turn '],[' · игрок ',' · player '],['Комната ','Room '],
['Матч окончен: ','Match finished: '],['победил игрок ','winner: player '],['ничья','draw'],
['Ожидание соперника. Код комнаты: ','Waiting for opponent. Room code: '],
['Онлайн: ','Online: '],[' · в поиске: ',' · matchmaking: '],
['Поиск идёт. Подбираем другого игрока…','Searching for an opponent…'],
['Профиль готов','Account ready'],['Действие принято','Action accepted'],
['Рука','Hand'],['Владение','Domain'],['Существо','Creature'],['Техника','Technique'],['Легенда','Legend'],['Артофакт','Artifice'],
['Страж','Guard'],['Полёт','Flying'],['Первый удар','First Strike'],
['Пробивание','Piercing'],['Похищение жизни','Lifesteal'],['Отрава','Poison'],
['Натиск','Haste'],['Рвение','Zeal'],['Скрытность','Stealth'],['Щит','Shield'],
['Ошеломление','Stun'],['Стазис','Stasis'],['Ритуал','Ritual'],
['Жертва','Sacrifice'],['Величественный','Majestic'],['Уникальная','Unique'],
['Способность пока не работает','Ability not yet implemented'],
['Подсказки suggest (не изменяют колоду): ','Suggestions (do not modify your deck): '],
['критических предупреждений нет','no critical issues'],['Сервер проверит легальность при сохранении.','Server will validate legality on save.'],
['Владений меньше 26','Fewer than 26 Domains'],['для сохранения нужно ровно 70 карт','exactly 70 cards required'],
['нет базового цветного Владения','no basic colored Domain'],
['нет источника цвета ','no Energy source for color '],['мало источников цвета ','few sources of color '],
['высокая средняя стоимость ','high average cost '],['Вытеснить','Displace'],['Заменить','Replace'],
['Отмечено на замену: ','Selected for replacement: '],['Ответ принят. Ожидание соперника.','Choice accepted. Waiting for opponent.'],
['Способность Легенды недоступна','Legend ability unavailable'],['Не хватает цветной Энергии','Not enough colored Energy'],
['Не хватает Энергии','Not enough Energy'],['Не хватает Лояльности','Not enough Loyalty'],
['Устаревшая ревизия','Outdated match state'],['Войдите в профиль','Please sign in'],
['Неверный логин или пароль','Wrong username or password'],['Этот логин зарезервирован','Username is reserved'],
['Логин уже занят','Username is already taken'],['Комната недоступна','Room unavailable'],
['Не ваш ход','Not your turn'],['Сейчас нет выбора Ритуала','No available Ritual'],
['Неверная Жертва','Invalid Sacrifice'],['Неверное Существо','Invalid Creature'],
['Подождите ','Wait '],[' сек. перед следующим сообщением',' sec. before your next message'],
['Обращение №','Report #'],[' сохранено',' saved'],
['Для страницы HTTPS нужен HTTPS-адрес сервера','HTTPS pages require an HTTPS game server'],
['Укажи публичный HTTPS-адрес игрового сервера','Enter the public HTTPS game server URL'],
['Нужен пароль','A password is required'],['Нет свободного места для умертвия Жертвы','No slot for Sacrifice Revenant'],
['Выберите Существо из сброса для возвращения в руку','Choose a Creature in your discard to return to hand'],
['Колдрейк — выбери Существо для возвращения в руку:','Coldrake — choose a Creature to return to your hand:'],
['В сбросе нет Существ','No Creatures in discard'],
['Оставить уже находящуюся на поле Легенду?','Keep the current Legend?'],
['Выберите, какую Уникальную оставить','Choose which Unique to keep'],
['Выберите жалобу или предложение и напишите 10–2000 символов','Choose a report type and enter 10–2000 characters'],
['Правила игры','Game rules'],['Открыть правила','Game rules'],['Вернуться','Back']
];
const names=Object.fromEntries([
['Горный ополченец','Mountain Militiaman'],['Рудокоп стали','Steel Miner'],['Стрелок перевала','Pass Marksman'],['Кузнец заставы','Outpost Smith'],['Всадник хребта','Ridge Rider'],['Тяжёлый пехотинец','Heavy Infantryman'],
['Разведчик с перевала','Pass Scout'],['Рыцарь горной стражи','Mountain Guard Knight'],['Мастер первого удара','First Strike Master'],['Таранный всадник','Ram Rider'],['Пламенный авангард','Flame Vanguard'],['Капитан дозора','Watch Captain'],['Молотобоец королевства','Kingdom Hammerer'],['Двукратный натиск','Double Charge'],
['Командор стального рубежа','Steel Frontier Commander'],['Хранитель горного прохода','Mountain Pass Keeper'],['Знамя горной стражи','Mountain Guard Banner'],
['Матрос Талдрейка','Taldraik Sailor'],['Доковый плотник','Dock Carpenter'],['Курсант аэродрома','Airfield Cadet'],['Палубный дозорный','Deck Watchman'],['Штурманская команда','Navigator Crew'],['Бортовой ветеран','Airship Veteran'],
['Быстрый курьер','Swift Courier'],['Сторожевой дирижабль','Guard Airship'],['Воздушный перехватчик','Sky Interceptor'],['Тихий разведчик','Silent Scout'],['Штурмовой пилот','Assault Pilot'],['Капитан флотилии','Fleet Captain'],['Небесный налётчик','Sky Raider'],['Флагманский десант','Flagship Landing'],
['Адмирал талдрейкского неба','Admiral of Taldraik Skies'],['Мастер воздушных путей','Master of Air Routes'],['Навигационный кристалл флотилии','Fleet Navigation Crystal'],
['Суварский следопыт','Suvar Tracker'],['Лесной подмастерье','Forest Apprentice'],['Страж тропы','Trail Sentinel'],['Садовый зверь','Garden Beast'],['Суварский охотник','Suvar Hunter'],['Древесный исполин','Arboreal Colossus'],
['Живучий зверёк','Resilient Beastling'],['Защитник чащи','Thicket Defender'],['Хищник Сувара','Suvar Predator'],['Целитель рощи','Grove Healer'],['Лесная дозорная','Forest Ranger'],['Корневой бастион','Root Bastion'],['Дикий оплот','Wild Bulwark'],['Страж зелёного рубежа','Green Frontier Guardian'],
['Старейшина рода Кайров','Elder of House Kair'],['Защитница суварских рощ','Guardian of Suvar Groves'],['Знамя дома Кайров','House Kair Banner'],
['Ивелтинский рекрут','Iveltin Recruit'],['Оруженосец короны','Crown Squire'],['Городской дозорный','City Watchman'],['Пехотинец Ивелтина','Iveltin Infantryman'],['Конный рыцарь','Mounted Knight'],['Королевский ветеран','Royal Veteran'],
['Рыцарь авангарда','Vanguard Knight'],['Дворцовый страж','Palace Guard'],['Медик короны','Crown Medic'],['Рыцарь щита','Shield Knight'],['Знаменосец Ивелтина','Iveltin Standard-Bearer'],['Судья поединка','Duel Arbiter'],['Кавалер ордена','Order Cavalier'],['Королевская гвардия','Royal Guard'],
['Артур II вир Ивелтин','Arthur II vir Iveltin'],['Андриан аур Медлир','Andrian aur Medlir'],['Штандарт королевских рыцарей','Royal Knights Standard'],
['Искатель сокровищницы','Vault Seeker'],['Подручный Ван Троупов','Van Troupe Acolyte'],['Сторож подвала','Cellar Watchman'],['Шифровальщик реликвий','Relic Cryptographer'],['Сборщик механизмов','Mechanism Assembler'],['Хранитель тайника','Secret Vault Keeper'],
['Зовущий забытых','Summoner of the Forgotten'],['Призрачный агент','Spectral Agent'],['Хранитель неисправностей','Keeper of Malfunctions'],['Разведчик искажения','Distortion Scout'],['Оператор механизмов','Mechanism Operator'],['Вестник Шоу','Shaw’s Herald'],['Страж забытого архива','Forgotten Archive Guardian'],
['Колдрейк Шоу','Coldrake Shaw'],['Цера Ван Троуп','Cera Van Troupe'],['Драгнир и Иммельсторн','Dragnir and Immelstorn'],['Призыв забытой реликвии','Call of the Forgotten Relic'],
['Дворянский призрак Ван Троупов','Van Troupe Noble Ghost'],['Некроартофакт Ван Троупов','Van Troupe Necro-Artifice'],['Реликтовый страж Ван Троупов','Van Troupe Relic Sentinel'],['Умертвие родовой крипты','Ancestral Crypt Revenant'],['Искра фамильной сокровищницы','Family Vault Spark'],['Умертвие свиты Церы','Cera’s Undead Retainer'],
['Послушник Ордена','Order Novice'],['Дозорный Ордена','Order Watchman'],['Писарь утремера','Utremere Scribe'],['Странствующий хранитель','Wandering Keeper'],['Мастеровой Ордена','Order Artisan'],['Ветеран Хранителей','Veteran of the Keepers'],
['Быстрый разведчик','Fast Scout'],['Страж утремера','Utremere Guard'],['Инквизитор дозора','Watch Inquisitor'],['Полевой лекарь','Field Healer'],['Рыцарь знамени','Banner Knight'],['Страж архивов','Archive Sentinel'],['Мастер перехвата','Interception Master'],['Ветеран новых хранителей','New Keepers Veteran'],
['Верховный хранитель Данте','High Keeper Dante'],['Мейстер Глерторул','Maester Glertorul'],['Полевое знамя Ордена','Order Field Banner']
]);
const archetypes={red:'Steel Kingdom · Mountain Guard',blue:'Taldraik · Air Fleet',
 green:'Suvar · House Kair',gold:'Iveltin · Royal Knights',violet:'Distortion · Van Troupe Treasury',
 neutral:'Order of Keepers · New Keepers'};
const direct=new Map(labels), sorted=[...direct].sort((a,b)=>b[0].length-a[0].length);
export function locale(){return language}
export function setLocale(value){language=value==='en'?'en':'ru';localStorage.setItem(KEY,language);document.documentElement.lang=language;}
export function cardName(c){
 if(language==='ru')return c.name;
 if(c.nameEn)return c.nameEn;
 if(c.kind==='domain'&&c.basic)return (c.produces==='neutral'?'Neutral Domain':'Basic Domain')+' · '+(c.produces||'neutral');
 return names[c.name]||c.name;
}
export function archetypeName(a){return language==='en'?(archetypes[a.id]||a.name):a.name;}
export function translate(value){
 if(language==='ru'||typeof value!=='string')return value;
 if(names[value])return names[value];
 if(direct.has(value))return direct.get(value);
 let out=value;
 for(const [ru,en] of sorted)if(out.includes(ru))out=out.replaceAll(ru,en);
 return out;
}
const originals=new WeakMap(),applied=new WeakMap(),attributes=new WeakMap();
export function localize(){
 document.documentElement.lang=language;
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 let node;
 while((node=walker.nextNode())){
  const parent=node.parentElement;
  if(!parent||parent.closest('script,style,.message,#profileName,#profileId,.user-value'))continue;
  const current=node.textContent||'';
  if(current!==applied.get(node))originals.set(node,current);
  const base=originals.get(node)||'';
  const next=language==='en'?translate(base):base;
  if(next!==current){applied.set(node,next);node.textContent=next;}
 }
 for(const el of document.querySelectorAll('[placeholder],[title]')){
  for(const attr of ['placeholder','title']){
   if(!el.hasAttribute(attr))continue;
   let state=attributes.get(el);if(!state){state={};attributes.set(el,state);}
   const current=el.getAttribute(attr);
   if(!(attr in state))state[attr]=current;
   const next=language==='en'?translate(state[attr]):state[attr];
   if(next!==current)el.setAttribute(attr,next);
  }
 }
 const toggle=document.getElementById('languageToggle');if(toggle)toggle.textContent=language==='en'?'RU':'EN';
}
let queued=false;
export function observeLocalization(){
 const obs=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;localize();})});
 obs.observe(document.body,{subtree:true,childList:true,characterData:true});
 localize();return obs;
}
export const translatedCardNames=names;
