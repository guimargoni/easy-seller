chrome.runtime.onMessage.addListener((message: {type?:string;payload?:unknown},_sender,sendResponse)=>{
  if(message.type==="SAVE_PRODUCT"){
    chrome.storage.local.get({savedProducts:[]},({savedProducts}:{savedProducts:unknown[]})=>{
      chrome.storage.local.set({savedProducts:[...savedProducts,message.payload]},()=>sendResponse({ok:true}));
    });
    return true;
  }
  return false;
});
