import { locale } from './i18n.js';
// Player-facing rules are based on the current gameplay kernel and the starter catalog.
const content = {
  "ru": [
    ["Предметы и восстановление", "Предметы занимают вспомогательную зону. Их эффекты начала вашего хода срабатывают до обычного добора; Немота и Стазис отключают их. Общий Щит доводит текущий Щит Существ до указанного значения, а не складывается каждый ход. Лечение Существ убирает ранения без увеличения здоровья. Лечение Владетеля и Похищение жизни восстанавливают HP до 40 и никогда не уменьшают уже имеющиеся HP."],
    [
      "Цель игры и здоровье",
      "Два Владетеля начинают матч с 40 HP. Побеждает игрок, оставшийся в игре после снижения HP противника до нуля или меньше; одновременная гибель обоих — ничья. Начальные 40 HP относятся к новым матчам."
    ],
    [
      "Колода и начало матча",
      "В колоде ровно 70 карт: не менее 26 Владений и хотя бы одно базовое цветное Владение. Цвета можно сочетать. Не более трёх разных Легенд. Уникальная карта и каждая Легенда — максимум одна копия по названию, прочие небазовые — до трёх, базовые Владения без ограничения. Игроки берут по семь карт; если в руке нет Владения, гарантируется базовое цветное. Один раз можно выборочно заменить карты (муллиган). Первый игрок в свой первый ход карту не добирает."
    ],
    [
      "Ход, ресурсы и добор",
      "В начале своего хода восстанавливаются истощённые Владения и Существа, обнуляется число атак за ход, добирается карта, обрабатываются статусы и доступные Ритуалы. За ход можно сыграть одно Владение, разыгрывать карты, использовать Легенд, Владетеля и атаки, затем завершить ход. Владение истощается и создаёт одну Энергию своего цвета; обязательную цветную часть стоимости нельзя оплатить другим цветом, общую можно оплатить любой Энергией. Энергия в конце хода исчезает. При руке больше восьми карт нужно сбросить лишние."
    ],
    [
      "Зоны и типы карт",
      "Основная зона: максимум восемь обычных Существ. Вспомогательная зона: максимум четыре токена и Артефакта вместе. Владения, Легенды, рука, колода, Сброс и стёртые карты — отдельные зоны. Существо сражается, Техника разрешает свой эффект, Артефакт даёт свойства, Легенда использует Лояльность. Рука противника скрыта; токены и ритуальные награды стираются вместо попадания в Сброс."
    ],
    [
      "Как объявлять атаку",
      "В основную фазу выберите готовое Существо и цель: Владетель противника, доступное Существо или Легенда. Атаки идут по одной, не общей пачкой. Обычное Существо не атакует в ход появления, атакует не более одного раза за собственный ход и истощается при атаке. Истощённое Существо не может перехватывать до восстановления готовности в начале следующего своего хода."
    ],
    [
      "Перехват и расчёт боя",
      "После каждой атаки защищающийся может выбрать одного готового подходящего перехватчика или принять удар. Только Страж может перехватывать атаку, изначально направленную на дружественное Существо; атакующего с Полётом может перехватить только Существо с Полётом. Один перехватчик используется не больше одного раза за ход противника. Без перехвата урон получает выбранная цель. При столкновении Существа обычно одновременно наносят урон друг другу. Полученный урон сохраняется; при уроне не меньше здоровья Существо погибает. Первый удар изменяет порядок нанесения урона."
    ],
    [
      "Мгновенная атака и Рвение",
      "**Мгновенная атака** (haste): Существо может атаковать уже в ход выхода, включая Владетеля и Легенду. **Рвение** (zeal): Существо может атаковать в ход выхода только вражеское Существо; не разрешает немедленную атаку по Владетелю. Это разные свойства и не заменяют друг друга."
    ],
    [
      "Неутомимость и Ещё удар!",
      "**Неутомимость** (untiring): при объявлении атаки Существо остаётся готовым и может потом перехватывать, если не истощено другим эффектом; сама по себе не даёт вторую атаку. **Ещё удар! (N)** (extraAttacks): допускает до N дополнительных самостоятельных атак за свой ход. Для каждой отдельной атаки выбирается цель и может назначаться новый перехватчик. Лимит — 1+N атак за ход даже при Неутомимости. Это НЕ «Двойной удар» MTG с двумя этапами урона в одной схватке."
    ],
    [
      "Страж, Полёт и Скрытность",
      "**Страж** (guard) может защищать другого союзного Существа от прямой атаки. **Полёт** (flying) не даёт наземным Существам перехватывать атакующего с Полётом; летающий защитник может перехватывать наземных. **Скрытность** (stealth) запрещает выбирать Существо прямой целью атаки, но не делает его бессмертным и не отменяет массовый урон."
    ],
    [
      "Первый удар, Пробивание и Похищение жизни",
      "**Первый удар** (firstStrike): если только один участник столкновения имеет свойство, он наносит удар первым; уничтоженный противник не отвечает. Если свойство есть у обоих либо ни у кого, обычный урон одновременен. **Пробивание** (piercing): при перехвате избыток урона после поглощения Щитом и оставшегося здоровья перехватчика проходит к первоначальной цели; не создаёт второй атаки. **Похищение жизни** (lifesteal): восстанавливает HP своего Владетеля по фактически нанесённому урону."
    ],
    [
      "Щит, Аура атаки, запрет атаки",
      "**Щит (N)** (shield) сначала поглощает до N единиц полученного урона и расходуется. **Аура атаки (N)** (auraAttack) усиливает атаку союзных Существ, пока действует её источник. **Не может атаковать** (cannotAttack) запрещает объявлять атаку, но не исключает допустимый перехват готовым Существом. **Немота подавляет этот запрет**, поэтому готовое Существо может атаковать, если выполнены остальные условия (ход выхода, истощение, Ошеломление, Стазис и лимит атак). **Величественный** (majestic) нельзя выбрать целью прицельной Техники или способности (в том числе союзной), а также вытеснить с заполненного поля или принести в ритуальную Жертву. Прямые атаки Существ по Величественному разрешены, эффекты при нанесении боевого урона (например, Отрава) действуют. Массовые эффекты, распространяющиеся на всех Существ, включая общий урон, также действуют. Случайный урон без ручного выбора цели тоже может попасть по Величественному."
    ],
    [
      "Отрава, Ошеломление, Стазис и Немота",
      "**Отрава при попадании** (poisonHit) накладывает на цель периодический урон указанной силы и длительности при нанесении хотя бы 1 единицы боевого урона (полностью поглощённый Щитом удар не отравляет); новое наложение учитывает более сильную или продолжительную Отраву по правилам движка. **Ошеломление** (stun) запрещает Существу атаковать, но готовое Существо может перехватывать. **Стазис** (stasis) временно блокирует действия и свойства Существа и приостанавливает ход Отравы, которая продолжится после прекращения Стазиса. **Немота** (silence) подавляет свойства и способности, в том числе соответствующие предсмертные эффекты."
    ],
    [
      "Вступление, Второй шанс, Последнее слово",
      "**Вступление** (onEntry) срабатывает при обычном розыгрыше Существа из руки. **Второй шанс** (secondChance) — при возвращении из Сброса сразу на поле, но не при возвращении в руку. **Последнее слово** (onDeath) срабатывает при гибели Существа, кроме случаев подавления или простого вытеснения без смерти. Возможные эффекты включают добор карт, призыв, урон, лечение и воздействие на Существа."
    ],
    [
      "Техники и направленные эффекты",
      "Техники могут наносить урон Владетелю, лечить, добирать карты, воскрешать Существ из Сброса, очищать отрицательные статусы, накладывать Немоту или Сковывание и выполнять другие явно напечатанные действия. Если эффект требует цель, её выбирают при розыгрыше; недопустимую цель выбрать нельзя. **Очищение** снимает негативные статусы; **Сковывание** ограничивает действие цели. Не вся потенциальная механика из реестра уже назначена карте: считайте рабочими только способности, реально указанные на карте."
    ],
    [
      "Легенды и Лояльность",
      "Легенды находятся в отдельной зоне и вместо здоровья используют Лояльность. Каждая стартовая Легенда имеет два выбора: первый даёт +1 Лояльность и небольшой эффект, второй тратит указанное на карте количество Лояльности ради более сильного эффекта. Можно использовать одну способность каждой Легенды за свой ход, включая ход выхода. При нуле Лояльности Легенда уходит; одноимённые Уникальные Легенды требуют выбрать, какая останется. Легенда может быть целью атаки и теряет Лояльность от урона по правилам боя."
    ],
    [
      "Способность Владетеля",
      "Раз в собственный основной ход Владетель может потратить 2 HP, чтобы взять две карты. Условия: в руке не более трёх карт, в колоде минимум две карты, после оплаты останется минимум 1 HP. Способность доступна всем цветам."
    ],
    [
      "Жертва и Ритуал",
      "**Жертва** (sacrifice) — отметка Существа, которое можно использовать в Ритуале. При готовом Ритуале и достаточном числе подходящих Жертв игрок выбирает требуемое количество из основной и вспомогательной зон. Выбранные Существа погибают с последствиями смерти. Затем показываются три разные награды из пула пяти — игрок получает одну выбранную. Обычная награда размещается в основной зоне, награда-токен — во вспомогательной. Награды и токены стираются вместо Сброса; другие эффекты могут отдельно давать бонус за Ритуал."
    ],
    [
      "Уникальность и заполнение поля",
      "Если вводится второй одноимённый Уникальный объект, игрок явно выбирает, какой сохранить. Заполненное основное поле при ритуальной награде может потребовать заменить допустимое Существо, причём такая замена считается смертью. Во вспомогательной зоне вытеснение допустимого объекта не считается смертью. Величественных нельзя вытеснять. Если награду нельзя разместить из-за отсутствия допустимой замены, применяется резервная выдача награды в руку по правилам Ритуала."
    ],
    [
      "Особенности цветовых колод",
      "**Красный — Стальное королевство / Горная стража:** быстрые атаки, Мгновенная атака, Рвение, Пробивание, Первый удар, «Ещё удар!», прямой урон и аура атаки. Рвение и Пробивание распределены между разными существами. **Синий — Талдрейк / Воздушная флотилия:** Полёт, контроль темпа, Ошеломление и отдельные Существа с «Ещё удар!». **Зелёный — Сувар / Дом Кайров:** живучие Существа, Страж, Щиты, лечение и усиление устойчивости. **Золотой — Ивелтин / Королевские рыцари:** Страж, Щиты, защита и поддержка; некоторые защитники обладают Неутомимостью. **Фиолетовый — Ван Троупы / Искажение:** Жертвы, Ритуалы, призыв, возвращение и награды. **Нейтральный — Орден Хранителей:** медленный контроль, защитные Существа и Величественные; без прямого урона. Некоторые эффекты усиливаются при отсутствии цветных карт в указанной зоне. Для исходной колоды учитывается состав до первого добора; для руки — карты после розыгрыша; для поля — ваши Существа, Предметы и Легенды, включая цветные токены. Владения не учитываются; Немота не меняет цвет. Без условия действует базовый эффект. Это стили стартовых колод, а не запреты смешивать цвета."
    ],
    [
      "Пока не введённые механики",
      "**Магомутация** обсуждается как будущая способность выбора улучшений Существа, но в движке пока не реализована. **Двойной удар** в смысле MTG отсутствует: «Ещё удар!» — отдельные атаки. Неработающие или ещё не назначенные картам концепции не следует считать доступными. Для конкретной карты числовые параметры всегда определяются её актуальным текстом."
    ]
  ],
  "en": [
    ["Items and healing", "Items occupy the auxiliary zone. Start-of-turn effects resolve before the normal draw; Silence and Stasis disable them. Team Shield raises current Creature shields to the printed floor without stacking. Mending removes damage without raising maximum Health. Ruler healing and Lifesteal restore up to 40 HP and never lower existing HP."],
    [
      "Victory and starting Health",
      "Two Rulers start at 40 HP each. A Ruler at zero HP or lower loses; simultaneous defeats are draws. Existing saved games retain their recorded state."
    ],
    [
      "Deck construction and opening",
      "Exactly 70 cards with at least 26 Domains and one basic colored Domain. You may mix colors. Up to three distinct Legends. Unique cards and Legends: one copy per name; other nonbasic cards: up to three; basic Domains are unlimited. Both players draw seven cards, with a guaranteed basic colored Domain if the hand has none. One selective mulligan is allowed; the first player skips their first normal draw."
    ],
    [
      "Turn and resources",
      "Ready your exhausted Domains and Creatures, reset the turn's attack counters, draw a card, process statuses and ready Rituals. Play up to one Domain per turn, use Energy to play cards and activate abilities and attacks, then end the turn. Each exhausted Domain produces one Energy of its color; colored requirements must match, generic costs accept any Energy. Unspent Energy clears at turn end; discard down to eight cards if necessary."
    ],
    [
      "Zones and card types",
      "Main zone: eight normal Creatures maximum. Auxiliary zone: four tokens or Artifacts total. Domains and Legends use separate zones. The hand, deck, discard and erased cards are distinct. Creatures fight; Techniques resolve their effect; Artifacts grant abilities; Legends use Loyalty. Opponent hands are hidden. Tokens and Ritual rewards are erased instead of entering discard."
    ],
    [
      "Declaring attacks",
      "During your main phase select a ready Creature and an eligible target: enemy Ruler, Creature or Legend. Attacks are declared one at a time. Normally a Creature cannot attack on its entry turn, attacks once per own turn and exhausts when attacking. Exhausted Creatures cannot intercept until readied on the next own turn."
    ],
    [
      "Interception and combat",
      "After each attack the defender may designate one ready, legal interceptor or accept the hit. Only Guard can intercept an attack directed at an allied Creature. A Flying attacker can be intercepted only by Flying. Each Creature intercepts at most once per opposing turn. Without interception damage hits the original target. Creature combat usually deals simultaneous damage; damage persists and lethal damage destroys a Creature. First Strike changes damage order."
    ],
    [
      "Haste and Zeal",
      "Haste enables a Creature to attack any legal target on the turn it enters. Zeal enables attacking an enemy Creature only on entry, not the opposing Ruler. These are distinct traits."
    ],
    [
      "Untiring and Extra Attack",
      "Untiring lets a Creature attack without becoming exhausted, so it can later intercept if otherwise eligible. It does not grant another attack. Extra Attack (N) permits N additional separately declared attacks per own turn with fresh target and interception decisions. Even with Untiring the limit is 1+N. This differs from MTG's Double Strike, which makes two damage steps within one combat."
    ],
    [
      "Guard, Flying and Stealth",
      "Guard may intercept attacks aimed at allied Creatures. Flying attackers can only be intercepted by Flying units; Flying defenders may block ground attacks. Stealth prevents being directly selected as an attack target but does not prevent damage from other effects."
    ],
    [
      "First Strike, Piercing and Lifesteal",
      "First Strike strikes before retaliation if only one participant has it; otherwise damage is simultaneous. Piercing carries intercepted excess damage past Shield and remaining Health to the originally selected target; it does not grant a second attack. Lifesteal heals the controller's Ruler according to damage actually dealt."
    ],
    [
      "Shield, Attack Aura and attack limits",
      "Shield (N) absorbs N incoming damage first and is depleted. Attack Aura (N) adds attack to allied Creatures while its source is active. Cannot Attack prevents declaring attacks but not otherwise legal interceptions. Silence suppresses Cannot Attack, allowing an otherwise ready Creature to attack if all normal conditions are met. Majestic cannot be manually selected as the target of an individual Technique or ability, whether allied or enemy, and cannot be displaced from a full zone or used as a Ritual sacrifice. Creature attacks, on-hit effects, damage to all Creatures and randomly assigned damage without manual target selection still affect Majestic."
    ],
    [
      "Poison, Stun, Stasis and Silence",
      "Poison on Hit applies damage over time when a combat strike deals at least 1 damage (fully shielded strikes do not poison), with printed strength and duration; new applications use stronger or longer compatible values. Stun prevents attacking but may leave a ready unit available to intercept. Stasis stops actions and suppresses traits while pausing Poison; Poison resumes afterwards. Silence suppresses card traits and relevant triggered abilities."
    ],
    [
      "Entry, Second Chance and Last Word",
      "Entry triggers when played from hand. Second Chance triggers when returning from discard directly onto the field, not merely to hand. Last Word triggers on death unless suppressed; displacement without death does not trigger it. Printed effects can summon, draw, deal damage, heal and interact with Creatures."
    ],
    [
      "Techniques and targeted effects",
      "Techniques can deal damage, heal, draw cards, revive Creatures, Cleanse harmful statuses, Silence, Bind or perform other printed actions. A targeted Technique requires an eligible target. Cleanse removes negative statuses; Bind restricts a target. Not every registered possible effect is currently present on playable cards."
    ],
    [
      "Legends and Loyalty",
      "Legends have their own zone and Loyalty instead of Health. Each starter Legend has two choices: a modest +1 Loyalty ability and a stronger ability with its printed Loyalty cost. Each Legend can activate one ability per own turn, including its entry turn. At zero Loyalty it leaves play; duplicate-name Unique Legends require a survivor choice. Attacks can target Legends and reduce Loyalty."
    ],
    [
      "Ruler draw ability",
      "Once per own main phase, pay 2 HP to draw two cards. Your hand must contain at most three cards, deck at least two cards, and HP must remain at least one after payment. All colors have this ability."
    ],
    [
      "Sacrifice and Ritual",
      "Sacrifice marks eligible ritual participants. With a ready Ritual and enough units, choose the required number from main and auxiliary zones. They die with ordinary death consequences. Three distinct rewards out of a pool of five are offered; select one. Normal rewards go to main, reward tokens to auxiliary. Ritual rewards and tokens are erased instead of discarded. Other abilities may grant extra ritual bonuses."
    ],
    [
      "Unique cards and full fields",
      "Duplicate-name Unique permanents require an explicit choice of survivor. Placing a Ritual reward into a full main zone may require replacing an eligible Creature, which counts as death. Auxiliary displacement does not count as death. Majestic cannot be displaced. If no replacement is legal, the Ritual has a fallback reward-to-hand route."
    ],
    [
      "Color archetypes",
      "Red (Steel Kingdom / Mountain Guard): aggression, Haste, Zeal, Piercing, First Strike, Extra Attack, direct damage and Attack Aura; Zeal and Piercing sit on different Creatures. Blue (Taldreik / Air Flotilla): Flying, Stun, tempo control and Extra Attack. Green (Suvar / Kayr house): resilient Creatures, Guard, Shield and healing. Gold (Iveltin / Royal Knights): Guard, Shield, support and some Untiring defenders. Violet (Van Troupe / Distortion): Sacrifice, Rituals, summon, recovery and rewards. Neutral (Keepers' Order): slow control, defensive Majestic Creatures, no direct damage. Conditional bonuses check the original deck, hand after play, or your battlefield (including colored tokens). Domains are exempt; Silence does not remove color. Base effects work without the bonus. These describe starter playstyles; deck building can mix colors."
    ],
    [
      "Not yet implemented",
      "Magomutation, a proposed Creature improvement choice, is not yet implemented. MTG-style Double Strike is not currently a separate mechanic. Unimplemented concepts are not playable effects; each card's current text specifies its numeric parameters."
    ]
  ]
};
export function renderPublicRules(){
 const root=document.getElementById('rulesContent');
 const toc=document.getElementById('rulesToc');if(toc)toc.replaceChildren();
 root.replaceChildren(...content[locale()].map(([name,body],i)=>{
  const part=document.createElement('section');part.className='rule-section';part.id='rule-'+i;
  if(toc){const link=document.createElement('a');link.href='#'+part.id;link.textContent=name;toc.append(link)}
  const title=document.createElement('h2');title.textContent=(i+1)+'. '+name;
  const text=document.createElement('p');text.textContent=body.replace(/\*\*/g,'');
  part.append(title,text);return part;
 }));
}
