import { Capacitor } from '@capacitor/core';
import { Purchases, type PurchasesPackage } from '@revenuecat/purchases-capacitor';

/**
 * RevenueCat の公開APIキー(秘密鍵ではない)。ダッシュボードで作ったら入れる。
 * 空のままなら購入ボタンは「準備中」になり、課金は一切走らない。
 */
const API_KEYS = { ios: '', android: '' };
export const ENTITLEMENT = 'premium';

export interface Plan {
  id: string;
  title: string;
  price: string;
  period: 'monthly' | 'annual' | 'other';
  trial: string | null;
  /** 年額を12で割った額の表示(年額のときだけ) */
  perMonth: string | null;
  /** 数値の価格(割引率の計算用) */
  amount?: number;
  pkg?: PurchasesPackage;
}

export type BillingState =
  | { status: 'unavailable'; reason: string }
  | { status: 'ready'; premium: boolean; plans: Plan[] };

const platform = Capacitor.getPlatform();
const key = platform === 'ios' ? API_KEYS.ios : platform === 'android' ? API_KEYS.android : '';
/** ブラウザで開発しているときだけ、画面確認用の疑似購入を使う */
const mock = !Capacitor.isNativePlatform() && import.meta.env.DEV;
const MOCK_KEY = 'kachimake.mockPremium';

let configured = false;

async function ensure() {
  if (configured) return;
  await Purchases.configure({ apiKey: key });
  configured = true;
}

function toPlans(pkgs: PurchasesPackage[]): Plan[] {
  return pkgs.map((p) => {
    const intro = p.product.introPrice;
    const annual = p.packageType === 'ANNUAL';
    return {
      id: p.identifier,
      title: p.product.title,
      price: p.product.priceString,
      period: p.packageType === 'MONTHLY' ? 'monthly' : p.packageType === 'ANNUAL' ? 'annual' : 'other',
      trial: intro && intro.price === 0 ? `${intro.periodNumberOfUnits}${unitJa(intro.periodUnit)}無料` : null,
      perMonth: annual && p.product.price > 0 ? perMonthText(p.product.price, p.product.currencyCode) : null,
      amount: p.product.price,
      pkg: p,
    };
  });
}

function perMonthText(price: number, currency: string) {
  try {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(price / 12);
  } catch {
    return null;
  }
}

const unitJa = (u: string) => ({ DAY: '日間', WEEK: '週間', MONTH: 'か月', YEAR: '年' } as Record<string, string>)[u] ?? '';

export async function loadBilling(): Promise<BillingState> {
  if (mock) {
    return {
      status: 'ready',
      premium: localStorage.getItem(MOCK_KEY) === '1',
      plans: [
        { id: 'annual', title: '年額', price: '¥3,000', period: 'annual', trial: '7日間無料', perMonth: '¥250', amount: 3000 },
        { id: 'monthly', title: '月額', price: '¥400', period: 'monthly', trial: '7日間無料', perMonth: null, amount: 400 },
      ],
    };
  }
  if (!key) return { status: 'unavailable', reason: '購入の準備中です' };
  try {
    await ensure();
    const [{ customerInfo }, offerings] = await Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()]);
    const pkgs = offerings.current?.availablePackages ?? [];
    return { status: 'ready', premium: ENTITLEMENT in customerInfo.entitlements.active, plans: toPlans(pkgs) };
  } catch (e) {
    console.error('[kachimake] billing', e);
    return { status: 'unavailable', reason: 'ストアに接続できませんでした' };
  }
}

/** true=有効になった / false=キャンセル。失敗は例外 */
export async function purchase(plan: Plan): Promise<boolean> {
  if (mock) {
    localStorage.setItem(MOCK_KEY, '1');
    return true;
  }
  if (!plan.pkg) throw new Error('この商品は購入できません');
  await ensure();
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: plan.pkg });
    return ENTITLEMENT in customerInfo.entitlements.active;
  } catch (e) {
    if ((e as { userCancelled?: boolean })?.userCancelled) return false;
    throw e;
  }
}

export async function restore(): Promise<boolean> {
  if (mock) return localStorage.getItem(MOCK_KEY) === '1';
  if (!key) return false;
  await ensure();
  const { customerInfo } = await Purchases.restorePurchases();
  return ENTITLEMENT in customerInfo.entitlements.active;
}

export function resetMock() {
  if (mock) localStorage.removeItem(MOCK_KEY);
}

export const manageUrl = platform === 'android'
  ? 'https://play.google.com/store/account/subscriptions'
  : 'https://apps.apple.com/account/subscriptions';
