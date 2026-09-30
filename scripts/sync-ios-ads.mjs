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
