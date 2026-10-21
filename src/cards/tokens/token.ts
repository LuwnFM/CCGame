import type {Card} from '../../core.ts';
/** Reusable token constructor. Definition, abilities and lore belong to individual token modules. */
export function token(id:string,name:string,attack:number,health:number,aspects:Card['aspects'],traits:Partial<Card>={}):Card{
 return {id,name,kind:'creature',aspects,attack,health,createdToken:true,...traits,
 lore:{state:'Игровой призыв',organization:'Призванные существа',
 summary:'Призванное существо создаётся общим эффектом Призыв и стирается вместо Сброса.'}};
}
