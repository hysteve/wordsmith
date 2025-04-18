### lighthouse

The [`@browserless/lighthouse`](https://npm.im/@browserless/lighthouse) package provides you the setup for running [Lighthouse](https://developers.google.com/web/tools/lighthouse) reports backed by browserless.

```js
const createLighthouse = require("@browserless/lighthouse");
const createBrowser = require("browserless");
const { writeFile } = require("fs/promises");
const { onExit } = require("signal-exit");

const browser = createBrowser();
onExit(browser.close);

const lighthouse = createLighthouse(async (teardown) => {
  const browserless = await browser.createContext();
  teardown(() => browserless.destroyContext());
  return browserless;
});

const report = await lighthouse("https://microlink.io");
await writeFile("report.json", JSON.stringify(report, null, 2));
```

The report will be generated for the provided URL. This extends the `lighthouse:default` settings. These settings are similar to the Google Chrome Audits reports on Developer Tools.

#### options

The [Lighthouse configuration](https://github.com/GoogleChrome/lighthouse/blob/main/docs/configuration.md) that will extend `'lighthouse:default'` settings:

```js
const report = await lighthouse(url, {
  onlyAudits: ["accessibility"],
});
```

Also, you can extend from a different preset of settings:

```js
const report = await lighthouse(url, {
  preset: "desktop",
  onlyAudits: ["accessibility"],
});
```

Additionally, you can setup:

The lighthouse execution runs as a [worker thread](https://nodejs.org/api/worker_threads.html), any [worker#options](https://nodejs.org/api/worker_threads.html#new-workerfilename-options) are supported.

##### logLevel

type: `string`</br>
default: `'error'`</br>
values: `'silent'` | `'error'` | `'info'` | `'verbose'` </br>

The level of logging to enable.

##### output

type: `string` | `string[]`</br>
default: `'json'`</br>
values: `'json'` | `'csv'` | `'html'`

The type(s) of report output to be produced.

##### timeout

type: `number`</br>
default: `browserless.timeout`

This setting will change the default maximum navigation time.
