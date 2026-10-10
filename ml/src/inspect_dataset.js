/**
 * WealthIQ - India Findex 2025 Dataset Inspection Script (Node.js)
 * Read-only script to audit dimensions, columns, and target distribution.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATASET_PATH = path.join(__dirname, '../data/raw/IND_2024_FINDEX_v02_M_CSV/Findex_Microdata_2025_updateIndia.csv');

async function main() {
  if (!fs.existsSync(DATASET_PATH)) {
    console.error(`Error: Dataset not found at ${DATASET_PATH}`);
    process.exit(1);
  }

  console.log(`Loading dataset from: ${DATASET_PATH}`);
  const fileStream = fs.createReadStream(DATASET_PATH);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let header = null;
  let rowCount = 0;
  const targetCounts = {};
  const fin24Map = {};

  let idxFin24 = -1;
  let idxFin24a = -1;

  for await (const line of rl) {
    if (!line.trim()) continue;
    // Basic CSV line splitter respecting simple quotes
    const fields = line.split(',').map(s => s.replace(/^"(.*)"$/, '$1'));

    if (!header) {
      header = fields;
      idxFin24 = header.indexOf('fin24');
      idxFin24a = header.indexOf('fin24a');
      continue;
    }

    rowCount++;
    const targetVal = fields[idxFin24a] || 'MISSING';
    targetCounts[targetVal] = (targetCounts[targetVal] || 0) + 1;

    const f24Val = fields[idxFin24] || 'MISSING';
    if (!fin24Map[f24Val]) fin24Map[f24Val] = {};
    fin24Map[f24Val][targetVal] = (fin24Map[f24Val][targetVal] || 0) + 1;
  }

  console.log('\n--- DATASET DIMENSIONS ---');
  console.log(`Rows (respondents): ${rowCount}`);
  console.log(`Columns: ${header.length}`);

  console.log('\n--- TARGET fin24a FREQUENCY DISTRIBUTION ---');
  const labels = {
    '1': 'Very difficult',
    '2': 'Somewhat difficult',
    '3': 'Not difficult at all',
    '4': "Don't know",
    'MISSING': 'Missing / Skipped (Sysmiss)'
  };

  for (const [val, count] of Object.entries(targetCounts)) {
    const label = labels[val] || 'Other';
    const pct = ((count / rowCount) * 100).toFixed(2);
    console.log(`  Code '${val}' (${label}): ${count} (${pct}%)`);
  }

  console.log('\n--- CROSS-TABULATION: fin24 (Emergency Source) vs fin24a (Difficulty) ---');
  const srcLabels = {
    '1': 'Savings',
    '2': 'Family/friends',
    '3': 'Work money',
    '4': 'Loan (bank/employer/private)',
    '5': 'Sale of assets',
    '6': 'Other source',
    '7': 'Could not come up with money',
    '8': "Don't know",
    '9': 'Refused'
  };

  for (const [code, sub] of Object.entries(fin24Map)) {
    const label = srcLabels[code] || 'Unknown';
    const subStr = Object.entries(sub).map(([k, v]) => `fin24a=${k}:${v}`).join(', ');
    console.log(`  fin24=${code} (${label.padEnd(28)}) -> ${subStr}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
