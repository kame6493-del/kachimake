package jp.kachimake.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** アプリを離れるたびに、ホーム画面のウィジェットへ最新の収支を出す */
    @Override
    public void onPause() {
        super.onPause();
        try {
            MonthWidget.refresh(this);
        } catch (Exception e) {
            // ウィジェットが無い・描けないときもアプリは止めない
        }
    }
}
