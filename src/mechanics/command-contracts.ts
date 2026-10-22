import type {PlayerId} from '../model/index.ts';
/** Open map: mechanics modules can augment command payloads without changing core.ts.
 * All commands retain the same transactional revision/idempotency/security checks.
 */
export interface CommandPayloads {
  mulligan:{indices:number[]};
  startTurn:{};
  playDomain:{handIndex:number};
  tapDomain:{objectId:number};
  playCreature:{handIndex:number;targetId?:number;replaceId?:number;keepExisting?:boolean;domainIds?:number[]};
  playTechnique:{handIndex:number;targetId?:number;discardIndex?:number;domainIds?:number[]};
  rulerDraw:{};
  playLegend:{handIndex:number;keepExisting?:boolean;domainIds?:number[]};
  activateLegend:{objectId:number;discardIndex?:number;abilityIndex?:number};
  playArtifact:{handIndex:number;replaceId?:number;keepExisting?:boolean;domainIds?:number[]};
  chooseRitual:{effectId:string;objectIds:number[]};
  chooseReward:{rewardId:string;replaceId?:number;keepExisting?:boolean;domainIds?:number[]};
  attack:{attackerId:number;target:{kind:'player'}|{kind:'creature'|'legend';objectId:number}};
  intercept:{interceptorId:number|null};
  endTurn:{};
  surrender:{};
  discard:{handIndex:number};
}
export type Command={ [K in keyof CommandPayloads & string]:
  {type:K;actor:PlayerId;expectedRevision:number;key:string}&CommandPayloads[K]
}[keyof CommandPayloads & string];
