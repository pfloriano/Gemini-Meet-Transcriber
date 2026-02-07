// Content Script for Meet Transcription Reminder
// Detects the pen_spark (Gemini Transcription) trigger and prompts user to enable it
(function () {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================
    const CONFIG = {
        ICON_LIGATURE: 'pen_spark',
        CALL_END_ICON: 'call_end', // Red hangup button - only present in active meeting
        ACTION_BUTTON_SELECTOR: 'button[jsname="R6SlF"]',
        CHECK_INTERVAL: 1000,
        MAX_WAIT_TIME: 120000, // 2 minutes max wait (user might be in waiting room)
        ACTIVATION_TIMEOUT: 3000, // 3 seconds for action button to appear
        BALLOON_ID: 'meet-transcription-reminder-balloon',
        SHADOW_HOST_ID: 'meet-transcription-reminder-host'
    };

    // ============================================
    // STATE
    // ============================================
    let state = {
        hasProcessed: false,
        observer: null,
        checkInterval: null,
        startTime: Date.now()
    };

    // ============================================
    // DOM UTILITIES
    // ============================================

    /**
     * Simulate a full user interaction sequence on an element
     * Dispatches mouseover, mousedown, mouseup, click in rapid succession
     */
    function simulateUserInteraction(element) {
        const eventOptions = {
            view: window,
            bubbles: true,
            cancelable: true,
            composed: true
        };

        const events = [
            new MouseEvent('mouseover', eventOptions),
            new MouseEvent('mouseenter', { ...eventOptions, bubbles: false }),
            new PointerEvent('pointerenter', { ...eventOptions, bubbles: false }),
            new PointerEvent('pointermove', eventOptions),
            new MouseEvent('mousemove', eventOptions),
            new PointerEvent('pointerdown', { ...eventOptions, button: 0 }),
            new MouseEvent('mousedown', { ...eventOptions, button: 0 }),
            new PointerEvent('pointerup', { ...eventOptions, button: 0 }),
            new MouseEvent('mouseup', { ...eventOptions, button: 0 }),
            new MouseEvent('click', { ...eventOptions, button: 0 }),
        ];

        events.forEach((event, index) => {
            setTimeout(() => element.dispatchEvent(event), index * 10);
        });
    }

    /**
     * Check if current URL is a meeting page (not landing/home page)
     */
    function isMeetingUrl() {
        const url = window.location.href;
        const meetingPattern = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i;
        return meetingPattern.test(url);
    }

    /**
     * GATEKEEPER: Check if user is in an ACTIVE meeting (not waiting room)
     * The key difference: Active meetings have the red "End Call" button (call_end icon)
     * Waiting room only has "Join now" button, no call_end
     */
    function isMeetingActive() {
        // Look for the red hangup button by its icon text ligature
        const icons = document.querySelectorAll('i, span');
        for (const el of icons) {
            if (el.textContent.trim() === CONFIG.CALL_END_ICON) {
                return true;
            }
        }
        return false;
    }

    /**
     * Find the pen_spark trigger element (language-agnostic)
     */
    function findTriggerElement() {
        const iconElements = document.querySelectorAll('i, span');
        for (const el of iconElements) {
            if (el.textContent.trim() === CONFIG.ICON_LIGATURE) {
                return el;
            }
        }
        return null;
    }

    /**
     * Find the clickable parent container from the trigger icon
     */
    function findTriggerContainer(iconElement) {
        if (!iconElement) return null;

        const selectors = [
            '[jsaction]',
            '[role="button"]',
            'button',
            '[data-is-tooltip-wrapper]'
        ];

        for (const selector of selectors) {
            const container = iconElement.closest(selector);
            if (container) {
                return container;
            }
        }

        return iconElement.parentElement;
    }

    /**
     * Find the action button that appears after triggering
     */
    function findActionButton() {
        const button = document.querySelector(CONFIG.ACTION_BUTTON_SELECTOR);

        if (!button) return null;

        // Robustness check: verify button has expected content
        const hasProgressBar = button.querySelector('[role="progressbar"]');
        const buttonText = button.textContent.toLowerCase();
        const hasExpectedText =
            buttonText.includes('anota') ||
            buttonText.includes('note') ||
            buttonText.includes('transcript') ||
            buttonText.includes('gemini');

        if (hasProgressBar || hasExpectedText) {
            return button;
        }

        // Still return if selector matched (UI may change)
        console.log('[Meet Transcription Reminder] Button found but content validation uncertain');
        return button;
    }

    /**
     * Check if element is visible and clickable
     */
    function isElementClickable(element) {
        if (!element) return false;

        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    /**
     * Wait for the action button to appear using MutationObserver
     * Returns Promise that resolves with button or rejects on timeout
     */
    function waitForActionButton(timeout = CONFIG.ACTIVATION_TIMEOUT) {
        return new Promise((resolve, reject) => {
            // Check if already present
            const existingButton = findActionButton();
            if (existingButton && isElementClickable(existingButton)) {
                resolve(existingButton);
                return;
            }

            const timeoutId = setTimeout(() => {
                observer.disconnect();
                reject(new Error('Timeout waiting for action button'));
            }, timeout);

            const observer = new MutationObserver((mutations, obs) => {
                const button = findActionButton();
                if (button && isElementClickable(button)) {
                    clearTimeout(timeoutId);
                    obs.disconnect();
                    resolve(button);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class', 'hidden']
            });
        });
    }

    // ============================================
    // TWO-STEP ACTIVATION CHAIN
    // ============================================

    /**
     * Main activation function - implements the two-step chain
     * 1. Find and trigger the pen_spark element
     * 2. Wait for the action button to appear
     * 3. Click the action button
     * Returns a Promise that resolves when transcription is activated
     */
    async function activateTranscription() {
        console.log('[Meet Transcription Reminder] Starting two-step activation...');

        // Step 1: Find the trigger element
        const triggerIcon = findTriggerElement();
        if (!triggerIcon) {
            throw new Error('Could not find pen_spark trigger element');
        }

        const triggerContainer = findTriggerContainer(triggerIcon);
        if (!triggerContainer) {
            throw new Error('Could not find trigger container');
        }

        console.log('[Meet Transcription Reminder] Found trigger, simulating interaction...');

        // Step 2: Simulate user interaction on trigger to reveal action button
        simulateUserInteraction(triggerContainer);
        simulateUserInteraction(triggerIcon);

        // Also simulate on parent elements for robustness
        let parent = triggerContainer.parentElement;
        for (let i = 0; i < 2 && parent && parent !== document.body; i++) {
            simulateUserInteraction(parent);
            parent = parent.parentElement;
        }

        // Wait for popup to fully render and stabilize
        console.log('[Meet Transcription Reminder] Waiting for popup to stabilize...');
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Re-find the button in case DOM changed
        const actionButton = await waitForActionButton();

        // Step 4: Click the action button using full event simulation
        // Simple .click() doesn't work on Google Meet buttons - need full event chain
        console.log('[Meet Transcription Reminder] Found action button, simulating click...');
        simulateUserInteraction(actionButton);

        // Wait for click events to complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 5: Watch for confirmation modal
        setTimeout(() => watchForConfirmationModal(), 500);

        return { success: true, button: actionButton };
    }

    // ============================================
    // BALLOON UI (Shadow DOM)
    // ============================================

    /**
     * Create and inject the reminder balloon using Shadow DOM for CSS isolation
     */
    function createBalloon(targetElement) {
        removeBalloon();

        const shadowHost = document.createElement('div');
        shadowHost.id = CONFIG.SHADOW_HOST_ID;
        shadowHost.style.cssText = 'position: absolute; z-index: 999999; pointer-events: none;';
        document.body.appendChild(shadowHost);

        const shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

        const styles = document.createElement('style');
        styles.textContent = `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      .balloon-container {
        position: fixed;
        z-index: 999999;
        pointer-events: auto;
        animation: fadeIn 0.2s ease-out;
      }
      
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .balloon {
        background: linear-gradient(135deg, #1a73e8 0%, #1557b0 100%);
        border-radius: 12px;
        padding: 16px 20px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 
                    0 2px 8px rgba(0, 0, 0, 0.2);
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 220px;
        font-family: 'Google Sans', 'Segoe UI', Roboto, sans-serif;
      }
      
      .balloon-arrow {
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-top: 10px solid #1557b0;
      }
      
      .balloon-header {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .balloon-icon {
        font-size: 24px;
      }
      
      .balloon-title {
        color: #ffffff;
        font-size: 15px;
        font-weight: 500;
        line-height: 1.3;
      }
      
      .balloon-buttons {
        display: flex;
        gap: 10px;
      }
      
      .btn {
        flex: 1;
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        font-family: inherit;
      }
      
      .btn-yes {
        background: #ffffff;
        color: #1a73e8;
      }
      
      .btn-yes:hover {
        background: #e8f0fe;
        transform: scale(1.02);
      }
      
      .btn-no {
        background: rgba(255, 255, 255, 0.15);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.3);
      }
      
      .btn-no:hover {
        background: rgba(255, 255, 255, 0.25);
      }

      .btn:disabled {
        opacity: 0.6;
        cursor: wait;
      }
    `;
        shadowRoot.appendChild(styles);

        // Get localized strings
        const balloonTitle = chrome.i18n.getMessage('balloonTitle') || 'Start Transcription?';
        const btnYesText = chrome.i18n.getMessage('btnYes') || 'Yes';
        const btnNoText = chrome.i18n.getMessage('btnNo') || 'No';

        const balloonContainer = document.createElement('div');
        balloonContainer.className = 'balloon-container';
        balloonContainer.id = CONFIG.BALLOON_ID;

        balloonContainer.innerHTML = `
      <div class="balloon">
        <div class="balloon-header">
          <span class="balloon-icon">✨</span>
          <span class="balloon-title">${balloonTitle}</span>
        </div>
        <div class="balloon-buttons">
          <button class="btn btn-yes" id="btn-yes">${btnYesText}</button>
          <button class="btn btn-no" id="btn-no">${btnNoText}</button>
        </div>
        <div class="balloon-arrow"></div>
      </div>
    `;

        shadowRoot.appendChild(balloonContainer);
        positionBalloon(balloonContainer, targetElement);

        // Event listeners
        const yesBtn = shadowRoot.getElementById('btn-yes');
        const noBtn = shadowRoot.getElementById('btn-no');

        yesBtn.addEventListener('click', async () => {
            yesBtn.disabled = true;
            yesBtn.textContent = '...';

            try {
                await activateTranscription();
                removeBalloon();
            } catch (error) {
                console.error('[Meet Transcription Reminder] Activation failed:', error);
                yesBtn.textContent = 'Erro / Error';
                setTimeout(removeBalloon, 2000);
            }

            state.hasProcessed = true;
        });

        noBtn.addEventListener('click', () => {
            removeBalloon();
            state.hasProcessed = true;
        });

        window.addEventListener('resize', () => positionBalloon(balloonContainer, targetElement));

        return shadowHost;
    }

    /**
     * Position the balloon above the target element
     */
    function positionBalloon(balloon, targetElement) {
        // Use requestAnimationFrame to ensure balloon is rendered
        requestAnimationFrame(() => {
            const targetRect = targetElement.getBoundingClientRect();
            const balloonRect = balloon.getBoundingClientRect();

            // Use actual balloon width, or fallback to 240px if not yet rendered
            const balloonWidth = balloonRect.width > 0 ? balloonRect.width : 240;
            const balloonHeight = balloonRect.height > 0 ? balloonRect.height : 120;

            // Center balloon horizontally above the target
            let left = targetRect.left + (targetRect.width / 2) - (balloonWidth / 2);
            let top = targetRect.top - balloonHeight - 16; // 16px gap above target

            // Keep balloon within viewport bounds
            const padding = 10;
            left = Math.max(padding, Math.min(left, window.innerWidth - balloonWidth - padding));
            top = Math.max(padding, top);

            // If balloon would go off top, position below the target instead
            if (top < padding) {
                top = targetRect.bottom + 16;
            }

            balloon.style.left = `${left}px`;
            balloon.style.top = `${top}px`;
        });
    }

    /**
     * Remove the balloon from DOM
     */
    function removeBalloon() {
        const host = document.getElementById(CONFIG.SHADOW_HOST_ID);
        if (host) {
            host.remove();
        }
    }

    // ============================================
    // CONFIRMATION MODAL HANDLING
    // ============================================

    /**
     * Watch for and handle confirmation modal
     */
    function watchForConfirmationModal() {
        let attempts = 0;
        const maxAttempts = 10;

        const checkModal = setInterval(() => {
            attempts++;

            const modals = document.querySelectorAll('[role="dialog"], [role="alertdialog"], [data-is-dialog]');

            for (const modal of modals) {
                const style = window.getComputedStyle(modal);
                if (style.display === 'none' || style.visibility === 'hidden') continue;

                const buttons = modal.querySelectorAll('button, [role="button"]');

                for (const btn of buttons) {
                    const text = btn.textContent.toLowerCase().trim();

                    if (text.includes('start') || text.includes('confirm') ||
                        text.includes('iniciar') || text.includes('confirmar') ||
                        text.includes('ativar') || text.includes('enable')) {

                        console.log('[Meet Transcription Reminder] Found confirmation button, clicking...');
                        btn.click();
                        clearInterval(checkModal);
                        return;
                    }
                }

                const primaryBtn = modal.querySelector('[data-mdc-dialog-action="accept"], .primary-button, [aria-label*="confirm"], [aria-label*="start"]');
                if (primaryBtn) {
                    console.log('[Meet Transcription Reminder] Found primary button, clicking...');
                    primaryBtn.click();
                    clearInterval(checkModal);
                    return;
                }
            }

            if (attempts >= maxAttempts) {
                clearInterval(checkModal);
                console.log('[Meet Transcription Reminder] No confirmation modal found (may not be needed)');
            }
        }, 300);
    }

    // ============================================
    // MAIN DETECTION LOGIC
    // ============================================

    /**
     * Get settings from chrome.storage
     */
    function getSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['autoStart'], (result) => {
                resolve({
                    autoStart: result.autoStart === true
                });
            });
        });
    }

    /**
     * Main function to check for trigger and take action
     */
    async function checkForTrigger() {
        if (state.hasProcessed) return;

        // Check 1: URL must be a meeting page
        if (!isMeetingUrl()) {
            console.log('[Meet Transcription Reminder] Not on meeting URL, skipping...');
            return;
        }

        // Check 2: GATEKEEPER - Must be in active meeting (not waiting room)
        // Wait for the call_end button to appear (indicates user has joined)
        if (!isMeetingActive()) {
            console.log('[Meet Transcription Reminder] Waiting room detected, staying dormant...');
            return; // Keep observing, don't process yet
        }

        console.log('[Meet Transcription Reminder] Active meeting detected!');

        // Find the trigger element (pen_spark icon)
        const triggerIcon = findTriggerElement();
        if (!triggerIcon) {
            if (Date.now() - state.startTime > CONFIG.MAX_WAIT_TIME) {
                console.log('[Meet Transcription Reminder] Timeout waiting for trigger');
                cleanup();
            }
            return;
        }

        const triggerContainer = findTriggerContainer(triggerIcon);
        if (!triggerContainer) {
            console.log('[Meet Transcription Reminder] Found icon but no container');
            return;
        }

        console.log('[Meet Transcription Reminder] Found trigger element!');

        const settings = await getSettings();

        if (settings.autoStart) {
            // Auto-activate using the two-step chain
            console.log('[Meet Transcription Reminder] Auto-start enabled, activating...');
            try {
                await activateTranscription();
            } catch (error) {
                console.error('[Meet Transcription Reminder] Auto-activation failed:', error);
            }
        } else {
            // Show balloon pointing to trigger element
            console.log('[Meet Transcription Reminder] Showing reminder balloon...');
            createBalloon(triggerContainer);
        }

        cleanup();
        state.hasProcessed = true;
    }

    /**
     * Cleanup observers and intervals
     */
    function cleanup() {
        if (state.observer) {
            state.observer.disconnect();
            state.observer = null;
        }
        if (state.checkInterval) {
            clearInterval(state.checkInterval);
            state.checkInterval = null;
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    function init() {
        console.log('[Meet Transcription Reminder] Initializing...');

        if (!isMeetingUrl()) {
            console.log('[Meet Transcription Reminder] Not on active meeting page');
            return;
        }

        // Set up MutationObserver for trigger detection
        state.observer = new MutationObserver(() => {
            if (!state.hasProcessed) {
                checkForTrigger();
            }
        });

        state.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Backup interval check
        state.checkInterval = setInterval(checkForTrigger, CONFIG.CHECK_INTERVAL);

        // Initial check
        setTimeout(checkForTrigger, 1000);

        // Listen for URL changes (SPA navigation)
        let lastUrl = location.href;
        new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                state.hasProcessed = false;
                state.startTime = Date.now();
                console.log('[Meet Transcription Reminder] URL changed, resetting...');

                if (isMeetingUrl()) {
                    setTimeout(checkForTrigger, 2000);
                }
            }
        }).observe(document, { subtree: true, childList: true });
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
