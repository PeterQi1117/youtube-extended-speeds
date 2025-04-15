// ==UserScript==
// @name         YouTube Custom Speeds Injector
// @description  Adds 2.5x and 3x speeds to YouTube's speed menu
// ==/UserScript==
(function () {
    const speedsToAdd = [2.5, 3];
    function findMenus(root = document) {
        let r = []; if (root.querySelectorAll) r = [...root.querySelectorAll('.ytp-panel-menu')];
        if (root.children) for (const el of root.children) if (el.shadowRoot) r.push(...findMenus(el.shadowRoot));
        return r;
    }
    function updateCheckmarks(menu, current) {
        menu.querySelectorAll('[data-custom-speed]').forEach(btn => {
            const speed = parseFloat(btn.querySelector('.ytp-menuitem-label').textContent);
            btn.setAttribute('aria-checked', speed === current ? 'true' : 'false');
        });
        menu.querySelectorAll('.ytp-menuitem').forEach(item => {
            const label = item.querySelector('.ytp-menuitem-label');
            if (!label) return;
            const speed = parseFloat(label.textContent);
            if (!isNaN(speed)) item.setAttribute('aria-checked', speed === current ? 'true' : 'false');
            else if (label.textContent.trim() === 'Normal') item.setAttribute('aria-checked', current === 1 ? 'true' : 'false');
        });
    }
    function addSpeeds(menu) {
        const video = document.querySelector('video');
        const current = video ? video.playbackRate : 1;
        if (!menu.querySelector('[data-custom-speed]')) {
            const items = [...menu.querySelectorAll('.ytp-menuitem')];
            const nums = items.filter(i => /^([0-9.]+|Normal)$/.test(i.querySelector('.ytp-menuitem-label')?.textContent.trim()));
            const last = nums.at(-1);
            [...speedsToAdd].reverse().forEach(speed => {
                if (items.some(i => i.querySelector('.ytp-menuitem-label')?.textContent.trim() == String(speed))) return;
                const btn = last.cloneNode(true);
                btn.setAttribute('data-custom-speed', speed);
                btn.querySelector('.ytp-menuitem-label').textContent = String(speed);
                btn.setAttribute('aria-checked', speed === current ? 'true' : 'false');
                const btnClone = btn.cloneNode(true);
                btnClone.addEventListener('click', () => {
                    document.querySelectorAll('video').forEach(v => v.playbackRate = speed);
                    setTimeout(() => {
                        updateCheckmarks(menu, speed);
                    }, 50);
                });
                last.parentNode.insertBefore(btnClone, last.nextSibling);
            });
        }
        updateCheckmarks(menu, current);
    }
    const observer = new MutationObserver(() => {
        const video = document.querySelector('video');
        const current = video ? video.playbackRate : 1;
        for (const menu of findMenus()) {
            const labels = [...menu.querySelectorAll('.ytp-menuitem-label')].map(l => l.textContent.trim());
            const nums = labels.filter(t => /^([0-9.]+|Normal)$/.test(t));
            if (nums.length >= 5 && nums.includes('2')) addSpeeds(menu);

            // Update the parent menu's "Playback speed" value
            menu.querySelectorAll('.ytp-menuitem').forEach(item => {
                const label = item.querySelector('.ytp-menuitem-label');
                const content = item.querySelector('.ytp-menuitem-content');
                if (label && content && label.textContent.trim() === 'Playback speed') {
                    const desired = current === 1 ? 'Normal' : current + '';
                    if (content.textContent !== desired) {
                        content.textContent = desired;
                    }
                }
            });
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();