/**
 * Gmail Phishing Detector - Popup Script
 * 
 * This script handles the functionality of the extension's popup UI.
 */

document.addEventListener('DOMContentLoaded', function() {
    // Handle the refresh button click
    const refreshButton = document.getElementById('refresh-btn');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        // Send a message to the content script to refresh the detection
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          if (tabs[0] && tabs[0].url.includes('mail.google.com')) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'refreshDetection'});
            
            // Update the status to show we're refreshing
            updateStatus('Refreshing...', '⟳');
            
            // Reset status after a delay
            setTimeout(() => {
              updateStatus('Extension is active', '✅');
            }, 2000);
          } else {
            updateStatus('Please navigate to Gmail first', '⚠️');
          }
        });
      });
    }
    
    /**
     * Update the status display in the popup
     * @param {string} text - The status text to display
     * @param {string} icon - The icon to display with the status
     */
    function updateStatus(text, icon) {
      const statusText = document.querySelector('.status-text');
      const statusIcon = document.querySelector('.status-icon');
      
      if (statusText && statusIcon) {
        statusText.textContent = text;
        statusIcon.textContent = icon;
      }
    }
    
    // Check if we're on Gmail
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0] && !tabs[0].url.includes('mail.google.com')) {
        updateStatus('Please navigate to Gmail to use this extension', '⚠️');
      }
    });
  });
  