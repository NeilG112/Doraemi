// --- Wallet Popup Logic ---
const walletButton = document.getElementById('wallet-button');
const walletPopup = document.getElementById('wallet-popup');
const closeWalletButton = document.getElementById('close-wallet-btn');

// Function to toggle the wallet popup
function toggleWallet() {
    walletPopup.classList.toggle('show');
}

// Show/hide wallet when the button is clicked
walletButton?.addEventListener('click', (event) => {
    event.stopPropagation(); // Prevents the document click listener from firing immediately
    toggleWallet();
});

// Close wallet with the 'X' button
closeWalletButton?.addEventListener('click', () => {
    toggleWallet();
});

// Close wallet when clicking outside of it
document.addEventListener('click', (event) => {
    if (walletPopup?.classList.contains('show') && !walletPopup.contains(event.target) && event.target !== walletButton) {
        walletPopup.classList.remove('show');
    }
});

// --- Copy to Clipboard Logic ---
document.getElementById('copyButton')?.addEventListener('click', function() {
    const walletAddressInput = document.getElementById('walletAddress');
    navigator.clipboard.writeText(walletAddressInput.value).then(() => {
        const copyButton = document.getElementById('copyButton');
        const originalIcon = copyButton.innerHTML;
        copyButton.innerHTML = '<i class="bi bi-check-lg text-success"></i>';
        copyButton.title = 'Copied!';
        setTimeout(() => {
            copyButton.innerHTML = originalIcon;
            copyButton.title = 'Copy to clipboard';
        }, 2000);
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
});

// --- Send Transaction UI Logic ---
const sendForm = document.getElementById('send-form');
sendForm?.addEventListener('submit', function() {
    const sendButton = document.getElementById('send-button');
    const spinner = sendButton.querySelector('.spinner-border');
    const buttonText = sendButton.querySelector('.button-text');

    // Disable button and show spinner
    sendButton.disabled = true;
    spinner.style.display = 'inline-block';
    buttonText.textContent = 'Processing...';
});

// Chart initialization and polling - guarded so code runs only when Chart.js and canvas are present
(async function initDoraChart() {
  // If Chart is not available (script not loaded) wait a short time for CDN to load
  function getChartConstructor() {
    if (typeof Chart !== 'undefined') return Chart;
    return null;
  }

  const canvas = document.getElementById('doraChart');
  if (!canvas) return; // nothing to do on other pages

  // Wait for Chart to be available (max ~2s)
  const chartCtor = await new Promise((resolve) => {
    const check = () => {
      const C = getChartConstructor();
      if (C) return resolve(C);
      // wait a bit and retry
      setTimeout(check, 100);
    };
    check();
  });

  const ctx = canvas.getContext('2d');

  // helper to fetch history with limit
  async function fetchHistory(limit = 100){
    const r = await fetch(`/dashboard/api/price/history?limit=${limit}`);
    if (!r.ok) throw new Error('History fetch failed');
    return r.json();
  }

  // initial load
  let rows;
  try {
    rows = await fetchHistory(100);
  } catch (err) {
    console.error('Could not load price history:', err);
    return;
  }

  // transform to time-series points (assumes created_at exists). Use ISO dates for accuracy.
  const points = rows.map(r => ({ x: new Date(r.time), y: Number(r.price) }));

  // update current price display
  const currentPriceEl = document.getElementById('currentPrice');
  if (currentPriceEl && rows.length) currentPriceEl.textContent = Number(rows[rows.length - 1].price).toFixed(6);

  // create a gradient for the stroke and fill
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, 'rgba(6, 78, 59, 0.9)');
  gradient.addColorStop(0.5, 'rgba(6, 78, 59, 0.4)');
  gradient.addColorStop(1, 'rgba(6, 78, 59, 0.05)');

  const chart = new chartCtor(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'DORA Price',
        data: points,
        borderColor: '#0c6b4a',
        backgroundColor: gradient,
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 0,
        pointHoverRadius: 4,
        hoverBorderWidth: 1,
        fill: true,
      }]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'minute',
            displayFormats: {
              millisecond: 'HH:mm:ss',
              second: 'HH:mm:ss',
              minute: 'HH:mm',
              hour: 'HH:mm',
              day: 'MMM d'
            }
          },
          ticks: { maxRotation: 0, autoSkip: true, color: getComputedStyle(document.documentElement).getPropertyValue('--muted') || '#98a0ad' },
          grid: { display: false, color: 'rgba(255,255,255,0.03)' }
        },
        y: {
          beginAtZero: false,
          ticks: {
            callback: function(value) {
              return Number(value).toFixed(6);
            }
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              const v = context.parsed.y;
              return `Price: ${Number(v).toFixed(6)}`;
            },
            title: function(items) {
              // items is an array; format the timestamp
              if (!items.length) return '';
              const dt = items[0].parsed.x || items[0].raw.x;
              return new Date(dt).toLocaleString();
            }
          }
        }
      }
    }
  });

  // Apply initial color settings from CSS variables
  function applyChartColors() {
    const root = document.documentElement;
    const text = getComputedStyle(root).getPropertyValue('--text').trim() || '#e6eef6';
    const muted = getComputedStyle(root).getPropertyValue('--muted').trim() || '#98a0ad';
    // axis and tooltip colors
    chart.options.scales.x.ticks.color = muted;
    chart.options.scales.y.ticks.color = muted;
    chart.options.scales.x.grid.color = 'rgba(255,255,255,0.03)';
    chart.options.plugins.tooltip.titleColor = text;
    chart.options.plugins.tooltip.bodyColor = text;
    chart.options.color = text;
    chart.update();
  }
  applyChartColors();
  // expose hooks for theme update
  try { canvas._chartInstance = chart; chart.applyChartColors = applyChartColors; } catch(e){}

  // Range selector wiring
  const rangeSelector = document.getElementById('rangeSelector');
  // map range value (minutes) to a sensible limit for server fetch
  // and to a target sliding window size (maxPoints) to display the most recent timestamps
  const rangeConfig = (minutes) => {
    // For 1m/5m show fewer points (e.g., 20-60), for 1h show a few hundred, for 1D show more
    if (minutes <= 1) return { limit: 120, maxPoints: 20, unit: 'second' };
    if (minutes <= 5) return { limit: 240, maxPoints: 60, unit: 'second' };
    if (minutes <= 60) return { limit: 600, maxPoints: 240, unit: 'minute' };
    return { limit: 1440, maxPoints: 1440, unit: 'hour' };
  };

  rangeSelector?.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-range]');
    if (!btn) return;
    // toggle active class
    Array.from(rangeSelector.querySelectorAll('button')).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const minutes = parseInt(btn.getAttribute('data-range'), 10);
    const cfg = rangeConfig(minutes);
    try {
      const newRows = await fetchHistory(cfg.limit);
      // rebuild points and reset chart data
      const newPoints = newRows.map(r => ({ x: new Date(r.time), y: Number(r.price) }));
      chart.data.datasets[0].data = newPoints;
      // set time unit for axis
      chart.options.scales.x.time.unit = cfg.unit;
      // update the active sliding window size used by the poller
      chart._maxPoints = cfg.maxPoints || 200;
      // enforce the sliding window immediately
      while (chart.data.datasets[0].data.length > chart._maxPoints) chart.data.datasets[0].data.shift();
      chart.update('none');
    } catch (err) {
      console.error('Range fetch failed', err);
    }
  });

  // polling for new points (request recent rows after last id). Fallback: re-fetch history when /api/price/latest not available
  let lastId = rows.length ? rows[rows.length - 1].id : 0;
  // default sliding window size (can be changed by range selector)
  chart._maxPoints = 200;
  const poll = async () => {
    try {
  const r = await fetch(`/dashboard/api/price/latest?after=${lastId}`);
      if (r.status === 404) {
        // endpoint not implemented on server; fallback to fetching full history and diffing by id
  const full = await fetch('/dashboard/api/price/history?limit=200');
        if (!full.ok) return;
        const fullRows = await full.json();
        const newRows = fullRows.filter(fr => fr.id > lastId);
        if (newRows.length === 0) return;
        newRows.forEach(pt => {
          chart.data.datasets[0].data.push({ x: new Date(pt.time), y: Number(pt.price) });
          lastId = pt.id;
        });
      } else {
        if (!r.ok) return;
        const newRows = await r.json();
        if (!Array.isArray(newRows) || newRows.length === 0) return;
        newRows.forEach(pt => {
          chart.data.datasets[0].data.push({ x: new Date(pt.time), y: Number(pt.price) });
          lastId = pt.id;
        });
      }

      // update current price display
      if (currentPriceEl) {
        const last = chart.data.datasets[0].data[chart.data.datasets[0].data.length - 1];
        const lastVal = last ? (last.y ?? last) : null;
        if (lastVal !== null && typeof lastVal !== 'undefined') currentPriceEl.textContent = Number(lastVal).toFixed(6);
      }

      // keep a sliding window sized by the active range
      const maxPoints = chart._maxPoints || 200;
      while (chart.data.datasets[0].data.length > maxPoints) chart.data.datasets[0].data.shift();
      chart.update('none');
    } catch (err) {
      console.error('Polling error', err);
    }
  };

  // Start polling every 15s
  setInterval(poll, 15000);
})();

// Theme toggle handling (settings page)
(function themeToggleSetup() {
  const themeToggle = document.getElementById('themeToggle');
  const root = document.documentElement || document.body;
  const applyTheme = (isLight) => {
    if (isLight) root.classList.add('light-theme'); else root.classList.remove('light-theme');
  };

  // initialize from localStorage
  const stored = localStorage.getItem('dora_theme');
  const isLight = stored === 'light';
  applyTheme(isLight);
  if (themeToggle) themeToggle.checked = isLight;

  // wire toggle
  themeToggle?.addEventListener('change', (e) => {
    const nowLight = e.target.checked;
    applyTheme(nowLight);
    localStorage.setItem('dora_theme', nowLight ? 'light' : 'dark');
    // notify other components on same page
    window.dispatchEvent(new Event('dora-theme-changed'));
  });
})();

// If a chart exists on the page, re-apply its colors when theme changes
window.addEventListener('dora-theme-changed', () => {
  // find chart instance registered by Chart.js (Chart.instances is internal — instead try to find by canvas)
  try {
    const canvas = document.getElementById('doraChart');
    if (!canvas) return;
    const chart = canvas && canvas._chartInstance; // we don't set this; fallback below
    if (chart && typeof chart.updateColors === 'function') return chart.updateColors();
    // fallback: try to find Chart via Chart.getChart
    if (typeof Chart !== 'undefined' && Chart.getChart) {
      const c = Chart.getChart(canvas);
      if (c) {
        // reuse existing applyChartColors if present
        if (typeof c.applyChartColors === 'function') return c.applyChartColors();
        // Otherwise a simple force update by toggling options
        c.options.scales.x.ticks.color = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
        c.options.scales.y.ticks.color = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
        c.update();
      }
    }
  } catch (err) {
    // ignore
  }
});









