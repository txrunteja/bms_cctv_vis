const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Create public directory for crops and assets
const publicDir = path.join(__dirname, 'public');
const cropsDir = path.join(publicDir, 'crops');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
if (!fs.existsSync(cropsDir)) fs.mkdirSync(cropsDir, { recursive: true });

// Copy the original site map image into public folder
fs.copyFileSync(path.join(__dirname, 'site_map.jpg'), path.join(publicDir, 'site_map.jpg'));

// Coordinates in 768 x 1024 space: [x, y]
// And approximate field of view / orientation angle in degrees (0 = East, 90 = South, 180 = West, 270 = North)
const cameraLocations = {
  1: { x: 326, y: 268, pole: 'P32', rack: 'IR12', zone: 'Inner Ring', angle: 180, desc: 'Inner North Pathway - West FOV' },
  2: { x: 365, y: 301, pole: 'P32', rack: 'IR12', zone: 'Inner Ring', angle: 90, desc: 'Inner North Pathway - South FOV' },
  3: { x: 512, y: 302, pole: 'P1', rack: 'IR10', zone: 'Inner Ring', angle: 225, desc: 'Inner North Pathway - SW FOV' },
  4: { x: 538, y: 432, pole: 'Pickup Point', rack: 'IR9', zone: 'Pickup & Drop', angle: 90, desc: 'Courtyard Pickup & Drop Point - West' },
  5: { x: 569, y: 432, pole: 'Pickup Point', rack: 'IR9', zone: 'Pickup & Drop', angle: 90, desc: 'Courtyard Pickup & Drop Point - East' },
  6: { x: 614, y: 541, pole: 'P4', rack: 'IR9', zone: 'Inner Ring', angle: 45, desc: 'Inner South-East Corner' },
  7: { x: 605, y: 416, pole: 'P3', rack: 'IR10', zone: 'Inner Ring', angle: 135, desc: 'Inner East Pathway - Upper' },
  8: { x: 606, y: 471, pole: 'P3', rack: 'IR10', zone: 'Inner Ring', angle: 225, desc: 'Inner East Pathway - Lower' },
  9: { x: 705, y: 666, pole: 'OR1 Rack', rack: 'OR1', zone: 'Outer Ring', angle: 45, desc: 'OR1 Junction Rack - North-East' },
  10: { x: 684, y: 666, pole: 'OR1 Rack', rack: 'OR1', zone: 'Outer Ring', angle: 270, desc: 'OR1 Junction Rack - North' },
  11: { x: 657, y: 700, pole: 'OR1 Rack', rack: 'OR1', zone: 'Outer Ring', angle: 180, desc: 'OR1 Junction Rack - West Road' },
  12: { x: 497, y: 723, pole: 'P8', rack: 'OR7', zone: 'Outer Ring', angle: 90, desc: 'Outer South Pathway - South FOV' },
  13: { x: 470, y: 701, pole: 'P8', rack: 'OR7', zone: 'Outer Ring', angle: 270, desc: 'Outer South Pathway - North FOV' },
  14: { x: 434, y: 718, pole: 'P8', rack: 'OR7', zone: 'Outer Ring', angle: 180, desc: 'Outer South Pathway - West FOV' },
  15: { x: 343, y: 652, pole: 'P10', rack: 'OR7', zone: 'Outer Ring', angle: 270, desc: 'South-West Diagonal Road' },
  16: { x: 237, y: 588, pole: 'P12', rack: 'OR7', zone: 'Outer Ring', angle: 270, desc: 'South-West Diagonal Road' },
  17: { x: 294, y: 626, pole: 'P11', rack: 'OR7', zone: 'Outer Ring', angle: 315, desc: 'South-West Diagonal Road' },
  18: { x: 77, y: 504, pole: 'OR6 Rack', rack: 'OR6', zone: 'Outer Ring', angle: 90, desc: 'OR6 Left Perimeter - South' },
  19: { x: 111, y: 467, pole: 'OR6 Rack', rack: 'OR6', zone: 'Outer Ring', angle: 0, desc: 'OR6 Left Perimeter - East' },
  20: { x: 94, y: 425, pole: 'P14', rack: 'OR6', zone: 'Outer Ring', angle: 270, desc: 'West Pathway - North FOV' },
  21: { x: 104, y: 395, pole: 'P15', rack: 'OR6', zone: 'Outer Ring', angle: 90, desc: 'West Pathway - South FOV' },
  22: { x: 115, y: 330, pole: 'P16', rack: 'OR6', zone: 'Outer Ring', angle: 90, desc: 'West Pathway Upper - South FOV' },
  23: { x: 128, y: 240, pole: 'P16', rack: 'OR6', zone: 'Outer Ring', angle: 270, desc: 'West Pathway Upper - North FOV' },
  24: { x: 116, y: 105, pole: 'OR5 Rack', rack: 'OR5', zone: 'Outer Ring', angle: 135, desc: 'Rear Gate / OR5 - NW FOV' },
  25: { x: 116, y: 138, pole: 'OR5 Rack', rack: 'OR5', zone: 'Outer Ring', angle: 225, desc: 'Rear Gate / OR5 - SW FOV' },
  26: { x: 522, y: 206, pole: 'P20', rack: 'OR4', zone: 'Outer Ring', angle: 225, desc: 'North Outer Perimeter - SW' },
  27: { x: 562, y: 213, pole: 'P20', rack: 'OR4', zone: 'Outer Ring', angle: 315, desc: 'North Outer Perimeter - SE' },
  28: { x: 593, y: 219, pole: 'P21', rack: 'OR4', zone: 'Outer Ring', angle: 225, desc: 'North Outer Perimeter - SW' },
  29: { x: 345, y: 576, pole: 'P29', rack: 'IR13', zone: 'Inner Ring', angle: 225, desc: 'Inner Courtyard South-West' },
  30: { x: 446, y: 526, pole: 'P28', rack: 'IR13', zone: 'Inner Ring', angle: 135, desc: 'Inner South Pathway - West' },
  31: { x: 508, y: 526, pole: 'P28', rack: 'IR13', zone: 'Inner Ring', angle: 45, desc: 'Inner South Pathway - East' },
  32: { x: 586, y: 863, pole: 'P7', rack: 'OR8', zone: 'Outer Ring', angle: 315, desc: 'Main Gate Approach - South-East' },
  33: { x: 555, y: 867, pole: 'P7', rack: 'OR8', zone: 'Outer Ring', angle: 90, desc: 'Main Gate Approach - South' },
  34: { x: 528, y: 836, pole: 'P7', rack: 'OR8', zone: 'Outer Ring', angle: 225, desc: 'Main Gate Approach - South-West' },
  35: { x: 700, y: 736, pole: 'OR1 Rack', rack: 'OR1', zone: 'Outer Ring', angle: 135, desc: 'OR1 Junction Rack - South-East' },
  36: { x: 503, y: 686, pole: 'P8', rack: 'OR7', zone: 'Outer Ring', angle: 270, desc: 'Outer South Pathway - North FOV' },
  37: { x: 156, y: 154, pole: 'OR5 Rack', rack: 'OR5', zone: 'Outer Ring', angle: 90, desc: 'North-West Outer Curve - South FOV' },
  38: { x: 199, y: 127, pole: 'OR5 Rack', rack: 'OR5', zone: 'Outer Ring', angle: 0, desc: 'North-West Outer Curve - East FOV' },
  39: { x: 296, y: 171, pole: 'P17', rack: 'OR5', zone: 'Outer Ring', angle: 90, desc: 'North Outer Perimeter - South FOV' },
  40: { x: 364, y: 182, pole: 'P18', rack: 'OR4', zone: 'Outer Ring', angle: 225, desc: 'North Outer Perimeter - SW FOV' },
  41: { x: 416, y: 188, pole: 'P18', rack: 'OR4', zone: 'Outer Ring', angle: 315, desc: 'North Outer Perimeter - SE FOV' },
  42: { x: 469, y: 212, pole: 'P19', rack: 'OR4', zone: 'Outer Ring', angle: 90, desc: 'North Outer Perimeter / OR4 Rack' },
  43: { x: 652, y: 239, pole: 'P22', rack: 'OR3', zone: 'Outer Ring', angle: 90, desc: 'North-East Outer Perimeter / OR3 Rack' },
  44: { x: 690, y: 241, pole: 'P23', rack: 'OR3', zone: 'Outer Ring', angle: 225, desc: 'North-East Outer Corner - SW' },
  45: { x: 708, y: 249, pole: 'P23', rack: 'OR3', zone: 'Outer Ring', angle: 90, desc: 'North-East Outer Corner - South' },
  46: { x: 734, y: 251, pole: 'P23', rack: 'OR3', zone: 'Outer Ring', angle: 315, desc: 'North-East Outer Corner - SE' },
  47: { x: 710, y: 320, pole: 'P24', rack: 'OR2', zone: 'Outer Ring', angle: 225, desc: 'East Outer Vertical Pathway' },
  48: { x: 704, y: 383, pole: 'P25', rack: 'OR2', zone: 'Outer Ring', angle: 225, desc: 'East Outer Vertical Pathway / OR2 Rack' },
  49: { x: 684, y: 425, pole: 'P26', rack: 'OR2', zone: 'Outer Ring', angle: 180, desc: 'East Outer Vertical Pathway' },
  50: { x: 693, y: 471, pole: 'P27', rack: 'OR2', zone: 'Outer Ring', angle: 180, desc: 'East Outer Vertical Pathway' },
  51: { x: 682, y: 528, pole: 'P27', rack: 'OR2', zone: 'Outer Ring', angle: 225, desc: 'East Outer Lower Vertical Pathway' },
  52: { x: 673, y: 732, pole: 'OR1 Rack', rack: 'OR1', zone: 'Outer Ring', angle: 90, desc: 'OR1 Junction Rack - South' },
  53: { x: 618, y: 740, pole: 'P6', rack: 'OR1', zone: 'Outer Ring', angle: 90, desc: 'South-East Connecting Pathway' },
  54: { x: 596, y: 716, pole: 'P6', rack: 'OR1', zone: 'Outer Ring', angle: 180, desc: 'South-East Connecting Pathway' },
  55: { x: 538, y: 682, pole: 'P8', rack: 'OR7', zone: 'Outer Ring', angle: 270, desc: 'Outer South Pathway - North FOV' },
  56: { x: 487, y: 805, pole: 'OR8 Rack', rack: 'OR8', zone: 'Outer Ring', angle: 225, desc: 'Bottom Diagonal Pathway / OR8' },
  57: { x: 418, y: 737, pole: 'P9', rack: 'OR7', zone: 'Outer Ring', angle: 315, desc: 'OR7 Rack Junction - SE FOV' },
  58: { x: 396, y: 682, pole: 'P9', rack: 'OR7', zone: 'Outer Ring', angle: 270, desc: 'OR7 Rack Junction - North FOV' },
  59: { x: 361, y: 694, pole: 'P9', rack: 'OR7', zone: 'Outer Ring', angle: 180, desc: 'OR7 Rack Junction - West FOV' },
  60: { x: 231, y: 501, pole: 'P30', rack: 'IR13', zone: 'Inner Ring', angle: 45, desc: 'Inner South-West Corner / IR13' },
  61: { x: 187, y: 307, pole: 'P31', rack: 'IR12', zone: 'Inner Ring', angle: 90, desc: 'Inner North-West Corner - South FOV' },
  62: { x: 250, y: 267, pole: 'P31', rack: 'IR12', zone: 'Inner Ring', angle: 0, desc: 'Inner North-West Corner / IR12 - East' },
  63: { x: 413, y: 271, pole: 'P32', rack: 'IR12', zone: 'Inner Ring', angle: 0, desc: 'Inner North Horizontal Pathway - East' },
  64: { x: 552, y: 303, pole: 'P1', rack: 'IR10', zone: 'Inner Ring', angle: 0, desc: 'Inner North Horizontal Pathway - East' },
  65: { x: 593, y: 317, pole: 'P2', rack: 'IR10', zone: 'Inner Ring', angle: 225, desc: 'Inner North-East Corner / IR10 - SW' },
  66: { x: 644, y: 322, pole: 'P2', rack: 'IR10', zone: 'Inner Ring', angle: 315, desc: 'Inner North-East Corner / IR10 - SE' },
  67: { x: 133, y: 371, pole: 'P15', rack: 'OR6', zone: 'Outer Ring', angle: 0, desc: 'West Outer Pathway - East FOV' },
  68: { x: 122, y: 555, pole: 'P13', rack: 'OR6', zone: 'Outer Ring', angle: 270, desc: 'South-West Outer Pathway - North' },
  69: { x: 581, y: 576, pole: 'P5', rack: 'IR9', zone: 'Inner Courtyard', angle: 45, desc: 'Courtyard South-East / IR9 - NE' },
  70: { x: 588, y: 611, pole: 'P5', rack: 'IR9', zone: 'Inner Courtyard', angle: 135, desc: 'Courtyard South-East / IR9 - SE' }
};

// Status mapping
// Cable Issue (15): 1, 2, 3, 4, 5, 6, 11, 12, 18, 21, 22, 26, 27, 28, 34
// Defective (14): 7, 8, 9, 10, 17, 20, 23, 24, 25, 29, 30, 31, 32, 33
// Working (41): All remaining: 13, 14, 15, 16, 19, 35, 36, 37..70 (including 57)
const cableIssueCams = new Set([1, 2, 3, 4, 5, 6, 11, 12, 18, 21, 22, 26, 27, 28, 34]);
const defectiveCams = new Set([7, 8, 9, 10, 17, 20, 23, 24, 25, 29, 30, 31, 32, 33]);

// Fault descriptions and recommended maintenance actions
function getDiagnostics(id, status) {
  if (status === 'Cable issue') {
    const cableFaults = [
      { fault: 'Cat6 Signal Loss / Broken conductor in conduit', action: 'Tone & trace cable run; re-punch keystone or pull new Cat6 UTP cable.' },
      { fault: 'PoE Voltage Drop / High resistance fault', action: 'Inspect patch panel terminations, measure resistance with cable certifier.' },
      { fault: 'Water ingress in outdoor RJ45 connector', action: 'Replace RJ45 with IP67 weatherproof grommet and seal junction box.' },
      { fault: 'Crimp failure at pole terminal box', action: 'Re-terminate RJ45 connector using gold-plated pass-through plug.' },
      { fault: 'Junction box loose wiring / bent pin in PoE port', action: 'Check PoE port on switch and inspect RJ45 jack pins.' }
    ];
    return cableFaults[id % cableFaults.length];
  } else if (status === 'Defective') {
    const defectFaults = [
      { fault: 'No Power / Internal PoE PCB failure', action: 'Bench test camera with 12V DC bench supply; RMA or replace unit.' },
      { fault: 'Image sensor corrupted / purple hue / dead pixels', action: 'Replace camera module with 4MP/5MP IR Bullet/Dome.' },
      { fault: 'IR Cut filter stuck / daytime black & white', action: 'Cycle IR cut mechanically; if persistent, swap camera assembly.' },
      { fault: 'Water intrusion / lens fogging inside dome', action: 'Disassemble, dry with silica packet, replace O-ring seal or replace camera.' },
      { fault: 'Firmware bootloop / unresponsive to ping and ARP', action: 'Attempt TFTP firmware flash; replace mainboard if bricked.' }
    ];
    return defectFaults[id % defectFaults.length];
  } else {
    return {
      fault: 'None - Operating normally',
      action: 'Routine quarterly lens cleaning and dome polishing.'
    };
  }
}

// Poles metadata (P1 - P32)
const poleLocations = {
  P1: { x: 532, y: 302, zone: 'Inner Ring', desc: 'Inner upper horizontal pathway' },
  P2: { x: 618, y: 319, zone: 'Inner Ring', desc: 'Upper-right inner corner (IR10)' },
  P3: { x: 605, y: 443, zone: 'Inner Ring', desc: 'Right inner vertical pathway' },
  P4: { x: 614, y: 541, zone: 'Inner Ring', desc: 'Lower-right inner corner' },
  P5: { x: 585, y: 593, zone: 'Inner Courtyard', desc: 'Lower-right inner courtyard (IR9)' },
  P6: { x: 607, y: 728, zone: 'Outer Ring', desc: 'Right-side lower pathway junction' },
  P7: { x: 556, y: 855, zone: 'Outer Ring', desc: 'Main Gate diagonal pathway' },
  P8: { x: 485, y: 712, zone: 'Outer Ring', desc: 'Bottom horizontal outer pathway' },
  P9: { x: 391, y: 704, zone: 'Outer Ring', desc: 'Lower-left connecting pathway (OR7)' },
  P10: { x: 343, y: 652, zone: 'Outer Ring', desc: 'Lower diagonal pathway - mid-east' },
  P11: { x: 294, y: 626, zone: 'Outer Ring', desc: 'Lower diagonal pathway - mid' },
  P12: { x: 237, y: 588, zone: 'Outer Ring', desc: 'Lower diagonal pathway - west' },
  P13: { x: 122, y: 555, zone: 'Outer Ring', desc: 'Lower-left outer perimeter pathway' },
  P14: { x: 94, y: 440, zone: 'Outer Ring', desc: 'Left-side lower pathway (near OR6)' },
  P15: { x: 118, y: 383, zone: 'Outer Ring', desc: 'Left-side mid-west pathway' },
  P16: { x: 121, y: 285, zone: 'Outer Ring', desc: 'Upper-left vertical pathway' },
  P17: { x: 296, y: 155, zone: 'Outer Ring', desc: 'Upper horizontal outer pathway - west' },
  P18: { x: 390, y: 175, zone: 'Outer Ring', desc: 'Upper horizontal outer pathway - mid' },
  P19: { x: 469, y: 195, zone: 'Outer Ring', desc: 'Upper horizontal outer pathway (OR4)' },
  P20: { x: 542, y: 200, zone: 'Outer Ring', desc: 'Upper horizontal outer pathway - east' },
  P21: { x: 593, y: 205, zone: 'Outer Ring', desc: 'Upper horizontal outer pathway - near bend' },
  P22: { x: 652, y: 220, zone: 'Outer Ring', desc: 'Upper-right outer pathway (OR3)' },
  P23: { x: 710, y: 235, zone: 'Outer Ring', desc: 'Upper-right corner junction' },
  P24: { x: 710, y: 320, zone: 'Outer Ring', desc: 'Right-side outer vertical pathway - upper' },
  P25: { x: 704, y: 383, zone: 'Outer Ring', desc: 'Right-side outer vertical pathway (OR2)' },
  P26: { x: 684, y: 425, zone: 'Outer Ring', desc: 'Right-side outer vertical pathway - mid' },
  P27: { x: 687, y: 500, zone: 'Outer Ring', desc: 'Right-side outer vertical pathway - lower' },
  P28: { x: 477, y: 526, zone: 'Inner Ring', desc: 'Inner bottom horizontal pathway' },
  P29: { x: 345, y: 565, zone: 'Inner Ring', desc: 'Inner bottom-left courtyard' },
  P30: { x: 231, y: 515, zone: 'Inner Ring', desc: 'Inner bottom-left horizontal pathway (IR13)' },
  P31: { x: 218, y: 287, zone: 'Inner Ring', desc: 'Upper-left inner area (IR12)' },
  P32: { x: 369, y: 275, zone: 'Inner Ring', desc: 'Upper-middle inner pathway' }
};

// Network Racks (12 Racks)
const rackLocations = {
  OR1: { x: 680, y: 700, type: 'Outer Ring', model: 'OR-Rack-Outdoor-IP66', switch: '24-Port PoE+ L2 Managed', desc: 'South-East Junction Rack near P6 & Main Gate' },
  OR2: { x: 715, y: 360, type: 'Outer Ring', model: 'OR-Rack-Outdoor-IP66', switch: '8-Port PoE+ Industrial', desc: 'East Perimeter Pathway at P25' },
  OR3: { x: 650, y: 215, type: 'Outer Ring', model: 'OR-Rack-Outdoor-IP66', switch: '16-Port PoE+ Industrial', desc: 'North-East Corner at P22' },
  OR4: { x: 469, y: 175, type: 'Outer Ring', model: 'OR-Rack-Outdoor-IP66', switch: '16-Port PoE+ Industrial', desc: 'North Perimeter Pathway at P19' },
  OR5: { x: 155, y: 118, type: 'Outer Ring', model: 'OR-Rack-Outdoor-IP66', switch: '24-Port PoE+ L2 Managed', desc: 'North-West Rear Gate Station' },
  OR6: { x: 70, y: 467, type: 'Outer Ring', model: 'OR-Rack-Outdoor-IP66', switch: '16-Port PoE+ Industrial', desc: 'West Perimeter Pathway near P14' },
  OR7: { x: 390, y: 712, type: 'Outer Ring', model: 'OR-Rack-Outdoor-IP66', switch: '24-Port PoE+ L2 Managed', desc: 'South-West Connector Pathway at P9' },
  OR8: { x: 500, y: 785, type: 'Outer Ring', model: 'OR-Rack-Outdoor-IP66', switch: '8-Port PoE+ Industrial', desc: 'Bottom Diagonal Pathway near Main Gate' },
  IR9: { x: 575, y: 615, type: 'Inner Ring', model: 'IR-Rack-Indoor-WallMount', switch: '16-Port PoE+ Gigabit', desc: 'South-East Courtyard & Pickup Point Hub' },
  IR10: { x: 630, y: 295, type: 'Inner Ring', model: 'IR-Rack-Indoor-WallMount', switch: '16-Port PoE+ Gigabit', desc: 'North-East Inner Building Hub at P2' },
  IR12: { x: 200, y: 265, type: 'Inner Ring', model: 'IR-Rack-Indoor-WallMount', switch: '16-Port PoE+ Gigabit', desc: 'North-West Inner Building Hub at P31' },
  IR13: { x: 215, y: 525, type: 'Inner Ring', model: 'IR-Rack-Indoor-WallMount', switch: '16-Port PoE+ Gigabit', desc: 'South-West Inner Building Hub at P30' }
};

async function buildDatabase() {
  const cameras = [];

  for (let id = 1; id <= 70; id++) {
    const loc = cameraLocations[id];
    let status = 'Working';
    if (cableIssueCams.has(id)) status = 'Cable issue';
    else if (defectiveCams.has(id)) status = 'Defective';

    const diag = getDiagnostics(id, status);

    // Generate high quality crop for each camera (44x44 centered)
    const cropFile = `cam_${id}.png`;
    const cropPath = path.join(cropsDir, cropFile);
    try {
      await sharp('site_map.jpg')
        .extract({
          left: Math.max(0, Math.min(768 - 48, loc.x - 24)),
          top: Math.max(0, Math.min(1024 - 48, loc.y - 24)),
          width: 48,
          height: 48
        })
        .toFile(cropPath);
    } catch (err) {
      console.error(`Failed to crop camera ${id}:`, err);
    }

    cameras.push({
      id: id,
      camCode: `CAM-${id.toString().padStart(2, '0')}`,
      status: status,
      pole: loc.pole,
      rack: loc.rack,
      zone: loc.zone,
      x: loc.x,
      y: loc.y,
      xPct: parseFloat(((loc.x / 768) * 100).toFixed(2)),
      yPct: parseFloat(((loc.y / 1024) * 100).toFixed(2)),
      angle: loc.angle,
      locationDesc: loc.desc,
      fault: diag.fault,
      action: diag.action,
      cropUrl: `/crops/${cropFile}`,
      ipAddress: `192.168.10.${100 + id}`,
      resolution: '4MP (2560x1440)',
      fps: 25,
      lastChecked: '2026-11-04 14:30',
      technician: status === 'Working' ? 'System Checked' : 'Pending Assignment'
    });
  }

  // Build summary stats
  const summary = {
    totalCameras: 70,
    working: cameras.filter(c => c.status === 'Working').length,
    cableIssue: cameras.filter(c => c.status === 'Cable issue').length,
    defective: cameras.filter(c => c.status === 'Defective').length,
    totalPoles: Object.keys(poleLocations).length,
    totalRacks: Object.keys(rackLocations).length,
    outerRacks: 8,
    innerRacks: 4,
    healthRate: parseFloat(((cameras.filter(c => c.status === 'Working').length / 70) * 100).toFixed(1))
  };

  const db = {
    summary,
    cameras,
    poles: poleLocations,
    racks: rackLocations
  };

  fs.writeFileSync(path.join(__dirname, 'cctv_database.json'), JSON.stringify(db, null, 2));
  console.log('Database and crops generated successfully!');
  console.log('Summary:', summary);
}

buildDatabase();

