import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** 端末ではキャッシュに書いて共有シートへ渡す。ブラウザではダウンロードする */
export async function exportText(filename: string, text: string, mime: string) {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: filename, url: uri });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickTextFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      if (f.size > 20 * 1024 * 1024) return resolve(null);
      resolve(await f.text());
    };
    input.click();
  });
}

/** 文字を人に渡す。端末は共有シート、ブラウザは共有できなければコピー */
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ text });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (e) {
    if (String(e).match(/cancel|abort/i)) return 'shared';
    try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
  }
}
