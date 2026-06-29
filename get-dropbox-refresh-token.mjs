// One-time helper to obtain a Dropbox REFRESH TOKEN for the remote server.
//
// Step 1: set your app key/secret and run with no code to get the authorize URL:
//   $env:DROPBOX_APP_KEY="..."; $env:DROPBOX_APP_SECRET="..."; node get-dropbox-refresh-token.mjs
// Step 2: open the printed URL, approve, copy the code Dropbox shows, then run:
//   node get-dropbox-refresh-token.mjs <THE_CODE>
// It prints DROPBOX_REFRESH_TOKEN — paste that into Render's env vars.

const APP_KEY = process.env.DROPBOX_APP_KEY;
const APP_SECRET = process.env.DROPBOX_APP_SECRET;
const code = process.argv[2];

if (!APP_KEY || !APP_SECRET) {
  console.error("Set DROPBOX_APP_KEY and DROPBOX_APP_SECRET in the environment first.");
  process.exit(1);
}

if (!code) {
  const url =
    `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}` +
    `&response_type=code&token_access_type=offline`;
  console.log("\n1) Open this URL, approve access, and copy the code shown:\n");
  console.log("   " + url + "\n");
  console.log("2) Then run:  node get-dropbox-refresh-token.mjs <CODE>\n");
  process.exit(0);
}

const body = new URLSearchParams({
  code,
  grant_type: "authorization_code",
  client_id: APP_KEY,
  client_secret: APP_SECRET,
});

const r = await fetch("https://api.dropboxapi.com/oauth2/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body,
});
const data = await r.json();
if (!r.ok) {
  console.error("Exchange failed:", JSON.stringify(data));
  process.exit(1);
}
console.log("\n✅ Success. Add these to Render env vars:\n");
console.log("DROPBOX_REFRESH_TOKEN =", data.refresh_token);
console.log("\n(account_id:", data.account_id, "scope:", data.scope, ")");
process.exit(0);
