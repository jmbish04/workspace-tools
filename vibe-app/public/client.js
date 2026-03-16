// Standardized client helpers for REST and WebSocket

const WS_URL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;

function createWebSocket(projectId = 'default') {
  const ws = new WebSocket(`${WS_URL}?projectId=${projectId}`);

  ws.onopen = () => {
    console.log('[WS] Connected to room:', projectId);
  };

  ws.onclose = (e) => {
    console.log('[WS] Disconnected, attempting reconnect...', e);
    setTimeout(() => createWebSocket(projectId), 3000); // basic retry
  };

  ws.onerror = (err) => {
    console.error('[WS] Error:', err);
  };

  return ws;
}

// REST wrapper
async function apiFetch(endpoint, options = {}) {
  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error(`[API Fetch] Error fetching ${endpoint}:`, error);
    throw error;
  }
}

// Setup common interactions
document.addEventListener('DOMContentLoaded', () => {
  // Intersection Observer for animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));

  // Load Nav
  fetch('/nav.html')
    .then(r => r.text())
    .then(html => {
      const navContainer = document.getElementById('nav-container');
      if (navContainer) {
        navContainer.innerHTML = html;
      }
    });
});
