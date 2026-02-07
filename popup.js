// Popup script for Meet Transcription Reminder
(function () {
  'use strict';

  const autoStartToggle = document.getElementById('autoStartToggle');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  /**
   * Localize all elements with data-i18n attribute
   */
  function localize() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      const message = chrome.i18n.getMessage(key);
      if (message) {
        element.textContent = message;
      }
    });
  }

  /**
   * Update status display based on toggle state
   */
  function updateStatus() {
    if (autoStartToggle.checked) {
      statusDot.classList.remove('inactive');
      statusText.textContent = chrome.i18n.getMessage('statusActive');
    } else {
      statusDot.classList.add('inactive');
      statusText.textContent = chrome.i18n.getMessage('statusManual');
    }
  }

  // Initialize localization
  localize();

  // Load saved settings
  chrome.storage.sync.get(['autoStart'], (result) => {
    autoStartToggle.checked = result.autoStart === true;
    updateStatus();
  });

  // Save settings when toggle changes
  autoStartToggle.addEventListener('change', () => {
    const autoStart = autoStartToggle.checked;
    chrome.storage.sync.set({ autoStart }, () => {
      updateStatus();
      console.log('Auto-start setting saved:', autoStart);
    });
  });
})();
