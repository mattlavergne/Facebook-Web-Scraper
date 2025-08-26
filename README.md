# Facebook Web Scraper

Utility script for collecting the people who have liked, commented on, or shared a Facebook post. The script runs directly in your browser and provides a panel for exporting results to CSV.

## Usage

1. Navigate to the Facebook post you want to analyze and open the list of reactions, comments, or shares.
2. Open your browser's developer console (usually with <kbd>F12</kbd> or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>).
3. Paste the contents of [`Facebook Scraper.js`](Facebook%20Scraper.js) into the console and press <kbd>Enter</kbd>.
4. Use the floating panel to collect data and download the CSV file.

The latest version of the script can also be loaded directly from GitHub:

```
https://raw.githubusercontent.com/mattlavergne/Facebook-Web-Scraper/main/Facebook%20Scraper.js
```

To use the scraper as a Tampermonkey userscript, reference the same URL in an `@require` directive:

```
// ==UserScript==
// @name         FB Web Scraper Loader
// @match        *://www.facebook.com/*
// @require      https://raw.githubusercontent.com/mattlavergne/Facebook-Web-Scraper/main/Facebook%20Scraper.js
// ==/UserScript==
```

To use the scraper as a Tampermonkey userscript, reference the same URL in an `@require` directive:

```
// ==UserScript==
// @name         FB Web Scraper Loader
// @match        *://www.facebook.com/*
// @require      https://cdn.jsdelivr.net/gh/mattlavergne/Facebook-Web-Scraper@main/Facebook%20Scraper.js
// ==/UserScript==
```

## Configuration

You can adjust timing and throttle limits without editing the script by defining a `FBP_CONFIG` object before running it:

```html
<script>
window.FBP_CONFIG = {
  PAUSE: { likes: 2000 },
  LIMITS: { MAX_ACTIONS_PER_MIN: 20 }
};
</script>
```

Only the specified fields override the defaults.

Use responsibly and respect Facebook's terms of service.

