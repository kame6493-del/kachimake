export type Kind = 'pachinko' | 'slot' | 'keiba' | 'keirin' | 'boat' | 'auto' | 'other';

export const KINDS: { id: Kind; label: string; short: string }[] = [
  { id: 'pachinko', label: 'パチンコ', short: 'パチ' },
  { id: 'slot', label: 'パチスロ', short: 'スロ' },
  { id: 'keiba', label: '競馬', short: '馬' },
  { id: 'keirin', label: '競輪', short: '輪' },
  { id: 'boat', label: 'ボートレース', short: '艇' },
  { id: 'auto', label: 'オートレース', short: 'オ' },
  { id: 'other', label: 'その他', short: '他' },
];

export const kindInfo = (k: Kind) => KINDS.find((x) => x.id === k) ?? KINDS[KINDS.length - 1];

/** 公営競技の券種。回収率を券種ごとに見るために持つ */
export const BET_TYPES = ['単勝', '複勝', '枠連', '馬連・2連複', '馬単・2連単', 'ワイド・拡連複', '3連複', '3連単', 'WIN5・その他'] as const;

export interface Session {
  id: string;
  /** YYYY-MM-DD(端末の現地日付) */
  date: string;
  kind: Kind;
  /** 店舗・競馬場・場名 */
  place: string;
  /** 機種名・レース名 */
  target: string;
  /** 投資(円)。現金+貯玉/貯メダルの再プレイ分を円換算した合計 */
  invest: number;
  /** 回収(円) */
  payout: number;
  /** 遊技・観戦の時間(分)。不明なら 0 */
  minutes: number;
  /** 券種(公営競技のみ) */
  betType?: string;
  memo: string;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  /** 月の上限(円)。0 は無効 */
  monthlyLimit: number;
  /** 週の始まり 0=日 1=月 */
  weekStart: 0 | 1;
  /** 黒字を何色で出すか。既定は墨(帳簿の黒字)。赤と黒の区別が苦手な人は青 */
  winColor: 'ink' | 'blue';
}

export const DEFAULT_SETTINGS: Settings = { monthlyLimit: 0, weekStart: 0, winColor: 'ink' };

export interface CounterMachine {
  id: string;
  name: string;
  /** 設定の並び。既定は 1〜6 */
  settings: string[];
  /** 数える項目。prob[i] は設定 i の確率の分母(1/x の x) */
  items: { id: string; name: string; denom: number[] }[];
}

export interface CounterState {
  machineId: string;
  games: number;
  counts: Record<string, number>;
}

export interface AppData {
  version: 1;
  sessions: Session[];
  settings: Settings;
  machines: CounterMachine[];
  counter: CounterState | null;
}
