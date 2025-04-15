// Adds 2.5x and 3x speeds to YouTube's speed menu
(function () {
    console.log('[YT Speed Ext] Content script loaded.');
    const speedsToAdd = [2.5, 3];
    let lastMenu = null;

    // Recursively search for .ytp-panel-menu in shadow roots
    function findPanelMenus(root=document) {
        let results = [];
        // Search in the current root
        if (root.querySelectorAll) {
            results = Array.from(root.querySelectorAll('.ytp-panel-menu'));
        }
        // Search in shadow roots of all elements
        if (root.children) {
            for (const el of root.children) {
                if (el.shadowRoot) {
                    results = results.concat(findPanelMenus(el.shadowRoot));
                }
            }
        }
        return results;
    }

    function addCustomSpeeds(submenu) {
        // Only inject if not already injected
        if (submenu.querySelector('[data-custom-speed]')) {
            console.log('[YT Speed Ext] Custom speeds already present, skipping injection.');
            return;
        }
        const speedItems = Array.from(submenu.querySelectorAll('.ytp-menuitem'));
        console.log('[YT Speed Ext] Speed menu items found:', speedItems.length, speedItems.map(i => i.textContent.trim()));
        // Filter out 'Custom (N)' and only keep pure numbers or 'Normal'
        const numericItems = speedItems.filter(item => {
            const label = item.querySelector('.ytp-menuitem-label');
            if (!label) return false;
            const text = label.textContent.trim();
            // Exclude 'Custom (N)' and allow only numbers or 'Normal'
            return /^([0-9.]+|Normal)$/.test(text);
        });
        if (numericItems.length === 0) {
            console.log('[YT Speed Ext] No numeric speed items found. Submenu:', submenu.outerHTML);
            return;
        }
        // Use the last numeric item as the insertion point
        const insertAfter = numericItems[numericItems.length - 1];
        console.log('[YT Speed Ext] Will inject after (last numeric):', insertAfter.textContent.trim());
        speedsToAdd.forEach(speed => {
            // Avoid duplicate insertion
            if (speedItems.some(item => {
                const label = item.querySelector('.ytp-menuitem-label');
                return label && label.textContent.trim() === String(speed);
            })) {
                console.log(`[YT Speed Ext] ${speed}x already present, skipping.`);
                return;
            }
            const newBtn = insertAfter.cloneNode(true);
            newBtn.setAttribute('data-custom-speed', speed);
            // Set label
            const labelDiv = newBtn.querySelector('.ytp-menuitem-label');
            if (labelDiv) labelDiv.textContent = String(speed);
            // Set checked state
            newBtn.setAttribute('aria-checked', 'false');
            // Remove previous event listeners by replacing the node
            const newBtnClone = newBtn.cloneNode(true);
            newBtnClone.addEventListener('click', e => {
                const video = document.querySelector('video');
                if (video) video.playbackRate = speed;
                // Deselect all
                submenu.querySelectorAll('.ytp-menuitem').forEach(btn => btn.setAttribute('aria-checked', 'false'));
                newBtnClone.setAttribute('aria-checked', 'true');
                // Close menu after selection
                document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
            });
            insertAfter.parentNode.insertBefore(newBtnClone, insertAfter.nextSibling);
            insertAfter = newBtnClone;
            console.log(`[YT Speed Ext] Injected custom speed: ${speed}x`);
        });
        console.log('[YT Speed Ext] Custom speeds injected into HTML5 player menu.');
    }

    // Observe for the opening of the playback speed submenu
    function observePlaybackSpeedSubmenu() {
        // Look for any visible .ytp-panel-menu with only numeric speed options
        function tryInject() {
            // Try both normal DOM and shadow DOM
            const panelMenus = findPanelMenus(document);
            let found = false;
            if (panelMenus.length === 0) {
                console.log('[YT Speed Ext] No .ytp-panel-menu found in light DOM or shadow DOM.');
            }
            for (const menu of panelMenus) {
                if (menu.offsetParent !== null) {
                    const labels = Array.from(menu.querySelectorAll('.ytp-menuitem-label'));
                    const labelTexts = labels.map(l => l.textContent.trim());
                    const numericLabels = labelTexts.filter(t => /^([0-9.]+|Normal)$/.test(t));
                    console.log('[YT Speed Ext] All menu labels:', labelTexts);
                    if (numericLabels.length >= 5 && numericLabels.includes('2')) {
                        found = true;
                        console.log('[YT Speed Ext] Detected playback speed submenu (numeric labels):', numericLabels);
                        addCustomSpeeds(menu);
                    }
                }
            }
            if (!found) {
                //console.log('[YT Speed Ext] No visible playback speed submenu detected.');
            }
        }
        // Observe the document for changes
        const observer = new MutationObserver(() => {
            tryInject();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        // Also try immediately in case menu is already open
        tryInject();
        // Also try on shadow roots of direct children
        for (const el of document.body.children) {
            if (el.shadowRoot) {
                try {
                    new MutationObserver(tryInject).observe(el.shadowRoot, {childList: true, subtree: true});
                } catch (e) {
                    console.log('[YT Speed Ext] Error observing shadowRoot:', e);
                }
            }
        }
    }
    observePlaybackSpeedSubmenu();

    // Fallback: poll for the speed menu every second if MutationObserver fails
    setInterval(() => {
        // Poll through both normal DOM and shadow DOM
        const panelMenus = findPanelMenus(document);
        if (panelMenus.length === 0) {
            console.log('[YT Speed Ext] [poll] No .ytp-panel-menu found in light DOM or shadow DOM.');
        }
        for (const menu of panelMenus) {
            if (menu.offsetParent !== null) {
                const labels = Array.from(menu.querySelectorAll('.ytp-menuitem-label'));
                if (labels.length > 0 && labels.every(l => /^([0-9.]+|Normal)$/.test(l.textContent.trim()))) {
                    console.log('[YT Speed Ext] [poll] Detected visible playback speed submenu:', labels.map(l => l.textContent.trim()));
                    addCustomSpeeds(menu);
                }
            }
        }
    }, 1000);
})();
