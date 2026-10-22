import {registerTrait,printedTrait} from '../trait-registry.ts';
/** firstStrike: independently registered, suppressible and attachable to any card data. */
registerTrait('firstStrike',printedTrait('firstStrike'));

import {type Permanent} from '../../model/index.ts';
import {ability} from '../abilities.ts';
/** First Strike is a strike-order mechanic, not a separate card-specific attack. */
export function strikeOrder(attacker:Permanent,defender:Permanent):'attacker'|'defender'|'simultaneous'{
 if(ability(attacker,'firstStrike')&&!ability(defender,'firstStrike'))return 'attacker';
 if(ability(defender,'firstStrike')&&!ability(attacker,'firstStrike'))return 'defender';
 return 'simultaneous';
}
