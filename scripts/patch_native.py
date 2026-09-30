"""ネイティブ設定を1回だけ書き換える(広告・署名・iPhone専用・縦固定)。何度流しても同じ結果になるようにしてある。"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DN_PLIST = Path(r'C:\Users\yuichi1\Downloads\chatgpt\栄冠ナインみたいなゲーム\mobile\ios\App\App\Info.plist')


def patch(path: Path, pairs):
    s = path.read_text(encoding='utf-8')
    for old, new in pairs:
        if new in s:
            continue
        assert old in s, (path.name, old[:60])
        s = s.replace(old, new, 1)
    path.write_text(s, encoding='utf-8', newline='\n')


# ---------- Android ----------
patch(ROOT / 'android/app/build.gradle', [
    ('        versionCode 1\n        versionName "1.0"\n',
     '        versionCode 1\n        versionName "1.0.0"\n'
     '        // AdMob の ID はここから読む(唯一の置き場所は ads-config.json)\n'
     '        manifestPlaceholders = [admobAppId: new groovy.json.JsonSlurper().parse(rootProject.file("../ads-config.json")).android.appId]\n'),
    ('    buildTypes {\n        release {\n            minifyEnabled false\n',
     '    // 公開用の署名。鍵とパスワードは scripts/build-android.ps1 が環境変数で渡す(リポジトリには置かない)\n'
     '    signingConfigs {\n'
     '        release {\n'
     '            if (System.getenv("KM_UPLOAD_STORE")) {\n'
     '                storeFile file(System.getenv("KM_UPLOAD_STORE"))\n'
     '                storePassword System.getenv("KM_UPLOAD_PASSWORD")\n'
     '                keyAlias "kachimake-upload"\n'
     '                keyPassword System.getenv("KM_UPLOAD_PASSWORD")\n'
     '            }\n'
     '        }\n'
     '    }\n'
     '    buildTypes {\n        release {\n'
     '            if (System.getenv("KM_UPLOAD_STORE")) signingConfig signingConfigs.release\n'
     '            minifyEnabled false\n'),
])
patch(ROOT / 'android/app/src/main/AndroidManifest.xml', [
    ('            android:launchMode="singleTask"\n',
     '            android:launchMode="singleTask"\n            android:screenOrientation="portrait"\n'),
    ('        <provider\n',
     '        <!-- AdMob のアプリID。ads-config.json から app/build.gradle 経由で入る -->\n'
     '        <meta-data\n'
     '            android:name="com.google.android.gms.ads.APPLICATION_ID"\n'
     '            android:value="${admobAppId}"/>\n\n'
     '        <provider\n'),
    ('    <uses-permission android:name="android.permission.INTERNET" />\n',
     '    <uses-permission android:name="android.permission.INTERNET" />\n'
     '    <uses-permission android:name="com.google.android.gms.permission.AD_ID" />\n'),
])

# ---------- iOS ----------
dn = DN_PLIST.read_text(encoding='utf-8')
skan = re.search(r'\t<key>SKAdNetworkItems</key>\n\t<array>.*?\n\t</array>\n', dn, re.S).group(0)
plist = ROOT / 'ios/App/App/Info.plist'
patch(plist, [
    ('\t<key>CFBundleDevelopmentRegion</key>\n\t<string>en</string>',
     '\t<key>CFBundleDevelopmentRegion</key>\n\t<string>ja</string>'),
    ('\t<key>LSRequiresIPhoneOS</key>\n',
     '\t<!-- AdMob のアプリID。npm run sync のたびに ads-config.json から書き直す(scripts/sync-ios-ads.mjs) -->\n'
     '\t<key>GADApplicationIdentifier</key>\n\t<string>ca-app-pub-3940256099942544~1458002511</string>\n'
     + skan +
     '\t<key>NSUserTrackingUsageDescription</key>\n'
     '\t<string>許可すると、広告があなたに合ったものになります。許可しなくても広告は出ますが、記入の内容が広告に使われることはありません。</string>\n'
     '\t<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>\n'
     '\t<key>LSRequiresIPhoneOS</key>\n'),
    ('\t\t<string>armv7</string>', '\t\t<string>arm64</string>'),
    ('\t<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t\t<string>UIInterfaceOrientationLandscapeLeft</string>\n\t\t<string>UIInterfaceOrientationLandscapeRight</string>\n\t</array>',
     '\t<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t</array>'),
])
pbx = ROOT / 'ios/App/App.xcodeproj/project.pbxproj'
s = pbx.read_text(encoding='utf-8')
s = s.replace('TARGETED_DEVICE_FAMILY = "1,2";', 'TARGETED_DEVICE_FAMILY = 1;').replace('MARKETING_VERSION = 1.0;', 'MARKETING_VERSION = 1.0.0;')
pbx.write_text(s, encoding='utf-8', newline='\n')
print('ok')
