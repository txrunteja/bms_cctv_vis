const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Path to data file
const DB_FILE = path.join(__dirname, 'cctv_database.json');
const INITIAL_DB_FILE = path.join(__dirname, 'cctv_database_initial.json');

// Ensure initial backup exists
if (!fs.existsSync(INITIAL_DB_FILE) && fs.existsSync(DB_FILE)) {
  fs.copyFileSync(DB_FILE, INITIAL_DB_FILE);
}

function loadDB() {
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(raw);
}

function saveDB(data) {
  // Recalculate summary before saving
  const cams = data.cameras;
  data.summary.working = cams.filter(c => c.status === 'Working').length;
  data.summary.cableIssue = cams.filter(c => c.status === 'Cable issue').length;
  data.summary.defective = cams.filter(c => c.status === 'Defective').length;
  data.summary.healthRate = parseFloat(((data.summary.working / cams.length) * 100).toFixed(1));
  
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  return data;
}

// API Routes

// 1. Get full summary & dashboard stats
app.get('/api/summary', (req, res) => {
  try {
    const db = loadDB();
    res.json(db.summary);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read database', details: err.message });
  }
});

// 2. Get all cameras with optional query filters (status, rack, pole, zone, search)
app.get('/api/cameras', (req, res) => {
  try {
    const db = loadDB();
    let cameras = db.cameras;
    const { status, rack, pole, zone, search } = req.query;

    if (status && status !== 'all') {
      cameras = cameras.filter(c => c.status.toLowerCase() === status.toLowerCase());
    }
    if (rack && rack !== 'all') {
      cameras = cameras.filter(c => c.rack.toLowerCase() === rack.toLowerCase());
    }
    if (pole && pole !== 'all') {
      cameras = cameras.filter(c => c.pole.toLowerCase() === pole.toLowerCase());
    }
    if (zone && zone !== 'all') {
      cameras = cameras.filter(c => c.zone.toLowerCase() === zone.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      cameras = cameras.filter(c => 
        c.id.toString() === q ||
        c.camCode.toLowerCase().includes(q) ||
        c.pole.toLowerCase().includes(q) ||
        c.rack.toLowerCase().includes(q) ||
        c.locationDesc.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q)
      );
    }

    res.json(cameras);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read cameras', details: err.message });
  }
});

// 3. Get single camera by ID
app.get('/api/cameras/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const db = loadDB();
    const cam = db.cameras.find(c => c.id === id);
    if (!cam) return res.status(404).json({ error: `Camera ${id} not found` });
    res.json(cam);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch camera', details: err.message });
  }
});

// 4. Update camera status, technician, action, notes
app.put('/api/cameras/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const db = loadDB();
    const idx = db.cameras.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: `Camera ${id} not found` });

    const current = db.cameras[idx];
    const { status, technician, action, fault, notes } = req.body;

    if (status) current.status = status;
    if (technician !== undefined) current.technician = technician;
    if (action !== undefined) current.action = action;
    if (fault !== undefined) current.fault = fault;
    if (notes !== undefined) current.notes = notes;
    current.lastChecked = new Date().toISOString().replace('T', ' ').substring(0, 19);

    saveDB(db);
    res.json({ message: `Camera ${id} updated`, camera: current, summary: db.summary });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update camera', details: err.message });
  }
});

// 5. Get all poles
app.get('/api/poles', (req, res) => {
  try {
    const db = loadDB();
    // Augment poles with connected cameras
    const poles = {};
    for (const [poleId, poleData] of Object.entries(db.poles)) {
      const cams = db.cameras.filter(c => c.pole === poleId);
      poles[poleId] = {
        ...poleData,
        cameraCount: cams.length,
        cameras: cams.map(c => ({ id: c.id, code: c.camCode, status: c.status }))
      };
    }
    res.json(poles);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read poles', details: err.message });
  }
});

// 6. Get all racks
app.get('/api/racks', (req, res) => {
  try {
    const db = loadDB();
    const racks = {};
    for (const [rackId, rackData] of Object.entries(db.racks)) {
      const cams = db.cameras.filter(c => c.rack === rackId);
      const working = cams.filter(c => c.status === 'Working').length;
      const issues = cams.length - working;
      racks[rackId] = {
        ...rackData,
        cameraCount: cams.length,
        workingCount: working,
        issueCount: issues,
        cameras: cams.map(c => ({ id: c.id, code: c.camCode, status: c.status, pole: c.pole }))
      };
    }
    res.json(racks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read racks', details: err.message });
  }
});

// 7. Export Asset Register as CSV
app.get('/api/export/csv', (req, res) => {
  try {
    const db = loadDB();
    const headers = [
      'Camera ID',
      'Camera Code',
      'Status',
      'Pole ID',
      'Network Rack',
      'Zone',
      'Location Description',
      'IP Address',
      'Resolution',
      'Fault Diagnosis',
      'Recommended Action',
      'Technician',
      'Last Checked'
    ];

    const rows = db.cameras.map(c => [
      c.id,
      `"${c.camCode}"`,
      `"${c.status}"`,
      `"${c.pole}"`,
      `"${c.rack}"`,
      `"${c.zone}"`,
      `"${c.locationDesc.replace(/"/g, '""')}"`,
      `"${c.ipAddress}"`,
      `"${c.resolution}"`,
      `"${(c.fault || '').replace(/"/g, '""')}"`,
      `"${(c.action || '').replace(/"/g, '""')}"`,
      `"${(c.technician || '').replace(/"/g, '""')}"`,
      `"${c.lastChecked}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="CCTV_Asset_Register_Report.csv"');
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate CSV', details: err.message });
  }
});

// 8. Reset database to initial state
app.post('/api/reset', (req, res) => {
  try {
    if (fs.existsSync(INITIAL_DB_FILE)) {
      const initial = fs.readFileSync(INITIAL_DB_FILE, 'utf8');
      fs.writeFileSync(DB_FILE, initial, 'utf8');
      res.json({ message: 'Database reset successfully to original map extraction state' });
    } else {
      res.status(404).json({ error: 'Initial database backup not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset database', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` CCTV Surveillance Visualizer & Asset Manager Running  `);
  console.log(` URL: http://localhost:${PORT}                         `);
  console.log(` Mode: Node.js + Express API + Interactive Web GUI     `);
  console.log(`=======================================================`);
});

