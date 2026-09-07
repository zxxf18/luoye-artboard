export function createCloseFlow({hasChanges,ask,save,discard}) {
  let pending;
  return function requestClose(){
    if(pending)return pending;
    pending=(async()=>{
      if(!hasChanges())return {action:'exit'};
      const choice=await ask();
      if(choice==='save')return {action:'save',payload:await save()};
      if(choice==='discard'){await discard();return {action:'exit'};}
      return {action:'cancel'};
    })().finally(()=>{pending=undefined;});
    return pending;
  };
}
