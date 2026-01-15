/**
 * Update Notification Badge
 * Shows a red badge when update is available
 * Add this to your renderer (Frontend)
 */

// Create and inject update badge
function createUpdateBadge() {
  const badge = document.createElement('div');
  badge.id = 'update-badge';
  badge.innerHTML = '🔴 Update Available - Click to Update';
  badge.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: linear-gradient(135deg, #ff0000 0%, #cc0000 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: bold;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(255, 0, 0, 0.4);
    cursor: pointer;
    z-index: 99999;
    display: none;
    animation: pulse 2s infinite;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;
  
  // Add pulse animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { transform: scale(1); box-shadow: 0 4px 12px rgba(255, 0, 0, 0.4); }
      50% { transform: scale(1.05); box-shadow: 0 6px 16px rgba(255, 0, 0, 0.6); }
    }
    #update-badge:hover {
      background: linear-gradient(135deg, #cc0000 0%, #990000 100%);
      transform: scale(1.05);
    }
  `;
  document.head.appendChild(style);
  
  // Click to check for updates
  badge.addEventListener('click', () => {
    if (window.electron) {
      window.electron.checkForUpdates();
    }
  });
  
  document.body.appendChild(badge);
  return badge;
}

// Listen for update notifications from main process
if (window.electron && window.electron.onUpdateNotification) {
  const badge = createUpdateBadge();
  
  window.electron.onUpdateNotification((available) => {
    if (available) {
      badge.style.display = 'block';
      
      // Show browser notification if supported
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Baristaflow Update Available', {
          body: 'Click to download and install the latest version',
          icon: '/logo.png',
          badge: '/logo.png',
          tag: 'update-notification',
        });
      }
    } else {
      badge.style.display = 'none';
    }
  });
  
  // Request notification permission on load
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export { createUpdateBadge };
