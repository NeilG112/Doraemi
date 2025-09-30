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

  // Wait for Chart to be available
  const chartCtor = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Chart.js library did not load in time."));
    }, 3000); // 3-second timeout

    const check = () => {
      const C = getChartConstructor();
      if (C) {
        clearTimeout(timeout);
        resolve(C);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  }).catch(err => {
    console.error(err);
    // Try to inform the user on the canvas itself
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.font = '16px sans-serif';
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--danger') || 'red';
            ctx.fillText('Error: Could not load chart library.', 10, 30);
        }
    }
    return null;
  });

  if (!chartCtor) return; // Stop if chart library failed to load

  const ctx = canvas.getContext('2d');

  // --- Chart Helper Functions ---
  function getIntervalMinutes(resolution) {
    if (resolution.includes('1m')) return 1;
    if (resolution.includes('5m')) return 5;
    if (resolution.includes('1h')) return 60;
    if (resolution.includes('1d')) return 1440; // 60 * 24
    return 1; // Default to 1 minute
  }

  function getBucketTime(timestamp, intervalMinutes) {
      const date = new Date(timestamp);
      if (intervalMinutes < 60) { // Minute-based intervals
          const newMinutes = Math.floor(date.getMinutes() / intervalMinutes) * intervalMinutes;
          date.setMinutes(newMinutes, 0, 0);
      } else if (intervalMinutes < 1440) { // Hour-based
          date.setHours(date.getHours(), 0, 0, 0);
      } else { // Day-based
          date.setHours(0, 0, 0, 0);
      }
      return date.getTime();
  }

  // helper to fetch history with limit
  async function fetchHistory(limit = 100, resolution = '1h_ohlc'){
    const r = await fetch(`/dashboard/api/price/history?limit=${limit}&resolution=${resolution}`);
    if (!r.ok) throw new Error('History fetch failed');
    return r.json();
  }

  // initial load
  let rows;
  try {
    // Default to 1h candles for the last 5 days
    rows = await fetchHistory(120, '1h_ohlc');
  } catch (err) {
    console.error('Could not load price history:', err);
    return;
  }

  // transform to OHLC points.
  const points = rows.map(r => ({
    x: new Date(r.time).valueOf(),
    o: Number(r.open), h: Number(r.high), l: Number(r.low), c: Number(r.close)
  }));

  // update current price display
  const currentPriceEl = document.getElementById('currentPrice');
  if (currentPriceEl && points.length) currentPriceEl.textContent = Number(points[points.length - 1].c).toFixed(6);

  const candlestickDatasetOptions = {
    borderColor: '#98a0ad',
    borderWidth: 1,
    hoverBorderWidth: 2,
    hoverBorderColor: '#e6eef6', // Matches --text color
    backgroundColor: (ctx) => {
        if (!ctx.raw) return 'rgba(75, 192, 192, 0.7)';
        const { o, c } = ctx.raw;
        return c >= o ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)';
    },
  };

  const chart = new chartCtor(ctx, {
    type: 'candlestick',
    data: {
      datasets: [{
        label: 'DORA Price',
        data: points,
        ...candlestickDatasetOptions
      }]
    },
    options: {
      animation: true, // Enable animations for smoother transitions
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'hour', // Default unit for initial load
            tooltipFormat: 'MMM d, yyyy HH:mm:ss', // More detailed tooltip title
            displayFormats: {
              minute: 'HH:mm',
              hour: 'MMM d, HH:mm',
              day: 'MMM d',
              week: 'MMM d, yyyy',
              month: 'MMM yyyy'
            }
          },
          ticks: { maxRotation: 0, autoSkip: true, color: getComputedStyle(document.documentElement).getPropertyValue('--muted') || '#98a0ad' },
          grid: { display: false, color: 'rgba(255,255,255,0.03)' }
        },
        y: {
          beginAtZero: false,
          ticks: {
            callback: (value) => Number(value).toFixed(6)
          },
          grid: {
            color: 'rgba(255,255,255,0.05)',
            borderColor: 'transparent'
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          intersect: false,
          mode: 'index',
          callbacks: {
            label: (context) => {
                const { o, h, l, c } = context.raw;
                // Using an array of strings creates a multi-line label
                return [
                    `Open:  ${o.toFixed(6)}`,
                    `High:  ${h.toFixed(6)}`,
                    `Low:   ${l.toFixed(6)}`,
                    `Close: ${c.toFixed(6)}`
                ];
            }
            // Title is now handled by the `tooltipFormat` option in the x-axis scale
          }
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',
            onPanComplete: ({chart}) => chart.update('none') // Update chart after pan
          },
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true
            },
            mode: 'x',
            onZoomComplete: ({chart}) => chart.update('none') // Update chart after zoom
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
  const rangeConfig = (minutes) => {
    if (minutes <= 1) return { limit: 60, unit: 'minute', resolution: '1m_ohlc' };   // 1h of 1m candles
    if (minutes <= 5) return { limit: 144, unit: 'minute', resolution: '5m_ohlc' };  // 12h of 5m candles
    if (minutes <= 60) return { limit: 120, unit: 'hour', resolution: '1h_ohlc' };   // 5 days of 1h candles
    return { limit: 90, unit: 'day', resolution: '1d_ohlc' };      // 90 days of 1d candles
  };

  rangeSelector?.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-range]');
    if (!btn) return;
    // toggle active class
    Array.from(rangeSelector.querySelectorAll('button')).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const minutes = parseInt(btn.getAttribute('data-range'), 10);
    const cfg = rangeConfig(minutes);
    chart.resetZoom(); // Reset zoom when changing timeframe
    try {
      const newRows = await fetchHistory(cfg.limit, cfg.resolution);
      const newPoints = newRows.map(r => ({
        x: new Date(r.time).valueOf(),
        o: Number(r.open), h: Number(r.high), l: Number(r.low), c: Number(r.close)
      }));
      chart.data.datasets[0].data = newPoints;
      // set time unit for axis
      chart.options.scales.x.time.unit = cfg.unit;
      // Store current resolution for polling logic
      chart._currentResolution = cfg.resolution;
      chart.update('none');
    } catch (err) {
      console.error('Range fetch failed', err);
    }
  });

  // Set initial resolution
  chart._currentResolution = '1h_ohlc';

  // polling for new points (request recent rows after last id).
  let lastId = rows.length ? rows[rows.length - 1].last_id : 0;
  const poll = async () => {
    try {
      const r = await fetch(`/dashboard/api/price/latest?after=${lastId}`);
      if (!r.ok) return;
      const newRows = await r.json();
      if (!Array.isArray(newRows) || newRows.length === 0) return;

      const currentResolution = chart._currentResolution;
      const intervalMinutes = getIntervalMinutes(currentResolution);
      const candles = chart.data.datasets[0].data;
      let lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;

      newRows.forEach(pt => {
          const pointTime = new Date(pt.timestamp).getTime();
          const price = Number(pt.price);
          lastId = pt.id;

          const bucketTime = getBucketTime(pointTime, intervalMinutes);

          if (!lastCandle || bucketTime > lastCandle.x) {
              // This point belongs to a new candle.
              const newCandle = { x: bucketTime, o: price, h: price, l: price, c: price };
              candles.push(newCandle);
              lastCandle = newCandle;
          } else if (bucketTime === lastCandle.x) {
              // This point belongs to the most recent candle, so update it.
              lastCandle.h = Math.max(lastCandle.h, price);
              lastCandle.l = Math.min(lastCandle.l, price);
              lastCandle.c = price;
          } else {
              // This point is for an older candle, which can happen with slight network delays.
              // For this implementation, we will ignore it to keep the logic simple.
          }
      });

      // update current price display
      if (currentPriceEl) {
        const data = chart.data.datasets[0].data;
        const lastPoint = data.length ? data[data.length - 1] : null;
        if (lastPoint) {
            const price = lastPoint.c;
            if (price !== null && typeof price !== 'undefined') {
                currentPriceEl.textContent = Number(price).toFixed(6);
            }
        }
      }

      // Use default animation ('normal') to make the live update visible and smooth
      chart.update();
    } catch (err) {
      console.error('Polling error', err);
    }
  };

  // Start polling frequently to catch new data points quickly.
  // The backend data script only generates a new point every 15s.
  setInterval(poll, 2000); // Poll every 2 seconds
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
