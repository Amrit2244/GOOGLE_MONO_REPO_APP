import axios from 'axios';

// Replace with your production Next.js URL when deployed
const CLOUD_API_URL = 'http://localhost:3000/api/tally';
const TALLY_LOCAL_URL = 'http://localhost:9000';

function buildTallyXML(slip) {
  const isSale = slip.firstWeightType === 'Tare';
  const voucherType = isSale ? 'Sales' : 'Purchase';
  const totalAmount = (slip.netWeight * slip.rate).toFixed(2);

  // Format Date for Tally: YYYYMMDD
  const dateObj = new Date(slip.secondTimestamp || slip.firstTimestamp);
  const formattedDate = dateObj.toISOString().slice(0, 10).replace(/-/g, '');

  // Party entry is Debit for Sales, Credit for Purchase
  const partyIsPositive = isSale ? 'Yes' : 'No';
  const ledgerIsPositive = isSale ? 'No' : 'Yes';

  return `
  <ENVELOPE>
    <HEADER>
      <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
      <IMPORTDATA>
        <REQUESTDESC>
          <REPORTNAME>Vouchers</REPORTNAME>
        </REQUESTDESC>
        <REQUESTDATA>
          <TALLYMESSAGE xmlns:UDF="TallyUDF">
            <VOUCHER VCHTYPE="${voucherType}" ACTION="Create">
              <DATE>${formattedDate}</DATE>
              <VOUCHERTYPENAME>${voucherType}</VOUCHERTYPENAME>
              <REFERENCE>SLIP-${slip.slipNo}</REFERENCE>
              <NARRATION>Vehicle: ${slip.vehicleNumber}, Item: ${slip.itemName}, Net: ${slip.netWeight} QTL @ ${slip.rate}</NARRATION>
              <PARTYLEDGERNAME>${slip.partyName}</PARTYLEDGERNAME>

              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${slip.partyName}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>${partyIsPositive}</ISDEEMEDPOSITIVE>
                <AMOUNT>${isSale ? `-${totalAmount}` : totalAmount}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>

              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${isSale ? 'Sales Account' : 'Purchase Account'}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>${ledgerIsPositive}</ISDEEMEDPOSITIVE>
                <AMOUNT>${isSale ? totalAmount : `-${totalAmount}`}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>
            </VOUCHER>
          </TALLYMESSAGE>
        </REQUESTDATA>
      </IMPORTDATA>
    </BODY>
  </ENVELOPE>
  `.trim();
}

async function syncPendingSlips() {
  try {
    console.log('Checking for pending slips...');
    const res = await axios.get(`${CLOUD_API_URL}/pending`);
    const slips = res.data;

    if (slips.length === 0) {
      console.log('No new slips to sync.');
      return;
    }

    for (const slip of slips) {
      if (slip.rate <= 0) {
        console.log(`Skipping Slip ${slip.slipNo}: Rate is 0, cannot generate financial voucher.`);
        continue;
      }

      console.log(`Pushing Slip ${slip.slipNo} to Tally...`);
      const xmlPayload = buildTallyXML(slip);

      try {
        const tallyRes = await axios.post(TALLY_LOCAL_URL, xmlPayload, {
          headers: { 'Content-Type': 'text/xml' }
        });

        // Tally returns <CREATED>1</CREATED> on success
        if (tallyRes.data.includes('<CREATED>1</CREATED>') || tallyRes.data.includes('<ALTERED>1</ALTERED>')) {
          await axios.post(`${CLOUD_API_URL}/mark-synced`, { slipNo: slip.slipNo });
          console.log(`✓ Slip ${slip.slipNo} synced to Tally successfully.`);
        } else {
          console.error(`✗ Tally rejected Slip ${slip.slipNo}. Response check: ledger names might be missing in Tally.`);
        }
      } catch (tallyError) {
        console.error(`Tally Connection Error: Ensure Tally is open and configured to listen on port 9000.`);
        break; // Stop loop if Tally is offline
      }
    }
  } catch (err) {
    console.error('Sync loop error:', err.message);
  }
}

// Run immediately, then every 30 seconds
syncPendingSlips();
setInterval(syncPendingSlips, 30000);
