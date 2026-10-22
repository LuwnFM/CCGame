/** Derived deployment copies; edit web/ first, then run this script. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const sources=['layout-editor.css','style.css','design-variants.css','ui/layout-editor.js','ui/layout-preferences.js','ui/layout-preview.js'];
const relative=source=>source.replace(/(["'])\/(layout-editor\.html|layout-editor\.css|style\.css|design-variants\.css|ui-preview\.html|ui\/layout-editor\.js|ui\/layout-preview\.js|assets\/)/g,'$1./$2');
for(const directory of ['redactorstola','docs']){
 for(const file of sources){await mkdir(`${directory}/${file.split('/').slice(0,-1).join('/')}`,{recursive:true});await writeFile(`${directory}/${file}`,relative(await readFile(`web/${file}`,'utf8')))}
 const editor=relative(await readFile('web/layout-editor.html','utf8')).replace('<a href="/" class="quiet-link">Вернуться в игру</a>','<span class="quiet-link">Отдельный редактор · макет без сервера</span>');
 for(const file of ['index.html','layout-editor.html'])await writeFile(`${directory}/${file}`,editor);
 await writeFile(`${directory}/ui-preview.html`,relative(await readFile('web/ui-preview.html','utf8')));
}
console.log('Editor copies synced from web/');
