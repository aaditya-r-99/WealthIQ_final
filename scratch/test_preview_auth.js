const fs = require('fs');

async function test() {
  let token = null;
  try {
    const raw = fs.readFileSync('/tmp/active_session_fresh.json', 'utf8');
    const parsed = JSON.parse(raw);
    token = parsed.access_token || parsed.token;
    if (!token && parsed.currentSession) {
      token = parsed.currentSession.access_token;
    }
  } catch (err) {
    console.error('Failed to read /tmp/active_session_fresh.json:', err.message);
  }

  if (!token) {
    try {
      const raw = fs.readFileSync('/tmp/active_session.json', 'utf8');
      const parsed = JSON.parse(raw);
      token = parsed.access_token || parsed.token;
      if (!token && parsed.currentSession) {
        token = parsed.currentSession.access_token;
      }
    } catch (err) {
      console.error('Failed to read /tmp/active_session.json:', err.message);
    }
  }

  if (!token) {
    console.error('No token found in /tmp session files');
    return;
  }

  console.log('Session token found (length: ' + token.length + ')');

  const start = Date.now();
  const res = await fetch('https://wealthiq-1790e4ckb-adityaprajapati-5528s-projects.vercel.app/api/classify-transaction', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ description: 'Swiggy dinner order 48291' })
  });
  const duration = Date.now() - start;

  console.log(`HTTP Status: ${res.status} ${res.statusText}`);
  console.log('Response headers:');
  for (const [k, v] of res.headers.entries()) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(`Duration: ${duration}ms`);
  const text = await res.text();
  console.log('Response body:', text);
  try {
    const data = JSON.parse(text);
    console.log('Response JSON keys:', Object.keys(data));
  } catch (e) {
    console.log('Not valid JSON');
  }
}

test().catch(err => console.error(err));
