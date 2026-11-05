// CCTV Site Infrastructure Visualizer Application Logic

let state = {
  cameras: [],
  poles: {},
  racks: {},
  summary: {},
  selectedCameraId: null,
  selectedDeviceId: null,
  mode: 'overlay', // 'overlay', 'schematic', 'split'
  filters: {
    status: 'all',
    zone: 'all',
    rack: 'all',
    pole: 'all',
    search: ''
  },
  layers: {
    cameras: true,
    poles: true,
    racks: true,
    lines: true,
    cones: true
  },
  panZoom: {
    scale: 0.85,
    x: 0,
    y: 0,
    minScale: 0.2,
    maxScale: 4.5
  },
  charts: {
    status: null,
    racks: null
  }
};

// Application Bootstrap
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();

  await loadAllData();
  setupPointerPanZoom();
  setupEventListeners();
  renderMap();
  renderTable();
  renderRacksTab();
  initCharts();

  // Recalculate center once container is rendered in layout
  setTimeout(() => centerStage(false), 80);

  // Resize handler to re-center or adjust responsive layout
  window.addEventListener('resize', () => {
    centerStage(false);
  });
});

// Load Data from Node.js REST API
async function loadAllData() {
  try {
    const [camsRes, polesRes, racksRes, summaryRes] = await Promise.all([
      fetch('/api/cameras'),
      fetch('/api/poles'),
      fetch('/api/racks'),
      fetch('/api/summary')
    ]);

    state.cameras = await camsRes.json();
    state.poles = await polesRes.json();
    state.racks = await racksRes.json();
    state.summary = await summaryRes.json();

    updateKPIRibbon();
    populatePoleDropdown();
  } catch (err) {
    console.error('Failed to load data:', err);
  }
}

// Update KPI Ribbon counters
function updateKPIRibbon() {
  const { totalCameras, working, cableIssue, defective } = state.summary;
  document.getElementById('statTotalCameras').textContent = totalCameras;
  document.getElementById('statWorking').textContent = working;
  document.getElementById('statWorkingPct').textContent = `${((working / totalCameras) * 100).toFixed(1)}%`;
  
  document.getElementById('statCableIssue').textContent = cableIssue;
  document.getElementById('statCableIssuePct').textContent = `${((cableIssue / totalCameras) * 100).toFixed(1)}%`;

  document.getElementById('statDefective').textContent = defective;
  document.getElementById('statDefectivePct').textContent = `${((defective / totalCameras) * 100).toFixed(1)}%`;
}

// Populate Pole Selector Dropdown
function populatePoleDropdown() {
  const sel = document.getElementById('selectPole');
  if (!sel) return;
  sel.innerHTML = '<option value="all">All Poles (P1 - P32)</option>';
  for (let i = 1; i <= 32; i++) {
    const poleId = `P${i}`;
    const p = state.poles[poleId];
    const opt = document.createElement('option');
    opt.value = poleId;
    opt.textContent = `${poleId} (${p ? p.cameraCount : 0} Cams) - ${p ? p.zone : ''}`;
    sel.appendChild(opt);
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Mode toggles
  document.getElementById('btnModeOverlay').addEventListener('click', () => setMode('overlay'));
  document.getElementById('btnModeSchematic').addEventListener('click', () => setMode('schematic'));
  document.getElementById('btnModeSplit').addEventListener('click', () => setMode('split'));

  // Mobile filters toggle
  const btnToggleFilters = document.getElementById('btnToggleFilters');
  if (btnToggleFilters) {
    btnToggleFilters.addEventListener('click', () => {
      const tb = document.getElementById('filterToolbar');
      tb.classList.toggle('hidden');
    });
  }

  // Layer toggles
  ['chkCams', 'chkPoles', 'chkRacks', 'chkLines', 'chkCones'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', (e) => {
        const key = id.replace('chk', '').toLowerCase();
        state.layers[key] = e.target.checked;
        renderMap();
      });
    }
  });

  // Scan Opacity
  const scanOpacity = document.getElementById('scanOpacity');
  if (scanOpacity) {
    scanOpacity.addEventListener('input', (e) => {
      const opacity = e.target.value / 100;
      document.getElementById('blueprintImage').style.opacity = opacity;
    });
  }

  // Search input
  const searchInput = document.getElementById('searchInput');
  const clearSearch = document.getElementById('clearSearch');
  searchInput.addEventListener('input', (e) => {
    state.filters.search = e.target.value.trim().toLowerCase();
    clearSearch.classList.toggle('hidden', state.filters.search.length === 0);
    renderMap();
    renderTable();
  });
  clearSearch.addEventListener('click', () => {
    searchInput.value = '';
    state.filters.search = '';
    clearSearch.classList.add('hidden');
    renderMap();
    renderTable();
  });

  // Table search
  document.getElementById('tableSearchInput').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    renderTable(q);
  });

  // Floating Zoom controls
  document.getElementById('btnZoomIn').addEventListener('click', () => zoomBy(1.25));
  document.getElementById('btnZoomOut').addEventListener('click', () => zoomBy(1 / 1.25));
  document.getElementById('btnZoomReset').addEventListener('click', () => zoomPreset('all'));

  // Reset database button
  document.getElementById('btnResetData').addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all camera changes to the initial extracted map state?')) {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        await loadAllData();
        renderMap();
        renderTable();
        renderRacksTab();
        updateCharts();
        closeInspector();
        alert('Database successfully restored to original survey map state!');
      }
    }
  });
}

// Mode Selector Handler
function setMode(mode) {
  state.mode = mode;
  const overlayBtn = document.getElementById('btnModeOverlay');
  const schematicBtn = document.getElementById('btnModeSchematic');
  const splitBtn = document.getElementById('btnModeSplit');
  const bpImg = document.getElementById('blueprintImage');
  const cadSvg = document.getElementById('cadSchematic');
  const opacityControl = document.getElementById('opacityControl');

  [overlayBtn, schematicBtn, splitBtn].forEach(b => {
    b.className = 'px-2.5 py-1 sm:px-3 sm:py-1.5 rounded font-medium transition-all text-slate-300 hover:text-white flex items-center space-x-1';
  });

  if (mode === 'overlay') {
    overlayBtn.className = 'px-2.5 py-1 sm:px-3 sm:py-1.5 rounded font-medium transition-all bg-cyan-600 text-white shadow-sm flex items-center space-x-1';
    bpImg.style.display = 'block';
    bpImg.style.opacity = document.getElementById('scanOpacity') ? document.getElementById('scanOpacity').value / 100 : 0.85;
    cadSvg.style.display = 'none';
    if (opacityControl) opacityControl.classList.remove('hidden');
  } else if (mode === 'schematic') {
    schematicBtn.className = 'px-2.5 py-1 sm:px-3 sm:py-1.5 rounded font-medium transition-all bg-indigo-600 text-white shadow-sm flex items-center space-x-1';
    bpImg.style.display = 'none';
    cadSvg.style.display = 'block';
    if (opacityControl) opacityControl.classList.add('hidden');
  } else if (mode === 'split') {
    splitBtn.className = 'px-2.5 py-1 sm:px-3 sm:py-1.5 rounded font-medium transition-all bg-emerald-600 text-white shadow-sm flex items-center space-x-1';
    bpImg.style.display = 'block';
    bpImg.style.opacity = '0.45';
    cadSvg.style.display = 'block';
    if (opacityControl) opacityControl.classList.remove('hidden');
  }
}

// =========================================================================
// HIGH-PERFORMANCE POINTER & TOUCH PAN/ZOOM ENGINE (MOBILE & DESKTOP)
// =========================================================================

function setupPointerPanZoom() {
  const container = document.getElementById('mapContainer');
  const stage = document.getElementById('mapStage');

  centerStage(false);

  // Active pointer tracking map: pointerId -> { x, y }
  const activePointers = new Map();
  let isDragging = false;
  let lastPos = { x: 0, y: 0 };
  let initialPinchDist = 0;
  let initialScale = 1;
  let pinchAnchor = { x: 0, y: 0 };
  let lastTapTime = 0;

  // Pointer Down: handles Mouse, Touch, and Stylus
  container.addEventListener('pointerdown', (e) => {
    // If clicking directly on a camera pin, pole pin, rack pin, or button, let that event trigger
    if (e.target.closest('.cam-pin, .pole-pin, .rack-pin, button, select, input, .floating-btn')) {
      return;
    }

    try {
      container.setPointerCapture(e.pointerId);
    } catch (err) {}

    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stage.classList.remove('smooth-transition');

    if (activePointers.size === 1) {
      isDragging = true;
      lastPos = { x: e.clientX, y: e.clientY };
      container.classList.add('grabbing');

      // Double-tap zoom detection
      const now = Date.now();
      if (now - lastTapTime < 300) {
        const rect = container.getBoundingClientRect();
        const tapX = e.clientX - rect.left;
        const tapY = e.clientY - rect.top;
        zoomAtPoint(tapX, tapY, 1.6);
        lastTapTime = 0;
        return;
      }
      lastTapTime = now;

    } else if (activePointers.size === 2) {
      // 2-finger Pinch-to-Zoom initiated
      isDragging = false;
      const pts = Array.from(activePointers.values());
      initialPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialScale = state.panZoom.scale;

      const rect = container.getBoundingClientRect();
      pinchAnchor = {
        x: (pts[0].x + pts[1].x) / 2 - rect.left,
        y: (pts[0].y + pts[1].y) / 2 - rect.top,
        panX: state.panZoom.x,
        panY: state.panZoom.y
      };
    }
  });

  // Pointer Move
  container.addEventListener('pointermove', (e) => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1 && isDragging) {
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      lastPos = { x: e.clientX, y: e.clientY };

      state.panZoom.x += dx;
      state.panZoom.y += dy;
      applyTransform(false);

    } else if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);

      if (initialPinchDist > 5 && currentDist > 5) {
        const pinchRatio = currentDist / initialPinchDist;
        const targetScale = Math.min(Math.max(initialScale * pinchRatio, state.panZoom.minScale), state.panZoom.maxScale);

        const rect = container.getBoundingClientRect();
        const currentMid = {
          x: (pts[0].x + pts[1].x) / 2 - rect.left,
          y: (pts[0].y + pts[1].y) / 2 - rect.top
        };

        // Smooth zoom relative to pinch midpoint
        state.panZoom.x = currentMid.x - (pinchAnchor.x - pinchAnchor.panX) * (targetScale / initialScale);
        state.panZoom.y = currentMid.y - (pinchAnchor.y - pinchAnchor.panY) * (targetScale / initialScale);
        state.panZoom.scale = targetScale;
        applyTransform(false);
      }
    }
  });

  // Pointer End / Cancel
  const handlePointerEnd = (e) => {
    activePointers.delete(e.pointerId);
    try {
      container.releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (activePointers.size === 0) {
      isDragging = false;
      container.classList.remove('grabbing');
    } else if (activePointers.size === 1) {
      const remaining = Array.from(activePointers.values())[0];
      lastPos = { x: remaining.x, y: remaining.y };
      isDragging = true;
    }
  };

  container.addEventListener('pointerup', handlePointerEnd);
  container.addEventListener('pointercancel', handlePointerEnd);
  container.addEventListener('pointerleave', handlePointerEnd);

  // Mouse Wheel Zoom (Symmetric & Anchored at Cursor)
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.18 : (1 / 1.18);
    const rect = container.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    zoomAtPoint(cursorX, cursorY, zoomFactor);
  }, { passive: false });
}

// Zoom centered on a specific viewport coordinate (px, py)
function zoomAtPoint(viewportX, viewportY, factor) {
  const currentScale = state.panZoom.scale;
  const newScale = Math.min(Math.max(currentScale * factor, state.panZoom.minScale), state.panZoom.maxScale);

  // Adjust translation so the point under cursor/touch stays in place
  state.panZoom.x = viewportX - (viewportX - state.panZoom.x) * (newScale / currentScale);
  state.panZoom.y = viewportY - (viewportY - state.panZoom.y) * (newScale / currentScale);
  state.panZoom.scale = newScale;

  applyTransform(false);
}

// Center and fit stage to container
function centerStage(smooth = true) {
  const container = document.getElementById('mapContainer');
  if (!container) return;
  const containerW = container.clientWidth;
  const containerH = container.clientHeight;
  const stageW = 768;
  const stageH = 1024;

  if (containerW <= 0 || containerH <= 0) return;

  const scale = Math.min((containerW - 16) / stageW, (containerH - 16) / stageH);
  state.panZoom.scale = Math.min(Math.max(scale, state.panZoom.minScale), 1.0);
  state.panZoom.x = (containerW - stageW * state.panZoom.scale) / 2;
  state.panZoom.y = (containerH - stageH * state.panZoom.scale) / 2;
  applyTransform(smooth);
}

// Apply 3D GPU Accelerated Transform
function applyTransform(smooth = false) {
  const stage = document.getElementById('mapStage');
  if (!stage) return;

  if (smooth) {
    stage.classList.add('smooth-transition');
  } else {
    stage.classList.remove('smooth-transition');
  }

  stage.style.transform = `translate3d(${state.panZoom.x.toFixed(1)}px, ${state.panZoom.y.toFixed(1)}px, 0) scale(${state.panZoom.scale.toFixed(3)})`;
  
  const indicator = document.getElementById('zoomIndicator');
  if (indicator) {
    indicator.textContent = `${Math.round(state.panZoom.scale * 100)}%`;
  }
}

// Zoom by factor from screen center
function zoomBy(factor) {
  const container = document.getElementById('mapContainer');
  const cx = container.clientWidth / 2;
  const cy = container.clientHeight / 2;
  zoomAtPoint(cx, cy, factor);
}

// Preset Camera Zooms
function zoomPreset(preset) {
  if (preset === 'all') {
    centerStage(true);
  } else if (preset === 'mainGate') {
    focusPoint(580, 800, 1.5);
  } else if (preset === 'rearGate') {
    focusPoint(150, 150, 1.5);
  } else if (preset === 'courtyard') {
    focusPoint(450, 450, 1.5);
  }
}

function focusPoint(px, py, targetScale) {
  const container = document.getElementById('mapContainer');
  const cx = container.clientWidth / 2;
  const cy = container.clientHeight / 2;
  state.panZoom.scale = targetScale;
  state.panZoom.x = cx - px * targetScale;
  state.panZoom.y = cy - py * targetScale;
  applyTransform(true);
}

// =========================================================================
// FILTERS & SELECTION LOGIC
// =========================================================================

function setFilter(type, value) {
  state.filters[type] = value;
  
  if (type === 'status') {
    document.querySelectorAll('.status-btn').forEach(btn => {
      const s = btn.getAttribute('data-status');
      if (s === value) {
        btn.className = 'status-btn px-2 sm:px-2.5 py-1 rounded font-medium transition-all bg-slate-700 text-white';
      } else {
        btn.className = `status-btn px-2 sm:px-2.5 py-1 rounded font-medium transition-all ${
          s === 'Working' ? 'text-emerald-400' : s === 'Cable issue' ? 'text-rose-400' : s === 'Defective' ? 'text-blue-400' : 'text-slate-400'
        } hover:bg-slate-700/60`;
      }
    });
  }

  renderMap();
  renderTable();
}

function quickFilterStatus(status) {
  setFilter('status', status);
}

function matchesFilter(cam) {
  const f = state.filters;
  if (f.status !== 'all' && cam.status.toLowerCase() !== f.status.toLowerCase()) return false;
  if (f.zone !== 'all' && cam.zone.toLowerCase() !== f.zone.toLowerCase()) return false;
  if (f.rack !== 'all' && cam.rack.toLowerCase() !== f.rack.toLowerCase()) return false;
  if (f.pole !== 'all' && cam.pole.toLowerCase() !== f.pole.toLowerCase()) return false;
  if (f.search) {
    const q = f.search;
    const match = cam.id.toString() === q ||
      cam.camCode.toLowerCase().includes(q) ||
      cam.pole.toLowerCase().includes(q) ||
      cam.rack.toLowerCase().includes(q) ||
      cam.status.toLowerCase().includes(q) ||
      cam.locationDesc.toLowerCase().includes(q) ||
      cam.ipAddress.includes(q);
    if (!match) return false;
  }
  return true;
}

// Render Map Elements (Cables, Poles, Racks, Cameras)
function renderMap() {
  const markersContainer = document.getElementById('interactiveMarkers');
  const svgCables = document.getElementById('svgCables');
  if (!markersContainer || !svgCables) return;

  markersContainer.innerHTML = '';
  svgCables.innerHTML = '';

  const { cameras, poles, racks, layers, selectedCameraId, selectedDeviceId } = state;

  // 1. Render Cable Connections (SVG lines)
  if (layers.lines) {
    cameras.forEach(cam => {
      if (!matchesFilter(cam)) return;

      const rack = racks[cam.rack];
      const isHighlight = (selectedCameraId === cam.id) || 
                          (selectedDeviceId && (selectedDeviceId === cam.pole || selectedDeviceId === cam.rack));

      if (rack && isHighlight) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', rack.x);
        line.setAttribute('y1', rack.y);
        line.setAttribute('x2', cam.x);
        line.setAttribute('y2', cam.y);
        line.setAttribute('stroke', cam.status === 'Working' ? '#10b981' : cam.status === 'Cable issue' ? '#ef4444' : '#3b82f6');
        line.setAttribute('stroke-width', '2.5');
        line.setAttribute('stroke-dasharray', cam.status === 'Cable issue' ? '5 3' : 'none');
        line.setAttribute('opacity', '0.85');
        svgCables.appendChild(line);
      }
    });
  }

  // 2. Render Network Racks
  if (layers.racks) {
    Object.entries(racks).forEach(([rackId, r]) => {
      const isSelected = selectedDeviceId === rackId;
      const rackEl = document.createElement('div');
      rackEl.className = `rack-pin absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-150 z-20 ${
        isSelected ? 'ring-4 ring-cyan-400 scale-125 z-40' : 'hover:scale-115'
      }`;
      rackEl.style.left = `${r.x}px`;
      rackEl.style.top = `${r.y}px`;

      const isOuter = rackId.startsWith('OR');
      const badgeBg = isOuter ? 'bg-cyan-900/90 text-cyan-300 border-cyan-400' : 'bg-amber-900/90 text-amber-300 border-amber-400';

      rackEl.innerHTML = `
        <div class="flex items-center space-x-1 px-1.5 py-0.5 rounded shadow-lg border ${badgeBg} backdrop-blur-sm pointer-events-none">
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M4 4h16v4H4V4zm0 6h16v4H4v-4zm0 6h16v4H4v-4z"/></svg>
          <span class="text-[10px] font-extrabold tracking-tight">${rackId}</span>
        </div>
      `;

      rackEl.addEventListener('click', (e) => {
        e.stopPropagation();
        selectRack(rackId);
      });

      markersContainer.appendChild(rackEl);
    });
  }

  // 3. Render Support Poles (P1 - P32)
  if (layers.poles) {
    Object.entries(poles).forEach(([poleId, p]) => {
      const isSelected = selectedDeviceId === poleId;
      const poleEl = document.createElement('div');
      poleEl.className = `pole-pin absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-150 z-10 ${
        isSelected ? 'ring-4 ring-purple-400 scale-125 z-40' : 'hover:scale-115'
      }`;
      poleEl.style.left = `${p.x}px`;
      poleEl.style.top = `${p.y}px`;

      poleEl.innerHTML = `
        <div class="w-6 h-6 rounded-md bg-purple-950/90 border border-purple-400 text-purple-200 flex items-center justify-center text-[10px] font-bold shadow-lg backdrop-blur-sm pointer-events-none">
          ${poleId.replace('P', '')}
        </div>
      `;

      poleEl.addEventListener('click', (e) => {
        e.stopPropagation();
        selectPole(poleId);
      });

      markersContainer.appendChild(poleEl);
    });
  }

  // 4. Render Cameras
  if (layers.cameras) {
    cameras.forEach(cam => {
      if (!matchesFilter(cam)) return;

      const isSelected = selectedCameraId === cam.id;

      let colorClass = 'bg-emerald-500 border-emerald-300 text-slate-950 pulse-green';
      let haloColor = 'rgba(16, 185, 129, 0.4)';
      if (cam.status === 'Cable issue') {
        colorClass = 'bg-rose-500 border-rose-300 text-white pulse-red';
        haloColor = 'rgba(239, 68, 68, 0.5)';
      } else if (cam.status === 'Defective') {
        colorClass = 'bg-blue-500 border-blue-300 text-white pulse-blue';
        haloColor = 'rgba(59, 130, 246, 0.5)';
      }

      const camEl = document.createElement('div');
      camEl.className = `cam-pin absolute transform -translate-x-1/2 -translate-y-1/2 z-30 ${
        isSelected ? 'scale-150 z-50 ring-4 ring-white' : ''
      }`;
      camEl.style.left = `${cam.x}px`;
      camEl.style.top = `${cam.y}px`;

      let coneSvg = '';
      if (layers.cones) {
        const rad = (cam.angle * Math.PI) / 180;
        const dx = Math.cos(rad) * 22;
        const dy = Math.sin(rad) * 22;
        coneSvg = `
          <svg class="absolute -top-3 -left-3 w-12 h-12 pointer-events-none" viewBox="-24 -24 48 48">
            <line x1="0" y1="0" x2="${dx}" y2="${dy}" stroke="${haloColor}" stroke-width="3" stroke-linecap="round" />
            <circle cx="${dx}" cy="${dy}" r="2" fill="${haloColor}" />
          </svg>
        `;
      }

      camEl.innerHTML = `
        ${coneSvg}
        <div class="relative w-5 h-5 rounded-full ${colorClass} border-2 flex items-center justify-center text-[9px] font-black shadow-md select-none pointer-events-none" title="Cam ${cam.id} (${cam.status})">
          ${cam.id}
        </div>
      `;

      camEl.addEventListener('click', (e) => {
        e.stopPropagation();
        selectCamera(cam.id);
      });

      markersContainer.appendChild(camEl);
    });
  }
}

// Select and Inspect Camera
function selectCamera(id) {
  state.selectedCameraId = id;
  state.selectedDeviceId = null;

  const cam = state.cameras.find(c => c.id === id);
  if (!cam) return;

  renderMap();
  focusPoint(cam.x, cam.y, Math.max(state.panZoom.scale, 1.4));

  // Open side panel / mobile bottom sheet
  const sidePanel = document.getElementById('sidePanel');
  const backdrop = document.getElementById('mobileDrawerBackdrop');
  if (sidePanel) sidePanel.classList.add('mobile-open');
  if (backdrop) backdrop.classList.add('visible');

  document.getElementById('panelEmpty').classList.add('hidden');
  document.getElementById('panelDevice').classList.add('hidden');
  const pnl = document.getElementById('panelCamera');
  pnl.classList.remove('hidden');

  document.getElementById('camCardTitle').textContent = `${cam.camCode} (#${cam.id})`;
  document.getElementById('camCardZone').textContent = cam.zone;
  document.getElementById('camCardLocation').textContent = cam.locationDesc;

  const badge = document.getElementById('camCardBadge');
  badge.textContent = cam.status;
  if (cam.status === 'Working') {
    badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider badge-working';
  } else if (cam.status === 'Cable issue') {
    badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider badge-cable';
  } else {
    badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider badge-defect';
  }

  const cropImg = document.getElementById('camCropImg');
  cropImg.src = cam.cropUrl;
  document.getElementById('camCropCoords').textContent = `X=${cam.x}px, Y=${cam.y}px (${cam.xPct}%, ${cam.yPct}%)`;

  document.getElementById('camCardPole').textContent = cam.pole;
  document.getElementById('camCardRack').textContent = cam.rack;
  document.getElementById('camCardIP').textContent = cam.ipAddress;
  document.getElementById('camCardFOV').textContent = `${cam.angle}° (${getCompassDirection(cam.angle)})`;

  document.getElementById('camCardFault').textContent = cam.fault || 'None reported';
  document.getElementById('camCardAction').textContent = cam.action || 'Routine inspection';
  document.getElementById('camCardNotes').value = cam.notes || '';

  if (window.lucide) lucide.createIcons();
}

function getCompassDirection(angle) {
  if (angle >= 337.5 || angle < 22.5) return 'East';
  if (angle >= 22.5 && angle < 67.5) return 'South-East';
  if (angle >= 67.5 && angle < 112.5) return 'South';
  if (angle >= 112.5 && angle < 157.5) return 'South-West';
  if (angle >= 157.5 && angle < 202.5) return 'West';
  if (angle >= 202.5 && angle < 247.5) return 'North-West';
  if (angle >= 247.5 && angle < 292.5) return 'North';
  return 'North-East';
}

// Update Camera Status via API
async function updateCameraStatus(newStatus) {
  if (!state.selectedCameraId) return;
  const id = state.selectedCameraId;

  try {
    const res = await fetch(`/api/cameras/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (res.ok) {
      const data = await res.json();
      const idx = state.cameras.findIndex(c => c.id === id);
      if (idx !== -1) {
        state.cameras[idx] = data.camera;
      }
      state.summary = data.summary;

      updateKPIRibbon();
      selectCamera(id);
      renderMap();
      renderTable();
      renderRacksTab();
      updateCharts();
    }
  } catch (err) {
    console.error('Failed to update status:', err);
  }
}

// Save Technician Notes
async function saveCameraNotes() {
  if (!state.selectedCameraId) return;
  const id = state.selectedCameraId;
  const notes = document.getElementById('camCardNotes').value;

  try {
    const res = await fetch(`/api/cameras/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, technician: 'Field Engineer (Logged)' })
    });

    if (res.ok) {
      alert(`Notes for Camera ${id} saved successfully!`);
      const cam = state.cameras.find(c => c.id === id);
      if (cam) cam.notes = notes;
    }
  } catch (err) {
    console.error('Failed to save notes:', err);
  }
}

// Select Pole
function selectPole(poleId) {
  state.selectedDeviceId = poleId;
  state.selectedCameraId = null;

  const pole = state.poles[poleId];
  if (!pole) return;

  renderMap();
  focusPoint(pole.x, pole.y, 1.4);

  const sidePanel = document.getElementById('sidePanel');
  const backdrop = document.getElementById('mobileDrawerBackdrop');
  if (sidePanel) sidePanel.classList.add('mobile-open');
  if (backdrop) backdrop.classList.add('visible');

  document.getElementById('panelEmpty').classList.add('hidden');
  document.getElementById('panelCamera').classList.add('hidden');
  const pnl = document.getElementById('panelDevice');
  pnl.classList.remove('hidden');

  document.getElementById('devCardType').textContent = 'Support Pole';
  document.getElementById('devCardType').className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30';
  document.getElementById('devCardTitle').textContent = `Pole ${poleId}`;
  document.getElementById('devCardDesc').textContent = pole.desc;

  const specs = document.getElementById('devSpecs');
  specs.innerHTML = `
    <div class="flex justify-between border-b border-slate-700/60 pb-1.5"><span class="text-slate-400">Ring Zone:</span><span class="text-purple-300 font-semibold">${pole.zone}</span></div>
    <div class="flex justify-between border-b border-slate-700/60 pb-1.5"><span class="text-slate-400">Mounted Cams:</span><span class="text-white font-bold">${pole.cameraCount}</span></div>
    <div class="flex justify-between"><span class="text-slate-400">Coordinates:</span><span class="font-mono text-slate-300">X:${pole.x}, Y:${pole.y}</span></div>
  `;

  renderDeviceCameras(pole.cameras);
}

// Select Rack
function selectRack(rackId) {
  state.selectedDeviceId = rackId;
  state.selectedCameraId = null;

  const rack = state.racks[rackId];
  if (!rack) return;

  renderMap();
  focusPoint(rack.x, rack.y, 1.4);

  const sidePanel = document.getElementById('sidePanel');
  const backdrop = document.getElementById('mobileDrawerBackdrop');
  if (sidePanel) sidePanel.classList.add('mobile-open');
  if (backdrop) backdrop.classList.add('visible');

  document.getElementById('panelEmpty').classList.add('hidden');
  document.getElementById('panelCamera').classList.add('hidden');
  const pnl = document.getElementById('panelDevice');
  pnl.classList.remove('hidden');

  const isOuter = rackId.startsWith('OR');
  document.getElementById('devCardType').textContent = isOuter ? 'Outer Ring Rack (OR)' : 'Inner Ring Rack (IR)';
  document.getElementById('devCardType').className = isOuter 
    ? 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
    : 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30';

  document.getElementById('devCardTitle').textContent = `Rack ${rackId}`;
  document.getElementById('devCardDesc').textContent = rack.desc;

  const specs = document.getElementById('devSpecs');
  specs.innerHTML = `
    <div class="flex justify-between border-b border-slate-700/60 pb-1.5"><span class="text-slate-400">Enclosure Type:</span><span class="text-cyan-300 font-medium">${rack.model}</span></div>
    <div class="flex justify-between border-b border-slate-700/60 pb-1.5"><span class="text-slate-400">Switch Model:</span><span class="text-white font-semibold">${rack.switch}</span></div>
    <div class="flex justify-between border-b border-slate-700/60 pb-1.5"><span class="text-slate-400">Connected Cams:</span><span class="text-white font-bold">${rack.cameraCount} (${rack.workingCount} OK, ${rack.issueCount} Issue)</span></div>
    <div class="flex justify-between"><span class="text-slate-400">Hub Location:</span><span class="font-mono text-slate-300">X:${rack.x}, Y:${rack.y}</span></div>
  `;

  renderDeviceCameras(rack.cameras);
}

function renderDeviceCameras(cams) {
  const countEl = document.getElementById('devCamCount');
  countEl.textContent = cams.length;
  const listEl = document.getElementById('devCamList');
  listEl.innerHTML = '';

  if (cams.length === 0) {
    listEl.innerHTML = '<div class="text-xs text-slate-500 italic p-2">No cameras connected.</div>';
    return;
  }

  cams.forEach(c => {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 cursor-pointer border border-slate-700/50 transition-colors text-xs';
    
    let badgeClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (c.status === 'Cable issue') badgeClass = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    else if (c.status === 'Defective') badgeClass = 'text-blue-400 bg-blue-500/10 border-blue-500/30';

    item.innerHTML = `
      <div class="flex items-center space-x-2">
        <span class="font-bold text-white">#${c.id}</span>
        <span class="text-slate-400">${c.code || `CAM-${c.id}`}</span>
      </div>
      <span class="px-2 py-0.5 rounded text-[10px] font-semibold border ${badgeClass}">${c.status}</span>
    `;

    item.addEventListener('click', () => selectCamera(c.id));
    listEl.appendChild(item);
  });
}

function closeInspector() {
  state.selectedCameraId = null;
  state.selectedDeviceId = null;
  const sidePanel = document.getElementById('sidePanel');
  const backdrop = document.getElementById('mobileDrawerBackdrop');
  if (sidePanel) sidePanel.classList.remove('mobile-open');
  if (backdrop) backdrop.classList.remove('visible');

  document.getElementById('panelCamera').classList.add('hidden');
  document.getElementById('panelDevice').classList.add('hidden');
  document.getElementById('panelEmpty').classList.remove('hidden');
  renderMap();
}

function highlightCurrentPole() {
  const cam = state.cameras.find(c => c.id === state.selectedCameraId);
  if (cam && state.poles[cam.pole]) selectPole(cam.pole);
}

function highlightCurrentRack() {
  const cam = state.cameras.find(c => c.id === state.selectedCameraId);
  if (cam && state.racks[cam.rack]) selectRack(cam.rack);
}

// Render Asset Register Table
function renderTable(filterQuery = '') {
  const tbody = document.getElementById('assetTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let list = state.cameras.filter(c => matchesFilter(c));
  if (filterQuery) {
    list = list.filter(c => 
      c.id.toString() === filterQuery ||
      c.camCode.toLowerCase().includes(filterQuery) ||
      c.pole.toLowerCase().includes(filterQuery) ||
      c.rack.toLowerCase().includes(filterQuery) ||
      c.locationDesc.toLowerCase().includes(filterQuery) ||
      c.status.toLowerCase().includes(filterQuery)
    );
  }

  document.getElementById('tableCount').textContent = list.length;

  list.forEach(c => {
    const tr = document.createElement('tr');
    tr.className = 'table-row-hover transition-colors';

    let badgeClass = 'badge-working';
    if (c.status === 'Cable issue') badgeClass = 'badge-cable';
    else if (c.status === 'Defective') badgeClass = 'badge-defect';

    tr.innerHTML = `
      <td class="p-2.5 sm:p-3 font-mono font-bold text-white">${c.id}</td>
      <td class="p-2.5 sm:p-3 font-semibold text-slate-200">${c.camCode}</td>
      <td class="p-2.5 sm:p-3">
        <span class="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold ${badgeClass}">
          ${c.status}
        </span>
      </td>
      <td class="p-2.5 sm:p-3 font-medium text-purple-300">${c.pole}</td>
      <td class="p-2.5 sm:p-3 font-medium text-cyan-300">${c.rack}</td>
      <td class="p-2.5 sm:p-3 text-slate-400">${c.zone}</td>
      <td class="p-2.5 sm:p-3 text-slate-300 max-w-[180px] truncate" title="${c.locationDesc}">${c.locationDesc}</td>
      <td class="p-2.5 sm:p-3 font-mono text-slate-400">${c.ipAddress}</td>
      <td class="p-2.5 sm:p-3 text-rose-300/90 max-w-[160px] truncate" title="${c.fault || ''}">${c.fault || '—'}</td>
      <td class="p-2.5 sm:p-3 text-amber-200/90 max-w-[180px] truncate" title="${c.action || ''}">${c.action || '—'}</td>
      <td class="p-2.5 sm:p-3 text-right">
        <button class="px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white transition-colors text-xs font-semibold" onclick="selectCamera(${c.id}); window.scrollTo({ top: 0, behavior: 'smooth' });">
          Inspect
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Network Racks Tab
function renderRacksTab() {
  const container = document.getElementById('racksGrid');
  if (!container) return;
  container.innerHTML = '';

  Object.entries(state.racks).forEach(([rackId, r]) => {
    const isOuter = rackId.startsWith('OR');
    const borderClass = isOuter ? 'border-cyan-500/30 hover:border-cyan-400' : 'border-amber-500/30 hover:border-amber-400';
    const tagBg = isOuter ? 'bg-cyan-500/15 text-cyan-300' : 'bg-amber-500/15 text-amber-300';

    const card = document.createElement('div');
    card.className = `bg-slate-800/60 rounded-xl p-3.5 sm:p-4 border ${borderClass} transition-all shadow cursor-pointer space-y-2.5`;
    card.onclick = () => {
      switchTab('register');
      selectRack(rackId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const healthPct = r.cameraCount > 0 ? Math.round((r.workingCount / r.cameraCount) * 100) : 100;

    card.innerHTML = `
      <div class="flex items-start justify-between">
        <div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${tagBg}">${isOuter ? 'Outer Ring' : 'Inner Ring'}</span>
          <h4 class="text-sm sm:text-base font-bold text-white mt-1">${rackId} Hub</h4>
        </div>
        <div class="text-right">
          <span class="text-base sm:text-lg font-black ${healthPct === 100 ? 'text-emerald-400' : healthPct > 50 ? 'text-amber-400' : 'text-rose-400'}">${healthPct}%</span>
          <span class="text-[9px] text-slate-400 block">Health</span>
        </div>
      </div>
      <p class="text-xs text-slate-400 line-clamp-2">${r.desc}</p>
      <div class="space-y-1 text-xs pt-1 border-t border-slate-700/60">
        <div class="flex justify-between text-slate-400">
          <span>Connected Cameras:</span>
          <span class="font-bold text-white">${r.cameraCount}</span>
        </div>
        <div class="flex justify-between text-slate-400">
          <span>Working vs Issues:</span>
          <span><span class="text-emerald-400 font-semibold">${r.workingCount} OK</span> / <span class="text-rose-400 font-semibold">${r.issueCount} Issue</span></span>
        </div>
        <div class="flex justify-between text-slate-400">
          <span>Switch Spec:</span>
          <span class="text-slate-300 text-[10px] sm:text-[11px] truncate max-w-[140px]">${r.switch}</span>
        </div>
      </div>
      <div class="w-full bg-slate-700/60 h-2 rounded-full overflow-hidden">
        <div class="bg-emerald-500 h-full" style="width: ${healthPct}%;"></div>
      </div>
    `;

    container.appendChild(card);
  });
}

// Chart.js Analytics
function initCharts() {
  if (typeof Chart === 'undefined') return;
  const ctxStatus = document.getElementById('chartStatus');
  const ctxRacks = document.getElementById('chartRacks');
  if (!ctxStatus || !ctxRacks) return;

  const { working, cableIssue, defective } = state.summary;

  state.charts.status = new Chart(ctxStatus, {
    type: 'doughnut',
    data: {
      labels: ['Working (Normal)', 'Cable Issue', 'Defective'],
      datasets: [{
        data: [working, cableIssue, defective],
        backgroundColor: ['#10b981', '#ef4444', '#3b82f6'],
        borderWidth: 2,
        borderColor: '#1e293b'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', font: { size: 11 } }
        }
      },
      cutout: '65%'
    }
  });

  const rackLabels = Object.keys(state.racks);
  const rackWorking = rackLabels.map(r => state.racks[r].workingCount);
  const rackIssues = rackLabels.map(r => state.racks[r].issueCount);

  state.charts.racks = new Chart(ctxRacks, {
    type: 'bar',
    data: {
      labels: rackLabels,
      datasets: [
        { label: 'Working Cams', data: rackWorking, backgroundColor: '#10b981' },
        { label: 'Fault Cams', data: rackIssues, backgroundColor: '#ef4444' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { stacked: true, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: '#334155' } }
      },
      plugins: {
        legend: { position: 'top', labels: { color: '#94a3b8', font: { size: 11 } } }
      }
    }
  });
}

function updateCharts() {
  if (typeof Chart === 'undefined') return;
  if (state.charts.status) {
    const { working, cableIssue, defective } = state.summary;
    state.charts.status.data.datasets[0].data = [working, cableIssue, defective];
    state.charts.status.update();
  }

  if (state.charts.racks) {
    const rackLabels = Object.keys(state.racks);
    state.charts.racks.data.datasets[0].data = rackLabels.map(r => state.racks[r].workingCount);
    state.charts.racks.data.datasets[1].data = rackLabels.map(r => state.racks[r].issueCount);
    state.charts.racks.update();
  }
}

// Lower Tabs Switcher
function switchTab(tabName) {
  const tabs = ['register', 'racks', 'analytics', 'notes'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const content = document.getElementById(`tabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (t === tabName) {
      btn.className = 'tab-btn px-3.5 py-2 font-semibold border-b-2 border-cyan-500 text-cyan-400 flex items-center space-x-1.5 whitespace-nowrap';
      content.classList.remove('hidden');
    } else {
      btn.className = 'tab-btn px-3.5 py-2 font-medium border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center space-x-1.5 whitespace-nowrap';
      content.classList.add('hidden');
    }
  });

  if (tabName === 'analytics') {
    setTimeout(updateCharts, 50);
  }
}
