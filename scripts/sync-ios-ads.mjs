// iOS の Info.plist にある AdMob のアプリIDを ads-config.json に合わせる(npm run sync のたびに流す)
import { readFileSync, writeFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('ads-config.json', 'utf8'));
const path = 'ios/App/App/Info.plist';
const plist = readFileSync(path, 'utf8');
const next = plist.replace(
  /(<key>GADApplicationIdentifier<\/key>\s*<string>)[^<]*(<\/string>)/,
  `$1${config.ios.appId}$2`,
);
if (!next.includes(config.ios.appId)) throw new Error('Info.plist に GADApplicationIdentifier がありません');
if (next !== plist) writeFileSync(path, next);

// iOS に入れる規約・プライバシーの文から、ほかのストアの話を外す(2026-10-08 の審査 2.3.10)。
// サポートのページはアプリから開かず、Android の手順を含むので iOS には入れない
import { existsSync, rmSync } from 'node:fs';
const pub = 'ios/App/App/public';
if (existsSync(pub)) {
  for (const f of ['privacy.html', 'terms.html']) {
    const p = `${pub}/${f}`;
    if (!existsSync(p)) continue;
    const t = readFileSync(p, 'utf8');
    const u = t.replaceAll('App Store / Google Play', 'App Store');
    if (/Android|Google Play/.test(u)) throw new Error(`${f} にほかのストアの話が残っています`);
    if (u !== t) writeFileSync(p, u);
  }
  if (existsSync(`${pub}/support.html`)) rmSync(`${pub}/support.html`);
}
