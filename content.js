(function () {
    const SPEEDS_TO_ADD = [2.5, 3, 3.5, 4];
    const MAX_SPEED = Math.max(...SPEEDS_TO_ADD);
    const injectedChips = new WeakSet();

    // --- Utilities ---

    function getText(el) {
        return el?.textContent?.trim() || '';
    }

    function parseSpeedLabel(text) {
        const t = (text || '').trim();
        if (!t) return null;
        if (t === 'Normal') return 1;
        const n = parseFloat(t.endsWith('x') ? t.slice(0, -1) : t);
        return isFinite(n) && n > 0 && n <= 8 ? n : null;
    }

    function querySelectorAllDeep(root, selector) {
        const results = [];
        const visited = new Set();
        const stack = [root];
        while (stack.length) {
            const node = stack.pop();
            if (!node?.querySelectorAll) continue;
            results.push(...node.querySelectorAll(selector));
            for (const el of node.querySelectorAll('*')) {
                if (el?.shadowRoot && !visited.has(el.shadowRoot)) {
                    visited.add(el.shadowRoot);
                    stack.push(el.shadowRoot);
                }
            }
        }
        return results;
    }

    function getVideoSpeed() {
        return document.querySelector('video')?.playbackRate || 1;
    }

    function setVideoSpeed(speed) {
        document.querySelectorAll('video').forEach(v => v.playbackRate = speed);
    }

    // --- Speed Panel UI ---

    function formatSpeedChip(speed) {
        return Number.isInteger(speed) ? `${speed}.0` : String(speed);
    }

    function injectSliderStyles() {
        if (document.getElementById('yt-ext-speed-styles')) return;
        const style = document.createElement('style');
        style.id = 'yt-ext-speed-styles';
        style.textContent = `
            .ytp-variable-speed-panel-content .ytp-input-slider,
            .ytp-variable-speed-panel-content .ytp-input-slider * {
                transition-duration: 0s !important;
            }
            .ytp-variable-speed-panel-content .ytp-input-slider {
                --yt-slider-shape-gradient-percent: var(--ext-speed-pct) !important;
            }
        `;
        document.head.appendChild(style);
    }

    function syncSlider(panel, speed) {
        const slider = panel.querySelector('.ytp-input-slider');
        if (!slider) return;
        const min = parseFloat(slider.getAttribute('min')) || 0.25;
        slider.setAttribute('max', String(MAX_SPEED));
        slider.value = String(speed);
        slider.setAttribute('aria-valuenow', String(speed));
        slider.setAttribute('aria-valuetext', `${Number(speed).toFixed(2)}x`);
        const pct = ((speed - min) / (MAX_SPEED - min)) * 100;
        slider.style.setProperty('--ext-speed-pct',
            `${Math.max(0, Math.min(100, pct))}%`);
    }

    function syncPanelUI(panel, speed) {
        const label = `${Number(speed).toFixed(2)}x`;

        const display = panel.querySelector('.ytp-variable-speed-panel-display span');
        if (display) display.textContent = label;
        const sliderText = panel.querySelector('.ytp-speedslider-text');
        if (sliderText) sliderText.textContent = label;

        syncSlider(panel, speed);
    }

    // --- Chip Injection ---

    function injectCustomSpeeds(chips) {
        if (injectedChips.has(chips)) return;

        // Remove premium 3.0x upsell button
        chips.querySelector('.ytp-variable-speed-panel-premium-upsell-icon')
            ?.closest('.ytp-variable-speed-panel-preset-button-wrapper')
            ?.remove();

        const wrappers = [...chips.querySelectorAll('.ytp-variable-speed-panel-preset-button-wrapper')];
        if (wrappers.length === 0) return;

        const existingSpeeds = new Set(
            wrappers
                .map(w => parseSpeedLabel(getText(w.querySelector('button span')) || getText(w.querySelector('button'))))
                .filter(v => v != null)
        );
        if (existingSpeeds.size < 2) return;

        const template = wrappers.find(w => w.getAttribute('aria-hidden') !== 'true') || wrappers[0];
        if (!template.querySelector('button')) return;

        const panel = chips.closest('.ytp-variable-speed-panel-content');
        const popup = chips.closest('.ytp-popup');
        const ytPanel = chips.closest('.ytp-panel');

        // Wrap chips onto a second row
        Object.assign(chips.style, {
            flexWrap: 'wrap', height: 'auto', justifyContent: 'flex-start',
            gap: '8px', paddingBottom: '16px',
        });
        if (panel) Object.assign(panel.style, { height: 'auto', minHeight: '230px' });

        // Grow popup/panel to fit the extra row
        for (const el of [popup, ytPanel]) {
            if (el?.style.height && parseInt(el.style.height, 10) < 320) el.style.height = '320px';
        }

        // Restore original height when navigating back to the main settings menu
        if (ytPanel) {
            const backBtn = ytPanel.querySelector('.ytp-panel-back-button');
            if (backBtn && !backBtn._backHandler) {
                backBtn.addEventListener('click', () => {
                    for (const el of [popup, ytPanel]) if (el) el.style.height = '250px';
                });
                backBtn._backHandler = true;
            }
        }

        // Add custom speed chips
        for (const speed of SPEEDS_TO_ADD) {
            if (existingSpeeds.has(speed)) continue;

            const wrapper = template.cloneNode(true);
            wrapper.setAttribute('aria-hidden', 'false');
            wrapper.style.display = '';
            wrapper.style.order = String(Math.floor(speed * 100));

            const btn = wrapper.querySelector('button');
            btn.setAttribute('data-custom-speed', String(speed));
            btn.querySelector('.ytp-variable-speed-panel-premium-upsell-icon')?.remove();

            const span = btn.querySelector('span') || btn.appendChild(document.createElement('span'));
            span.textContent = formatSpeedChip(speed);
            wrapper.querySelector('.ytp-variable-speed-panel-preset-button-label-text')?.remove();

            btn.addEventListener('click', () => {
                // Defer so our speed wins over YouTube's internal clamping handlers
                setTimeout(() => {
                    setVideoSpeed(speed);
                    if (panel) syncPanelUI(panel, speed);
                }, 0);
            });

            chips.appendChild(wrapper);
        }

        // Intercept native chip clicks to keep slider/display in sync after custom speeds
        for (const w of wrappers) {
            const btn = w.querySelector('button');
            if (!btn || btn.hasAttribute('data-custom-speed') || btn._speedHandler) continue;
            const s = parseSpeedLabel(getText(btn.querySelector('span')) || getText(btn));
            if (s != null) {
                btn.addEventListener('click', () => {
                    setTimeout(() => {
                        setVideoSpeed(s);
                        if (panel) syncPanelUI(panel, s);
                    }, 0);
                });
                btn._speedHandler = true;
            }
        }

        // Kill slider transition so our gradient updates are instant
        injectSliderStyles();

        // Show current speed on first render
        if (panel) syncPanelUI(panel, getVideoSpeed());

        injectedChips.add(chips);
    }

    // --- Observer ---

    let scheduled = false;
    const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            const menus = new Set(querySelectorAllDeep(document.body, '.ytp-settings-menu'));
            for (const menu of menus) {
                for (const chips of querySelectorAllDeep(menu, '.ytp-variable-speed-panel-chips')) {
                    injectCustomSpeeds(chips);
                }
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();