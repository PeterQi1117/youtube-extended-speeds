// ==UserScript==
// @name         YouTube Custom Speeds Injector
// @description  Adds 2.5x and 3x speeds to YouTube's speed menu
// ==/UserScript==
(function () {
    const speedsToAdd = [2.5, 3];
    function findMenus(root=document){
        let r=[];if(root.querySelectorAll)r=[...root.querySelectorAll('.ytp-panel-menu')];
        if(root.children)for(const el of root.children)if(el.shadowRoot)r.push(...findMenus(el.shadowRoot));
        return r;
    }
    function addSpeeds(menu){
        if(menu.querySelector('[data-custom-speed]'))return;
        const items=[...menu.querySelectorAll('.ytp-menuitem')];
        const nums=items.filter(i=>/^([0-9.]+|Normal)$/.test(i.querySelector('.ytp-menuitem-label')?.textContent.trim()));
        const last=nums.at(-1);
        [...speedsToAdd].reverse().forEach(speed=>{
            if(items.some(i=>i.querySelector('.ytp-menuitem-label')?.textContent.trim()==String(speed)))return;
            const btn=last.cloneNode(true);
            btn.setAttribute('data-custom-speed',speed);
            btn.querySelector('.ytp-menuitem-label').textContent=String(speed);
            btn.setAttribute('aria-checked','false');
            const btnClone=btn.cloneNode(true);
            btnClone.addEventListener('click',()=>{
                document.querySelectorAll('video').forEach(v=>v.playbackRate=speed);
                menu.querySelectorAll('.ytp-menuitem').forEach(b=>b.setAttribute('aria-checked','false'));
                btnClone.setAttribute('aria-checked','true');
            });
            last.parentNode.insertBefore(btnClone,last.nextSibling);
        });
    }
    const observer=new MutationObserver(()=>{
        for(const menu of findMenus()){
            const labels=[...menu.querySelectorAll('.ytp-menuitem-label')].map(l=>l.textContent.trim());
            const nums=labels.filter(t=>/^([0-9.]+|Normal)$/.test(t));
            if(nums.length>=5&&nums.includes('2'))addSpeeds(menu);
        }
    });
    observer.observe(document.body,{childList:true,subtree:true});
    for(const menu of findMenus()){
        const labels=[...menu.querySelectorAll('.ytp-menuitem-label')].map(l=>l.textContent.trim());
        const nums=labels.filter(t=>/^([0-9.]+|Normal)$/.test(t));
        if(nums.length>=5&&nums.includes('2'))addSpeeds(menu);
    }
})();