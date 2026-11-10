// Stable current IDs always select the new artwork. Previous artwork is opt-in in community builds.
export function selectAssetCatalog(current, legacy, distribution='community') {
 if(!['community','store'].includes(distribution))throw new Error('Unknown distribution: '+distribution);
 if(distribution==='store')return current;
 return [...current,...legacy.map(item=>({...item,id:item.id+'-legacy',name:item.name+'（旧版）',legacyOf:item.id}))];
}
