import streamlit as st
import os
import tempfile
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import google.generativeai as genai
from moviepy.editor import VideoFileClip, AudioFileClip, CompositeAudioClip

# ==========================================
# ページ設定とヘッダー
# ==========================================
st.set_page_config(
    page_title="ポケカ/ワンピ開封 Shorts動画ジェネレーター",
    page_icon="🎬",
    layout="centered"
)

st.title("🎬 ポケカ/ワンピ開封 Shorts動画ジェネレーター")
st.subheader("パック開封動画からYouTube Shorts用縦型動画(9:16)を自動生成")
st.write("横画面の開封動画を自動で9:16にクロップし、AI(Gemini)がレアカードを認識して最新の相場価格テロップを表示します。")

# ==========================================
# フォント取得ヘルパー
# ==========================================
def get_japanese_font(size):
    font_paths = [
        "C:\\Windows\\Fonts\\meiryo.ttc",       # Windows
        "C:\\Windows\\Fonts\\msgothic.ttc",     # Windows
        "C:\\Windows\\Fonts\\YuGothM.ttc",      # Windows
        "/System/Library/Fonts/NotoSansCJKjp-Regular.otf",  # Mac
        "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",  # Linux
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"  # Linux
    ]
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()

# ==========================================
# テロップ描画ヘルパー
# ==========================================
def draw_text_with_outline(draw, text, position, font, text_color=(255, 255, 255), outline_color=(0, 0, 0), outline_width=3):
    x, y = position
    # 縁取りを描画
    for dx in range(-outline_width, outline_width + 1):
        for dy in range(-outline_width, outline_width + 1):
            if dx*dx + dy*dy <= outline_width*outline_width:
                draw.text((x + dx, y + dy), text, font=font, fill=outline_color)
    # 本体を描画
    draw.text((x, y), text, font=font, fill=text_color)

def draw_centered_text(draw, text, y_position, font, text_color, outline_color, outline_width, img_width):
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
    except Exception:
        # 古いPillow用のフォールバック
        text_w, _ = draw.textsize(text, font=font)
    
    x = (img_width - text_w) // 2
    draw_text_with_outline(draw, text, (x, y_position), font, text_color, outline_color, outline_width)

# ==========================================
# UI入力エリア
# ==========================================
st.sidebar.header("⚙️ 各種設定")

# 1. APIキーの設定
api_key = st.sidebar.text_input("Google Gemini API キー", type="password", help="AI Studioから取得したAPIキーを入力してください。")
if not api_key:
    api_key = os.environ.get("GEMINI_API_KEY", "")

# 2. 動画アップロード
st.sidebar.subheader("📂 素材アップロード")
uploaded_file = st.sidebar.file_uploader("開封動画ファイルを選択 (.mp4, .mov)", type=["mp4", "mov"])

# 3. パック情報
st.sidebar.subheader("📝 動画内テロップ情報")
card_game = st.sidebar.selectbox("カードゲーム", ["ポケモンカード", "ワンピースカード"])
pack_name = st.sidebar.text_input("パック名 / BOX名", placeholder="例：超電ブレイカー")
pack_count = st.sidebar.text_input("パック数 / BOX数", placeholder="例：10パック開封")

# 4. Shorts最適化設定
st.sidebar.subheader("📈 Shorts動画最適化設定")
enable_loop = st.sidebar.checkbox("シームレスループ最適化", value=True, help="エンディングから冒頭へ戻る繋ぎ目をスムーズにするため、最後の音声にフェードアウトを適用します。")
enable_voice_cta = st.sidebar.checkbox("エンディング音声呼びかけ (TTS)", value=True, help="エンディングで『チャンネル登録と高評価をお願いします！』と明確なナレーションが入ります。")
enable_comment_prompt = st.sidebar.checkbox("コメント誘発テロップを表示", value=True, help="エンディング手前にコメントを促す問いかけを表示してエンゲージメントを高めます。")

comment_prompt_text = st.sidebar.selectbox(
    "問いかけテロップのテキスト",
    options=[
        "みんなならいくらで売る？コメントで教えてね！",
        "このカード持ってる人はコメントで教えて！",
        "このパックの最高額カード知ってる？コメントへ！",
        "カスタムテキストを入力する..."
    ],
    index=0
)
if comment_prompt_text == "カスタムテキストを入力する...":
    comment_prompt_text = st.sidebar.text_input("カスタム問いかけテキスト", "みんなならいくらで売る？コメントで教えてね！")

# ==========================================
# AIによるカード認識処理
# ==========================================
def analyze_video_with_gemini(video_path, card_game, pack_name, api_key):
    st.info("🤖 AIが動画のコマからレアカードの出現箇所と相場を検索しています...")
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")
    
    # 動画をロードしてフレームを抽出
    clip = VideoFileClip(video_path)
    duration = min(clip.duration, 60.0) # 最大60秒
    
    # 1.5秒おきにフレーム抽出して軽量化
    interval = 1.5
    timestamps = []
    t = 0.0
    while t < duration:
        timestamps.append(t)
        t += interval
        
    frames_to_send = []
    progress_bar = st.progress(0.0)
    
    for idx, t_val in enumerate(timestamps):
        frame = clip.get_frame(t_val) # RGB numpy array
        img = Image.fromarray(frame)
        img.thumbnail((360, 360)) # Gemini送信用の軽量化リサイズ
        frames_to_send.append(img)
        progress_bar.progress((idx + 1) / len(timestamps))
    
    clip.close()

    # Gemini へのプロンプト
    prompt = f"""
以下の画像群は、カードパック開封動画から{interval}秒間隔で順に抽出したフレームです。
対象カードゲーム: {card_game}
開封パック名: {pack_name}

動画中に、開封によって新しく画面中央付近に出現したレアカード（SR、SAR、UR、SEC、パラレル、またはホロ等の光っているカード）を特定してください。
各レアカードの出現タイミングを検出し、以下のJSON配列フォーマットのみで出力してください。

出力フォーマットの例:
[
  {{
    "timestamp_sec": 7.5,
    "card_name": "ピカチュウ SR",
    "estimated_price_jpy": 12000
  }}
]

重要なルール:
1. 通常のコモンカード、関係のない文字や背景は完全に無視し、出現を記録しないでください。
2. 相場価格(estimated_price_jpy)は、あなたの知識データに基づいて現在の推定価格を日本円（数値）で入力してください。
3. レアカードが出現していない場合は、必ず空の配列 `[]` を返してください。
4. 返答にはマークダウンの ```json や説明テキストなどを一切含めず、純粋なJSONテキストのみを出力してください。
"""

    try:
        response = model.generate_content([prompt, *frames_to_send])
        raw_text = response.text.strip()
        
        # ```json などの余計な記述をクリーンアップ
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
            
        detections = json.loads(raw_text.strip())
        st.success(f"🤖 AIカード解析完了！ {len(detections)}個のレアカードを特定しました。")
        return detections
    except Exception as e:
        st.warning(f"⚠️ AI解析中にエラーが発生しました（モックデータで処理します）: {e}")
        # フォールバック用デモデータ
        return [
            {"timestamp_sec": 5.0, "card_name": "デモレアカード", "estimated_price_jpy": 5000}
        ]

# ==========================================
# 動画生成メインパイプライン
# ==========================================
def process_video(input_path, output_path, card_game, pack_name, pack_count, detections,
                  enable_loop, enable_voice_cta, enable_comment_prompt, comment_prompt_text):
    st.info("🎬 動画の編集・クロップ・テロップ合成を開始します...")
    
    # ナレーション音声ファイル (gTTS) の準備
    temp_audio_path = None
    if enable_voice_cta:
        try:
            from gtts import gTTS
            st.info("🎙️ ナレーション音声を生成中...")
            tts = gTTS(text="チャンネル登録と高評価をお願いします！", lang="ja")
            temp_audio_path = os.path.join(tempfile.gettempdir(), "shorts_cta.mp3")
            tts.save(temp_audio_path)
        except Exception as e:
            st.warning(f"⚠️ 音声合成の生成に失敗しました（声なしで進行します）: {e}")
            enable_voice_cta = False

    # 動画の読み込み
    clip = VideoFileClip(input_path)
    original_duration = clip.duration
    duration = min(original_duration, 60.0) # 最大60秒制限
    
    if original_duration > 60.0:
        clip = clip.subclip(0, 60.0)
        st.warning("⚠️ 動画が60秒を超えていたため、前半60秒に自動カットされました。")
        
    w, h = clip.w, clip.h
    
    # 9:16比率のクロップ計算
    target_aspect = 9.0 / 16.0
    target_w = int(h * target_aspect)
    x1 = (w - target_w) // 2
    x2 = x1 + target_w
    y1 = 0
    y2 = h
    
    cropped_clip = clip.crop(x1=x1, y1=y1, x2=x2, y2=y2)
    resized_clip = cropped_clip.resize((1080, 1920))
    
    # テロップ合成用フレームプロセッサ
    def frame_processor(get_frame, t):
        frame = get_frame(t) # RGB numpy array
        img = Image.fromarray(frame)
        
        # 透過テロップベース描画用のオーバーレイレイヤー作成
        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        draw_ol = ImageDraw.Draw(overlay)
        
        # フォント読み込み
        font_large = get_japanese_font(65)
        font_medium = get_japanese_font(48)
        font_small = get_japanese_font(42)
        
        # 1. オープニング演出 (冒頭 2.5秒)
        if t < 2.5:
            # 中央バナー
            banner_h = 280
            banner_y = (1920 - banner_h) // 2
            draw_ol.rectangle([0, banner_y, 1080, banner_y + banner_h], fill=(0, 0, 0, 170))
            img = Image.alpha_composite(img.convert("RGBA"), overlay)
            draw = ImageDraw.Draw(img)
            
            draw_centered_text(draw, f"【{card_game}】", banner_y + 30, font_medium, (255, 255, 255), (0, 0, 0), 4, 1080)
            draw_centered_text(draw, f"{pack_name}", banner_y + 100, font_large, (255, 215, 0), (0, 0, 0), 5, 1080)
            draw_centered_text(draw, f"🔥 {pack_count} 🔥", banner_y + 190, font_medium, (255, 255, 255), (0, 0, 0), 4, 1080)
            return np.array(img.convert("RGB"))
            
        # 2. エンディング演出 (ラスト 2.5秒)
        elif t >= (duration - 2.5):
            banner_h = 240
            banner_y = 1150
            draw_ol.rectangle([0, banner_y, 1080, banner_y + banner_h], fill=(0, 0, 0, 170))
            img = Image.alpha_composite(img.convert("RGBA"), overlay)
            draw = ImageDraw.Draw(img)
            
            draw_centered_text(draw, "チャンネル登録・高評価", banner_y + 35, font_large, (255, 255, 255), (0, 0, 0), 5, 1080)
            draw_centered_text(draw, "よろしくお願いします！", banner_y + 130, font_large, (255, 215, 0), (0, 0, 0), 5, 1080)
            return np.array(img.convert("RGB"))
            
        # 3. メインパート (2.5秒 〜 duration - 2.5秒)
        else:
            # 3.1. コメント誘発テロップの背景描画 (エンディング前3.5秒間: duration-6.0秒 〜 duration-2.5秒)
            if enable_comment_prompt and (duration - 6.0 <= t < duration - 2.5):
                banner_h = 160
                banner_y = 1200
                draw_ol.rectangle([0, banner_y, 1080, banner_y + banner_h], fill=(0, 0, 0, 170))

            # 3.2. カード価格の背景描画
            active_card = None
            for d in detections:
                start_t = d["timestamp_sec"]
                end_t = start_t + 4.0
                if start_t <= t < end_t:
                    active_card = d # 重複時は最後のものを優先
            
            if active_card:
                c_name = active_card["card_name"]
                c_price = active_card["estimated_price_jpy"]
                banner_h = 220
                banner_y_card = 1450
                draw_ol.rectangle([0, banner_y_card, 1080, banner_y_card + banner_h], fill=(20, 20, 20, 190))
                
            img = Image.alpha_composite(img.convert("RGBA"), overlay)
            draw = ImageDraw.Draw(img)
            
            # テキスト描画
            if enable_comment_prompt and (duration - 6.0 <= t < duration - 2.5):
                draw_centered_text(draw, comment_prompt_text, 1200 + 45, font_medium, (255, 128, 0), (0, 0, 0), 4, 1080)
                
            if active_card:
                draw_centered_text(draw, f"✨ {c_name} ✨", 1450 + 25, font_medium, (255, 255, 255), (0, 0, 0), 4, 1080)
                draw_centered_text(draw, f"最新相場価格: ¥{c_price:,}", 1450 + 110, font_large, (0, 255, 128), (0, 0, 0), 5, 1080)
                
            return np.array(img.convert("RGB"))
        
        return frame
        
    # 動画変換処理の適用
    final_clip = resized_clip.fl(frame_processor)
    
    # 音声の処理と統合
    orig_audio = clip.audio
    cta_audio = None
    
    if enable_voice_cta and temp_audio_path and os.path.exists(temp_audio_path):
        try:
            cta_clip = AudioFileClip(temp_audio_path)
            cta_start_t = max(0.0, duration - 2.5)
            cta_audio = cta_clip.set_start(cta_start_t)
        except Exception as mix_err:
            st.warning(f"⚠️ 音声合成の合成処理に失敗しました: {mix_err}")
            cta_audio = None

    if cta_audio:
        if orig_audio is not None:
            # 無限ループ用のフェードアウト適用
            if enable_loop:
                orig_audio_adjusted = orig_audio.audio_fadeout(0.8)
            else:
                orig_audio_adjusted = orig_audio
            combined_audio = CompositeAudioClip([orig_audio_adjusted, cta_audio])
        else:
            combined_audio = cta_audio
        final_clip = final_clip.set_audio(combined_audio)
    else:
        if orig_audio is not None:
            if enable_loop:
                final_clip = final_clip.set_audio(orig_audio.audio_fadeout(0.8))
            else:
                final_clip = final_clip.set_audio(orig_audio)
    
    # 書き出し設定 (H.264 / AAC)
    has_audio = final_clip.audio is not None
    write_args = {
        "filename": output_path,
        "codec": "libx264",
        "audio": has_audio,
        "preset": "medium",
        "threads": 4
    }
    if has_audio:
        write_args["audio_codec"] = "aac"
        write_args["temp_audiofile"] = os.path.join(tempfile.gettempdir(), "temp-audio.m4a")
        write_args["remove_temp"] = True
        
    st.info("⏳ レンダリング中... しばらくお待ちください（動画の長さに比例して時間がかかります）")
    
    final_clip.write_videofile(**write_args)
    
    # クローズ処理
    clip.close()
    final_clip.close()
    
    # 一時音声ファイルのクリーンアップ
    if temp_audio_path and os.path.exists(temp_audio_path):
        try:
            os.remove(temp_audio_path)
        except Exception:
            pass
            
    st.success("🎉 Shorts動画の生成が完了しました！")

# ==========================================
# メイン実行フロー
# ==========================================
st.write("---")
if not api_key:
    st.warning("⚠️ Gemini API キーが設定されていません。サイドバーに入力するか、環境変数 GEMINI_API_KEY を設定してください。")

if uploaded_file is None:
    st.info("👈 サイドバーから動画をアップロードし、各項目を入力してください。")
else:
    st.success(f"動画アップロード成功: `{uploaded_file.name}`")
    
    can_generate = True
    if not pack_name:
        st.error("❌ パック名を入力してください。")
        can_generate = False
    if not pack_count:
        st.error("❌ パック数/BOX数を入力してください。")
        can_generate = False
        
    if can_generate:
        if st.button("🚀 Shorts動画を自動生成する", use_container_width=True):
            try:
                # 一時ファイルとして動画を保存
                with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_input:
                    temp_input.write(uploaded_file.read())
                    temp_input_path = temp_input.name
                
                temp_output_path = os.path.join(tempfile.gettempdir(), f"shorts_{uploaded_file.name}")
                
                # 1. AI解析
                detections = analyze_video_with_gemini(temp_input_path, card_game, pack_name, api_key)
                
                # 2. 動画編集・書き出し
                process_video(
                    input_path=temp_input_path,
                    output_path=temp_output_path,
                    card_game=card_game,
                    pack_name=pack_name,
                    pack_count=pack_count,
                    detections=detections,
                    enable_loop=enable_loop,
                    enable_voice_cta=enable_voice_cta,
                    enable_comment_prompt=enable_comment_prompt,
                    comment_prompt_text=comment_prompt_text
                )
                
                # 3. プレビューとダウンロードボタン
                with open(temp_output_path, "rb") as video_file:
                    video_bytes = video_file.read()
                    
                st.write("### 📺 完成動画プレビュー")
                st.video(video_bytes)
                
                st.download_button(
                    label="📥 生成された動画を保存（ダウンロード）",
                    data=video_bytes,
                    file_name=f"shorts_{pack_name}_{uploaded_file.name}",
                    mime="video/mp4",
                    use_container_width=True
                )
                
                # 一時ファイル削除
                os.remove(temp_input_path)
                
            except Exception as e:
                st.error(f"❌ 処理中に致命的なエラーが発生しました: {e}")
