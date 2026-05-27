# McCoy's Electrical Provider Search App

This is a mobile-friendly web app / PWA for iPhone. It searches a Google Sheet by store number and shows electrical provider, delivery company, ESID/account, and outage phone information.

## Files

- `index.html` — app screen
- `style.css` — iPhone/mobile styling
- `app.js` — search logic and Google Apps Script connection
- `manifest.json` — lets the site install like an app
- `service-worker.js` — caches the app shell for faster loading
- `Code.gs` — Google Apps Script backend for the spreadsheet
- `logo.jpg` and icons — McCoy's branding assets

## Google Sheet setup

Your current Sheet ID is already placed into `Code.gs`:

`1pVbdn5lAn42CXMBxAtBdOre2DqlgkLEqQ2aQ8g83b7E`

Recommended first-row headers:

| Store Number | Electrical Provider | Delivery Co. | ESID # | Account # | Outage Phone # | Address | City | State | Notes |
|---|---|---|---|---|---|---|---|---|---|

The app also accepts similar column names like `Store #`, `ESID#/ACCOUNT#`, `Outage Phone`, and `Delivery Company`.

## Deploy the Google Apps Script backend

1. Open the Google Sheet.
2. Go to **Extensions > Apps Script**.
3. Paste the contents of `Code.gs`.
4. Click **Save**.
5. Click **Deploy > New deployment**.
6. Select **Web app**.
7. Set **Execute as** to **Me**.
8. Set **Who has access** to the people who should use it. For a GitHub Pages app, `Anyone` is the simplest setup.
9. Click **Deploy** and approve permissions.
10. Copy the Web App URL ending in `/exec`.

## Connect the app

1. Open `app.js`.
2. Replace:

```js
APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwNRho2lENbJSVbmjeQ7azLC2ojYicQJ-hYhXGjpnbbJRmF1P92F6nTcbcpQ6YuemjW/exec"
```

with your deployed Apps Script Web App URL.

## Publish to GitHub Pages

Upload all app files except this README if you do not want it public. In GitHub Pages, set the branch/folder as the published website. Open the website on your iPhone, then choose **Share > Add to Home Screen**.

## Editing store data

Make store/provider changes directly in the Google Sheet. The app reads the Sheet when the user taps **Refresh** and also keeps a copy saved on the phone for quick access.


Apps Script URL added:
https://script.google.com/macros/s/AKfycbwNRho2lENbJSVbmjeQ7azLC2ojYicQJ-hYhXGjpnbbJRmF1P92F6nTcbcpQ6YuemjW/exec
