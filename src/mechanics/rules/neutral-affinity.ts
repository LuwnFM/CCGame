import type {Card,Player} from '../../model/index.ts';
/** Domains never count as colored cards. Deck means the original list, not the remaining pile. */
export function neutralAffinityActive(owner:Player,source:Card):boolean {
 const zone=source.neutralAffinity?.zone;
 const colored=(card:Card)=>card.kind!=='domain'&&!!card.aspects?.length;
 if(zone==='deck')return owner.startingDeckHasColored===false;
 if(zone==='hand')return !owner.hand.some(colored);
 if(zone==='battlefield')return ![...owner.main,...owner.auxiliary,...owner.legends].some(p=>colored(p.card));
 return false;
}
