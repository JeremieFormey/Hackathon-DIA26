/**
 * Gmail Phishing Detector - Background Script
 * 
 * This script runs in the background and manages the extension's lifecycle.
 * It's responsible for initial setup and handling any background tasks.
 */

// Log when the extension is installed
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      console.log('Gmail Phishing Detector extension installed');
    } else if (details.reason === 'update') {
      console.log(`Gmail Phishing Detector extension updated from ${details.previousVersion} to ${chrome.runtime.getManifest().version}`);
    }
  });
  
  // Initialize any required background data
  function initializeExtension() {
    // For now, we're just using mock data, so no initialization is needed
    // In a real extension, you might set up default settings or connect to services
    console.log('Gmail Phishing Detector background script initialized');
  }
  
  // Initialize when the background script loads
  initializeExtension();
  