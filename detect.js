const sharp = require('sharp');
const fs = require('fs');

const positions = {
  cam1: [325, 267],
  cam2: [364, 301],
  cam3: [512, 302],
  cam4: [536, 432],
  cam5: [568, 432],
  cam6: [613, 541],
  cam7: [603, 416],
  cam8: [605, 471],
  cam9: [704, 667],
  cam10: [684, 667],
  cam11: [656, 700],
  cam12: [496, 723],
  cam13: [469, 701],
  cam14: [435, 718],
  cam17: [294, 626],
  cam18: [76, 503],
  cam20: [94, 425],
  cam21: [104, 395],
  cam22: [115, 330],
  cam23: [128, 240],
  cam24: [116, 105],
  cam25: [116, 138],
  cam26: [522, 206],
  cam27: [562, 213],
  cam28: [593, 219],
  cam29: [345, 576],
  cam30: [446, 526],
  cam31: [508, 526],
  cam32: [586, 863],
  cam33: [555, 867],
  cam34: [528, 836],
  cam36: [503, 686],
  cam57: [418, 737],
};

async function checkTights() {
  for (const [name, [x, y]] of Object.entries(positions)) {
    const crop = await sharp('site_map.jpg').extract({ left: x - 12, top: y - 12, width: 24, height: 24 }).raw().toBuffer({ resolveWithObject: true });
    let rPix = 0, bPix = 0, gPix = 0;
    const { data } = crop;
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i], g = data[i+1], b = data[i+2];
      if (r > 105 && (r - g > 25) && (r - b > 25)) rPix++;
      else if (b > 105 && (b - r > 25) && (b - g > 10)) bPix++;
      else if (g > 85 && (g - r > 12) && (g - b > 5)) gPix++;
    }
    let detected = 'UNKNOWN';
    if (rPix > bPix && rPix > gPix && rPix > 8) detected = 'RED';
    else if (bPix > rPix && bPix > gPix && bPix > 8) detected = 'BLUE';
    else if (gPix > rPix && gPix > bPix && gPix > 8) detected = 'GREEN';
    console.log(`${name}: r=${rPix} b=${bPix} g=${gPix} -> ${detected}`);
  }
}
checkTights();

