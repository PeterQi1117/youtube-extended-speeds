(function () {
    const SPEEDS_TO_ADD = [2.5, 3, 3.5, 4];
    const processedButtonGroups = new WeakSet();

    // --- UTILITIES ---

    function getText(el) {
        return (el && el.textContent ? el.textContent : '').trim();
    }

    function parseSpeedLabel(text) {
        const t = (text || '').trim();
        if (!t) return null;
        if (t === 'Normal') return 1;
        const cleaned = t.endsWith('x') ? t.slice(0, -1) : t;
        const n = parseFloat(cleaned);
        return (isFinite(n) && n > 0 && n <= 8) ? n : null;
    }

    function querySelectorAllDeep(root, selector) {
        const out = [];
        const visited = new Set();
        const stack = [root];

        while (stack.length) {
            const node = stack.pop();
            if (!node || !node.querySelectorAll) continue;

            out.push(...node.querySelectorAll(selector));

            for (const el of node.querySelectorAll('*')) {
                if (el && el.shadowRoot && !visited.has(el.shadowRoot)) {
                    visited.add(el.shadowRoot);
                    stack.push(el.shadowRoot);
                }
            }
        }
        return out;
    }

    function updateVideoSpeed(speed) {
        // Fallback for native video element
        document.querySelectorAll('video').forEach(v => v.playbackRate = speed);
    }

    function getVideoSpeed() {
        const video = document.querySelector('video');
        return video ? video.playbackRate : 1;
    }

    // --- NEW UI (VARIABLE SPEED PANEL & BUTTON GROUPS) ---

    function formatVariableSpeedPreset(speed) {
        if (!isFinite(speed)) return String(speed);
        return Number.isInteger(speed) ? `${speed}.0` : String(speed);
    }

    function updateVariableSpeedPanelDisplay(root, speed) {
        const value = `${Number(speed).toFixed(2)}x`;
        const display = root.querySelector('.ytp-variable-speed-panel-display span');
        if (display) display.textContent = value;
        const text = root.querySelector('.ytp-speedslider-text');
        if (text) text.textContent = value;
    }

    function addSpeedsToVariableSpeedChips(chips) {
        const current = getVideoSpeed();
        
        // Remove existing premium 3.0x button if present to save space
        const premiumUpsell = chips.querySelector('.ytp-variable-speed-panel-premium-upsell-icon');
        if (premiumUpsell) {
            const premiumWrapper = premiumUpsell.closest('.ytp-variable-speed-panel-preset-button-wrapper');
            if (premiumWrapper) premiumWrapper.remove();
        }

        const currentWrappers = [...chips.querySelectorAll('.ytp-variable-speed-panel-preset-button-wrapper')];
        if (currentWrappers.length === 0) return;

        const existing = new Set(
            currentWrappers
                .map(w => parseSpeedLabel(getText(w.querySelector('button span')) || getText(w.querySelector('button'))))
                .filter(v => v != null)
        );

        if (existing.size < 2) return;

        const templateWrapper = currentWrappers.find(w => w.getAttribute('aria-hidden') !== 'true') || currentWrappers[0];
        const templateButton = templateWrapper.querySelector('button');
        if (!templateButton) return;

        // Force chips container to wrap onto a new row instead of resizing the whole menu popup
        chips.style.flexWrap = 'wrap';
        chips.style.height = 'auto';
        chips.style.justifyContent = 'flex-start';
        chips.style.gap = '8px'; // Add some spacing between rows/items
        chips.style.paddingBottom = '16px'; // Add padding below the buttons
        
        const contentPanel = chips.closest('.ytp-variable-speed-panel-content');
        if (contentPanel) {
            contentPanel.style.height = 'auto';
            contentPanel.style.minHeight = '230px'; // Original was 193px
        }
        
        const popup = chips.closest('.ytp-popup');
        const panel = chips.closest('.ytp-panel');
        
        // Increase height slightly to fit the wrapped buttons
        if (popup && popup.style.height) {
            const currentHeight = parseInt(popup.style.height, 10);
            if (currentHeight < 320) popup.style.height = '320px'; // Original was 250px
        }
        if (panel && panel.style.height) {
            const currentHeight = parseInt(panel.style.height, 10);
            if (currentHeight < 320) panel.style.height = '320px';
        }
        
        // Restore height when navigating back to main menu
        if (panel) {
            const backBtn = panel.querySelector('.ytp-panel-back-button');
            if (backBtn && !backBtn._hasHeightResetHandler) {
                backBtn.addEventListener('click', () => {
                    if (popup) popup.style.height = '250px';
                    if (panel) panel.style.height = '250px';
                });
                backBtn._hasHeightResetHandler = true;
            }
        }

        for (const speed of SPEEDS_TO_ADD) {
            if (existing.has(speed) || chips.querySelector(`[data-custom-speed="${String(speed)}"]`)) continue;

            const wrapper = templateWrapper.cloneNode(true);
            wrapper.setAttribute('aria-hidden', 'false');
            wrapper.style.display = '';
            wrapper.style.order = String(Math.floor(speed * 100));

            const button = wrapper.querySelector('button');
            button.setAttribute('data-custom-speed', String(speed));

            const upsell = button.querySelector('.ytp-variable-speed-panel-premium-upsell-icon');
            if (upsell) upsell.remove();

            const span = button.querySelector('span') || button.appendChild(document.createElement('span'));
            span.textContent = formatVariableSpeedPreset(speed);

            const label = wrapper.querySelector('.ytp-variable-speed-panel-preset-button-label-text');
            if (label) label.remove();

            button.addEventListener('click', () => {
                updateVideoSpeed(speed);
                if (contentPanel) updateVariableSpeedPanelDisplay(contentPanel, speed);

                if (contentPanel) {
                    const slider = contentPanel.querySelector('.ytp-input-slider');
                    if (slider) {
                        const max = parseFloat(slider.getAttribute('max')) || 2;
                        slider.value = String(max);
                        slider.setAttribute('aria-valuenow', String(max));
                        slider.setAttribute('aria-valuetext', String(max));
                        slider.style.setProperty('--yt-slider-shape-gradient-percent', '100%');
                        slider.dispatchEvent(new Event('input', { bubbles: true }));
                        slider.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            });

            chips.appendChild(wrapper);
        }

        if (contentPanel) updateVariableSpeedPanelDisplay(contentPanel, current);
        
        // Fix 4x -> 2x issue: We need to override the native buttons so they also force updateVideoSpeed.
        // YouTube's native UI gets confused when the video speed is > 2 (the slider max).
        // By adding click listeners to native buttons, we ensure they reset the speed correctly.
        currentWrappers.forEach(w => {
            const btn = w.querySelector('button');
            if (!btn || btn.hasAttribute('data-custom-speed') || btn._hasCustomClickHandler) return;
            
            const speed = parseSpeedLabel(getText(btn.querySelector('span')) || getText(btn));
            if (speed != null) {
                btn.addEventListener('click', () => {
                    updateVideoSpeed(speed);
                });
                btn._hasCustomClickHandler = true;
            }
        });
    }

    function handleNewSpeedUI(settingsMenu) {
        const chipsContainers = querySelectorAllDeep(settingsMenu, '.ytp-variable-speed-panel-chips');
        
        for (const chips of chipsContainers) {
            if (!processedButtonGroups.has(chips)) {
                processedButtonGroups.add(chips);
            }
            addSpeedsToVariableSpeedChips(chips);
        }
    }

    // --- MAIN OBSERVER ---

    let scheduled = false;
    const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        
        requestAnimationFrame(() => {
            scheduled = false;
            const players = [...document.querySelectorAll('.html5-video-player')];
            if (players.length === 0) players.push(document.body);
            
            for (const player of players) {
                // New UI settings menus (can be attached to player or document body)
                const settingsMenus = [
                    ...querySelectorAllDeep(player, '.ytp-settings-menu'),
                    ...querySelectorAllDeep(document.body, '.ytp-popup.ytp-settings-menu')
                ];
                
                // Deduplicate menus
                const uniqueMenus = [...new Set(settingsMenus)];
                for (const menu of uniqueMenus) {
                    handleNewSpeedUI(menu);
                }
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();