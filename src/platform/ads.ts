// AdMob(バナーとリワード)。ここで失敗しても記入や集計は止めない: すべての呼び出しを包み、失敗は「広告なし」に倒す。
// 広告を出す場所の決まりは DESIGN.md「13. 広告」。記入画面とカウンターには出さない。
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import {
  AdMob, AdmobConsentStatus, BannerAdPluginEvents, BannerAdPosition, BannerAdSize, RewardAdPluginEvents,
} from '@capacitor-community/admob';
import config from '../../ads-config.json';

const native = Capacitor.isNativePlatform();
/** ブラウザでの開発中だけ、広告の場所と流れを疑似的に確かめられるようにする */
export const adsMock = !native && import.meta.env.DEV;
const ios = Capacitor.getPlatform() === 'ios';
const ids = ios ? config.ios : config.android;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface AdsState {
  allowed: boolean;
  /** EU などで、設定画面に「広告の同意を変える」を出す必要があるか */
  privacyOptions: boolean;
}

let init: Promise<AdsState> | null = null;

export function initAds(): Promise<AdsState> {
  if (adsMock) return Promise.resolve({ allowed: true, privacyOptions: false });
  if (!native) return Promise.resolve({ allowed: false, privacyOptions: false });
  return (init ??= (async () => {
    try {
      await AdMob.initialize({ initializeForTesting: config.useTestAds });
      let info = await AdMob.requestConsentInfo();
      if (!info.canRequestAds && info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
        info = await AdMob.showConsentForm();
      }
      // iOS では利用者を追跡しない(追跡の許可も聞かない)。広告は個人に合わせないものだけを頼む(npa)。
      // 2026-10-08 の審査で許可の画面の録画を求められたが実機が無いので、追跡そのものをやめた
      const state = { allowed: info.canRequestAds, privacyOptions: String(info.privacyOptionsRequirementStatus) === 'REQUIRED' };
      if (state.allowed) void preloadReward();
      return state;
    } catch (e) {
      console.warn('[kachimake] ads init', e);
      init = null;
      return { allowed: false, privacyOptions: false };
    }
  })());
}

export function showPrivacyOptions() {
  return native ? AdMob.showPrivacyOptionsForm().catch(() => {}) : Promise.resolve();
}

// ---------- バナー ----------
let bannerMade = false;
let bannerOn = false;
let sizeHandle: PluginListenerHandle | null = null;

/** 下のタブのすぐ上にバナーを出す/隠す。高さが変わったら onHeight で知らせる(本文の下に余白を足すため) */
export async function setBanner(visible: boolean, bottomMargin: number, onHeight: (h: number) => void) {
  if (adsMock) {
    onHeight(visible ? 60 : 0);
    return;
  }
  if (!native || visible === bannerOn) return;
  bannerOn = visible;
  try {
    if (visible) {
      if (!bannerMade) {
        sizeHandle ??= await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (s) => onHeight(bannerOn ? s.height : 0));
        await AdMob.showBanner({
          adId: ids.bannerId, adSize: BannerAdSize.ADAPTIVE_BANNER, position: BannerAdPosition.BOTTOM_CENTER,
          margin: bottomMargin, isTesting: config.useTestAds, npa: ios,
        });
        bannerMade = true;
      } else {
        await AdMob.resumeBanner();
      }
    } else if (bannerMade) {
      await AdMob.hideBanner();
      onHeight(0);
    }
  } catch (e) {
    console.warn('[kachimake] banner', e);
    onHeight(0);
  }
}

/** 有料になったらバナーを作り直せないように消す */
export async function removeBanner() {
  if (!native || !bannerMade) return;
  bannerOn = false;
  bannerMade = false;
  await AdMob.removeBanner().catch(() => {});
}

// ---------- リワード ----------
let rewardReady = false;
let rewardLoading: Promise<void> | null = null;

function preloadReward(): Promise<void> {
  if (!native || rewardReady) return Promise.resolve();
  return (rewardLoading ??= AdMob.prepareRewardVideoAd({ adId: ids.rewardedId, isTesting: config.useTestAds, npa: ios })
    .then(() => { rewardReady = true; }, () => { rewardReady = false; })
    .finally(() => { rewardLoading = null; }));
}

export type RewardOutcome = 'rewarded' | 'closed' | 'failed';

/** 最後まで見たときだけ 'rewarded'。途中で閉じたら 'closed' */
export async function showReward(): Promise<RewardOutcome> {
  if (adsMock) {
    await sleep(500);
    return 'rewarded';
  }
  if (!native) return 'failed';
  const handles: PluginListenerHandle[] = [];
  let got = false;
  try {
    if (!rewardReady) await preloadReward();
    if (!rewardReady) return 'failed';
    let finish: () => void = () => {};
    const done = new Promise<void>((r) => { finish = r; });
    handles.push(await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { got = true; }));
    handles.push(await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish()));
    handles.push(await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish()));
    rewardReady = false;
    // showRewardVideoAd は報酬が確定したときだけ返り、途中で閉じると返らない。だから待たずに「閉じた」を待つ
    void AdMob.showRewardVideoAd().then(() => { got = true; }, () => finish());
    await Promise.race([done, sleep(180_000)]);
    return got ? 'rewarded' : 'closed';
  } catch (e) {
    console.warn('[kachimake] reward', e);
    return got ? 'rewarded' : 'failed';
  } finally {
    for (const h of handles) void h.remove();
    void preloadReward();
  }
}
