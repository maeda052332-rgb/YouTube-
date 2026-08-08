// ==========================================
// せどり動画 AI吹き替え・台本再生成ツール (video_app.js)
// ==========================================

// グローバル要素取得ヘルパー
function safeGetElement(id) {
  return document.getElementById(id);
}

// アップロードされた動画ファイルオブジェクト
let uploadedVideoFile = null;
let uploadedVideoUrl = null;
let currentVideoAnalysisData = null;

// 音声再生・吹き替え録画関連
let videoAudioContext = null;
let videoAudioDestination = null;
let videoBgmInterval = null;
let dubbingRecorder = null;
let dubbingRecordedChunks = [];
let isDubbingExporting = false;
let videoSourceNode = null;
let speakerGainNode = null;
let decodedAudioBuffer = null;
let activeAudioSource = null;

// 初期化処理
window.onload = function () {
  setupVideoDubbingListeners();
  loadSavedApiKey();
};

// APIキーの自動読み込み・保存
function loadSavedApiKey() {
  const apiKeyInput = safeGetElement('gemini-api-key');
  if (!apiKeyInput) return;

  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey) {
    apiKeyInput.value = savedKey;
  }

  apiKeyInput.addEventListener('input', (e) => {
    localStorage.setItem('gemini_api_key', e.target.value.trim());
  });
}

// 金額フォーマット関数
function formatCurrency(amount) {
  const num = Number(amount);
  if (isNaN(num)) return '¥0';
  return '¥' + num.toLocaleString('ja-JP');
}

// リスナーのセットアップ
function setupVideoDubbingListeners() {
  const videoDropArea = safeGetElement('video-drop-area');
  const videoFileInput = safeGetElement('video-file-input');
  const btnRemoveVideo = safeGetElement('btn-remove-video');
  const btnGenerateScript = safeGetElement('btn-generate-video-script');
  const btnStartDubbing = safeGetElement('btn-video-dubbing');

  if (!videoDropArea || !videoFileInput) return;

  // 1. ドラッグ＆ドロップ動作
  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    videoDropArea.addEventListener(eventName, preventDefaults, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    videoDropArea.addEventListener(eventName, () => videoDropArea.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    videoDropArea.addEventListener(eventName, () => videoDropArea.classList.remove('dragover'), false);
  });

  videoDropArea.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    handleVideoFileSelected(file);
  }, false);

  // 領域クリックでファイル選択
  videoDropArea.addEventListener('click', (e) => {
    // 削除ボタンやビデオコントロールをクリックしたときは除外、またファイル選択インプット自体からのバブルも無視
    if (e.target.closest('#btn-remove-video') || e.target.closest('video') || e.target === videoFileInput) return;
    videoFileInput.click();
  });

  // ファイル入力要素でのクリックバブリングを防いで、クリックイベントの無限ループ（再帰）を防止する
  videoFileInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  videoFileInput.addEventListener('change', (e) => {
    handleVideoFileSelected(e.target.files[0]);
  });

  // 動画削除
  if (btnRemoveVideo) {
    btnRemoveVideo.addEventListener('click', (e) => {
      e.stopPropagation();
      resetVideoUpload();
    });
  }

  // 台本再生成
  if (btnGenerateScript) {
    btnGenerateScript.addEventListener('click', () => {
      executeVideoScriptGeneration();
    });
  }

  // 吹き替え動画生成
  if (btnStartDubbing) {
    btnStartDubbing.addEventListener('click', () => {
      // ユーザージェスチャーの直下で同期的にAudioContextを初期化/再開してスマホ対策を行う
      if (!videoAudioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          videoAudioContext = new AudioContextClass();
        }
      }
      if (videoAudioContext && videoAudioContext.state === 'suspended') {
        videoAudioContext.resume();
      }
      exportDubbedVideo();
    });
  }

  // SRT字幕ダウンロード
  const btnDownloadSrt = safeGetElement('btn-download-srt');
  if (btnDownloadSrt) {
    btnDownloadSrt.addEventListener('click', () => {
      downloadSrtFile();
    });
  }

  // JSONダウンロード
  const btnDownloadJson = safeGetElement('btn-download-json');
  if (btnDownloadJson) {
    btnDownloadJson.addEventListener('click', () => {
      downloadJsonScript();
    });
  }

  // タブ切り替え
  const tabBtns = document.querySelectorAll('.script-tab-btn');
  tabBtns.forEach(btn => {
    btn.onclick = (e) => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const style = btn.getAttribute('data-style');
      if (currentVideoAnalysisData) {
        renderScriptViewer(currentVideoAnalysisData.scripts[style]);
      }
    };
  });
}

// ビデオ選択時の処理
function handleVideoFileSelected(file) {
  if (!file) return;
  if (!file.type.startsWith('video/')) {
    alert('動画ファイル（MP4, WebM, MOVなど）を選択してください。');
    return;
  }

  uploadedVideoFile = file;
  uploadedVideoUrl = URL.createObjectURL(file);
  decodedAudioBuffer = null; // リセット

  const videoEl = safeGetElement('source-video');
  const previewContainer = safeGetElement('video-preview-container');
  const placeholder = safeGetElement('video-placeholder');
  const btnGenerate = safeGetElement('btn-generate-video-script');

  if (videoEl) {
    videoEl.src = uploadedVideoUrl;
    videoEl.load();
  }

  if (previewContainer) previewContainer.classList.remove('hidden');
  if (placeholder) placeholder.classList.add('hidden');
  if (btnGenerate) btnGenerate.disabled = false;

  // 動画の音声を非同期でデコード
  decodeVideoAudio(file);
}

// 動画の音声トラックを Web Audio バッファとしてデコードする関数 (CORS制限の回避)
async function decodeVideoAudio(file) {
  try {
    await initDubbingAudio();
    if (!videoAudioContext) return;

    console.log("動画の音声デコードを開始します...");
    const reader = new FileReader();
    reader.onload = async function (e) {
      const arrayBuffer = e.target.result;
      videoAudioContext.decodeAudioData(arrayBuffer)
        .then(buffer => {
          decodedAudioBuffer = buffer;
          console.log("音声デコード成功。バッファサイズ: " + buffer.length);
        })
        .catch(err => {
          console.error("音声デコードエラー (非対応コーデックまたは無音):", err);
          decodedAudioBuffer = null;
        });
    };
    reader.readAsArrayBuffer(file);
  } catch (err) {
    console.error("AudioContext初期化エラー:", err);
  }
}

// アップロード動画のリセット
function resetVideoUpload() {
  uploadedVideoFile = null;
  decodedAudioBuffer = null;
  if (activeAudioSource) {
    try {
      activeAudioSource.stop();
    } catch (e) {}
    activeAudioSource = null;
  }
  if (uploadedVideoUrl) {
    URL.revokeObjectURL(uploadedVideoUrl);
    uploadedVideoUrl = null;
  }

  const videoEl = safeGetElement('source-video');
  const previewContainer = safeGetElement('video-preview-container');
  const placeholder = safeGetElement('video-placeholder');
  const btnGenerate = safeGetElement('btn-generate-video-script');
  const outputCard = safeGetElement('script-output-card');

  if (videoEl) {
    videoEl.src = "";
  }

  const fileInput = safeGetElement('video-file-input');
  if (fileInput) fileInput.value = "";

  if (previewContainer) previewContainer.classList.add('hidden');
  if (placeholder) placeholder.classList.remove('hidden');
  if (btnGenerate) btnGenerate.disabled = true;
  if (outputCard) outputCard.classList.add('hidden');
  
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// 台本再生成フローの実行
async function executeVideoScriptGeneration() {
  const statusCard = safeGetElement('generation-status-card');
  const outputCard = safeGetElement('script-output-card');
  const progressBar = safeGetElement('status-progress-bar');

  if (statusCard) statusCard.classList.remove('hidden');
  if (outputCard) outputCard.classList.add('hidden');

  const steps = ['step-1', 'step-2', 'step-3'];
  steps.forEach(id => {
    const el = safeGetElement(id);
    if (el) {
      el.className = 'step-pending';
      const icon = el.querySelector('i');
      if (icon) icon.className = 'fa-regular fa-circle';
    }
  });
  if (progressBar) progressBar.style.width = '0%';

  // 1. 動画解析
  await changeStepState('step-1', 'active', 33);
  await delay(1500);
  await changeStepState('step-1', 'completed', 33);

  // 2. 音声スクリプト構築
  await changeStepState('step-2', 'active', 66);
  await delay(1200);
  await changeStepState('step-2', 'completed', 66);

  // 3. ナレーション台本作成
  await changeStepState('step-3', 'active', 90);

  const apiKey = safeGetElement('gemini-api-key')?.value.trim();
  let resultData = null;

  if (apiKey) {
    try {
      resultData = await fetchVideoScriptFromGemini(apiKey);
    } catch (e) {
      console.error(e);
      alert('Gemini APIエラー。デモ台本を生成します。');
      resultData = generateMockVideoScript();
    }
  } else {
    resultData = generateMockVideoScript();
  }

  await delay(800);
  await changeStepState('step-3', 'completed', 100);
  await delay(500);

  if (statusCard) statusCard.classList.add('hidden');
  displayVideoScript(resultData);
}

// ユーティリティ
function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function changeStepState(stepId, state, percentage) {
  const el = safeGetElement(stepId);
  const bar = safeGetElement('status-progress-bar');
  if (bar) bar.style.width = `${percentage}%`;

  if (el) {
    el.className = `step-${state}`;
    const icon = el.querySelector('i');
    if (icon) {
      if (state === 'active') {
        icon.className = 'fa-solid fa-spinner fa-spin';
      } else if (state === 'completed') {
        icon.className = 'fa-solid fa-circle-check';
      } else {
        icon.className = 'fa-regular fa-circle';
      }
    }
  }
}

// Gemini API からの動画台本生成 (テキスト・メタデータベース)
async function fetchVideoScriptFromGemini(apiKey) {
  const videoEl = safeGetElement('source-video');
  const duration = videoEl ? Math.round(videoEl.duration) : 30;
  
  const promptText = `
あなたはトレーディングカード開封動画の吹き替えクリエイターです。
アップロードされた動画（再生時間: ${duration}秒）にぴったりと合う、新しくバズるショート動画用の開封吹き替えナレーション台本を作成してください。

【制約ルール】
1. 動画の元の映像の流れを活かし、カードパック（またはBOX）を開封して激レアカードが出現し、アド（利益）が確定するプロセスをドラマチックに説明する台本にします。
2. ナレーション台本は4つのシーン（合計時間: ${duration}秒）に綺麗に等分割できるように構成してください。
3. ナレーションセリフは1シーンあたり20〜30文字程度の、テンポが良い非常に短い語り口にしてください。無駄な挨拶や前置きは完全に排除します。
4. カードの相場価格、パック代（仕入れ値）、アド額（利益額）などの数値は、視聴者の心を惹きつける具体的なリアル値（例: カード相場50,000円、パック代500円、アド（利益）49,500円など）を設定してください。
   ※ 利益 ＝ 販売価格（カード相場） － 仕入れ価格（パック代） とし、余計な手数料等は考慮しないでください。
5. 利益率（還元率） ＝ 利益 ÷ 販売価格 × 100 (%) を四捨五入した整数で計算してください。
6. すべてのスクリプトスタイルにおいて、最後のシーン（4番目のシーン）の吹き替え用セリフ（speech）の末尾には、必ず視聴者に対してチャンネル登録といいねを促すフレーズとして「チャンネル登録・いいねをお願いします！」を必ず含めてください。

【出力フォーマット】
以下のJSON構造のみを返してください。余計なマークダウンの \`\`\`json ラッパーや説明テキストは一切含めないでください。

{
  "productName": "出現した激レアカード名（例: リザードン SAR）",
  "sellPrice": カードの相場価格(数値),
  "purchasePrice": パック代/BOX代(数値),
  "profit": アド額(相場価格 - パック代の数値),
  "profitRate": 還元率(数値、四捨五入した整数),
  "scripts": {
    "buzz": [
      {
        "title": "シーン名",
        "time": "シーン時間",
        "speech": "簡潔な吹き替え用セリフ"
      }
    ],
    "educational": [
      {
        "title": "シーン名",
        "time": "シーン時間",
        "speech": "簡潔な吹き替え用セリフ"
      }
    ],
    "story": [
      {
        "title": "シーン名",
        "time": "シーン時間",
        "speech": "簡潔な吹き替え用セリフ"
      }
    ]
  }
}
`;

  const requestBody = {
    contents: [
      { parts: [{ text: promptText }] }
    ],
    generationConfig: { responseMimeType: "application/json" }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`Gemini API returned status ${response.status}`);
  }

  const jsonResult = await response.json();
  const rawText = jsonResult.candidates[0].content.parts[0].text;
  return JSON.parse(rawText);
}

// デモ用の吹き替え台本生成
function generateMockVideoScript() {
  const videoEl = safeGetElement('source-video');
  const totalDuration = videoEl ? videoEl.duration : 32;
  const stepSec = Math.round(totalDuration / 4);

  const sellPrice = 25000;
  const purchasePrice = 500;
  const profit = sellPrice - purchasePrice;
  const profitRate = Math.round((profit / sellPrice) * 100);

  const makeTimeStr = (idx) => {
    return `${idx * stepSec}〜${(idx + 1) * stepSec}秒`;
  };

  return {
    productName: "超人気激レアカード",
    sellPrice,
    purchasePrice,
    profit,
    profitRate,
    scripts: {
      buzz: [
        { title: "フック", time: makeTimeStr(0), speech: "1パック500円から激レアカード降臨！一撃アド" + formatCurrency(profit) + "の奇跡を見よ！" },
        { title: "開封カード", time: makeTimeStr(1), speech: "今回開封したのは新発売のパック。1パックわずか" + formatCurrency(purchasePrice) + "でした。" },
        { title: "レア出現", time: makeTimeStr(2), speech: "そしたらなんと、封入率激低のトップレアカードが出現！現在の相場は" + formatCurrency(sellPrice) + "！" },
        { title: "アド確定", time: makeTimeStr(3), speech: "アド額は" + formatCurrency(profit) + "、驚異の還元率" + profitRate + "%！今回のカードの詳細はプロフから！チャンネル登録・いいねをお願いします！" }
      ],
      educational: [
        { title: "導入", time: makeTimeStr(0), speech: "トレカ開封でアドを取る！" + formatCurrency(purchasePrice) + "のパックから" + formatCurrency(profit) + "相当のレアカードを引くコツを解説！" },
        { title: "ポイント解説", time: makeTimeStr(1), speech: "重要なのはパックの重さやシュリンクの状態。激レアカードは封入の仕様が異なります。" },
        { title: "価値解説", time: makeTimeStr(2), speech: "引き当てたカードは海外でも大人気で、取引相場は現在" + formatCurrency(sellPrice) + "まで高騰しています！" },
        { title: "まとめ", time: makeTimeStr(3), speech: "これで差し引きアドは" + formatCurrency(profit) + "。優良パックの見分け方は保存してね！チャンネル登録・いいねをお願いします！" }
      ],
      story: [
        { title: "状況説明", time: makeTimeStr(0), speech: "お小遣い月3000円の学生が、コンビニで奇跡的にラスト1パックだけ残っていたのを見つけた。" },
        { title: "行動", time: makeTimeStr(1), speech: "財布の中の" + formatCurrency(purchasePrice) + "を握りしめて購入。ただのノーマルカードだと思っていました。" },
        { title: "結果", time: makeTimeStr(2), speech: "しかし、開封の瞬間、光り輝くウルトラレアが！相場はなんと" + formatCurrency(sellPrice) + "越え！" },
        { title: "結び", time: makeTimeStr(3), speech: "手に入れたアドは" + formatCurrency(profit) + "。震えが止まりませんでした。チャンネル登録・いいねをお願いします！" }
      ]
    }
  };
}

// チャンネル登録・いいねを動画の最後に必ず入れるための強制適用関数
function enforceEndComment(data) {
  if (!data || !data.scripts) return;
  const phrase = "チャンネル登録・いいねをお願いします！";
  for (const style in data.scripts) {
    const scenes = data.scripts[style];
    if (scenes && scenes.length === 4) {
      let speech = scenes[3].speech;
      
      // 類似の既存フレーズを除去
      speech = speech.replace(/チャンネル登録[・と]?高評価[も]?よろし[くお]?[ね願い]?[しま]?す?[！]?/, '');
      speech = speech.replace(/チャンネル登録[・と]?高評価[も]?忘れずに[！]?/, '');
      speech = speech.replace(/チャンネル登録[・と]?いいね[も]?よろし[くお]?[ね願い]?[しま]?す?[！]?/, '');
      
      speech = speech.trim();
      
      if (!speech.includes("チャンネル登録") || !speech.includes("いいね")) {
        if (speech.length > 0 && !speech.endsWith('！') && !speech.endsWith('。') && !speech.endsWith('?')) {
          speech += '！';
        }
        speech += phrase;
      }
      scenes[3].speech = speech;
    }
  }
}

// 台本出力
function displayVideoScript(data) {
  // チャンネル登録・いいねの強制適用
  enforceEndComment(data);

  currentVideoAnalysisData = data;
  
  // 利益と利益率を強制再計算 (バグ回避。送料・手数料があれば考慮)
  const shipping = Number(data.shipping) || 0;
  const fee = Number(data.fee) || 0;
  currentVideoAnalysisData.profit = data.sellPrice - data.purchasePrice - shipping - fee;
  currentVideoAnalysisData.profitRate = data.sellPrice > 0 ? Math.round((currentVideoAnalysisData.profit / data.sellPrice) * 100) : 0;

  const outputCard = safeGetElement('script-output-card');
  const alertEl = safeGetElement('success-alert');

  if (outputCard) outputCard.classList.remove('hidden');
  if (alertEl) alertEl.style.display = 'flex';

  const activeTab = document.querySelector('.script-tab-btn.active');
  const style = activeTab ? activeTab.getAttribute('data-style') : 'buzz';
  renderScriptViewer(currentVideoAnalysisData.scripts[style]);
}

// 台本ビューアーレンダリング
function renderScriptViewer(scenes) {
  const viewer = safeGetElement('script-content-viewer');
  if (!viewer) return;

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  let html = `<div class="scene-list" style="margin-top: 1rem;">`;
  
  scenes.forEach((scene, index) => {
    html += `
      <div class="scene-card" style="margin-bottom: 1rem;">
        <div class="scene-header">
          <span><i class="fa-solid fa-volume-high"></i> シーン ${index + 1}: ${scene.title}</span>
          <span class="scene-time-badge">${scene.time}</span>
        </div>
        <div class="scene-body" style="grid-template-columns: 1fr;">
          <div class="scene-col" style="background-color: rgba(16, 185, 129, 0.02); padding: 1.25rem;">
            <div class="speech-text-wrapper" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <div class="speech-content" id="speech-text-${index}" style="font-size: 1rem; font-weight: 500; color: #fff;">${scene.speech}</div>
              <div style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn-scene-action btn-voice-play" data-index="${index}" style="color: var(--accent-color); padding: 0.5rem; border-radius: 8px; background: none; border: none; cursor: pointer;">
                  <i class="fa-solid fa-play"></i>
                </button>
                <button type="button" class="btn-scene-action btn-copy-scene" data-index="${index}" style="color: var(--text-sub); padding: 0.5rem; border-radius: 8px; background: none; border: none; cursor: pointer;">
                  <i class="fa-regular fa-copy"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  viewer.innerHTML = html;

  // ボタンイベント紐づけ
  viewer.querySelectorAll('.btn-voice-play').forEach(btn => {
    btn.onclick = (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
      playSingleSceneSpeech(scenes[idx].speech, e.currentTarget);
    };
  });

  viewer.querySelectorAll('.btn-copy-scene').forEach(btn => {
    btn.onclick = (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
      navigator.clipboard.writeText(scenes[idx].speech).then(() => {
        alert(`シーン ${idx + 1} のセリフをコピーしました。`);
      });
    };
  });
}

// 単一シーン音声再生
let currentSpeechBtn = null;
function playSingleSceneSpeech(text, button) {
  if (!window.speechSynthesis) return;

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    if (currentSpeechBtn === button) {
      button.innerHTML = '<i class="fa-solid fa-play"></i>';
      currentSpeechBtn = null;
      return;
    }
    if (currentSpeechBtn) {
      currentSpeechBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
  }

  currentSpeechBtn = button;
  button.innerHTML = '<i class="fa-solid fa-square"></i>';

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 1.05;

  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find(v => v.lang.startsWith('ja'));
  if (jaVoice) utterance.voice = jaVoice;

  utterance.onend = () => {
    button.innerHTML = '<i class="fa-solid fa-play"></i>';
    currentSpeechBtn = null;
  };
  utterance.onerror = () => {
    button.innerHTML = '<i class="fa-solid fa-play"></i>';
    currentSpeechBtn = null;
  };

  window.speechSynthesis.speak(utterance);
}

// AudioContext 初期化
async function initDubbingAudio() {
  if (!videoAudioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      videoAudioContext = new AudioContextClass();
      if (videoAudioContext.createMediaStreamDestination) {
        videoAudioDestination = videoAudioContext.createMediaStreamDestination();
        
        // Chromeの無音トラック破棄バグ対策：微弱な無音信号を常時流し、トラックをアクティブに保ちます
        try {
          const silentOsc = videoAudioContext.createOscillator();
          const silentGain = videoAudioContext.createGain();
          silentGain.gain.setValueAtTime(0.0001, videoAudioContext.currentTime); // 極微小な無音
          silentOsc.connect(silentGain);
          silentGain.connect(videoAudioDestination);
          silentOsc.start();
        } catch (oscErr) {
          console.error("Failed to create silent oscillator:", oscErr);
        }
      }
    }
  }
  if (videoAudioContext && videoAudioContext.state === 'suspended') {
    await videoAudioContext.resume();
  }
}

// BGMビートの開始
function startDubbingBgm() {
  if (!videoAudioContext) return;
  if (videoBgmInterval) clearInterval(videoBgmInterval);

  // 書き出し中は録音用、プレビュー時はスピーカー（destination）へ動的にルーティング
  const dest = isDubbingExporting ? videoAudioDestination : videoAudioContext.destination;
  let beatCount = 0;

  videoBgmInterval = setInterval(() => {
    if (!isDubbingExporting) return;
    
    // 2拍に1回バスドラム
    if (beatCount % 2 === 0) {
      triggerKick(videoAudioContext, dest);
    }
    // 全拍ハイハット
    triggerHihat(videoAudioContext, dest);

    beatCount++;
  }, 500);
}

function stopDubbingBgm() {
  if (videoBgmInterval) {
    clearInterval(videoBgmInterval);
    videoBgmInterval = null;
  }
}

function triggerKick(audioCtx, dest) {
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(dest);
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
  } catch (e) {}
}

function triggerHihat(audioCtx, dest) {
  try {
    const bufferSize = audioCtx.sampleRate * 0.05;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 8000;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start();
  } catch (e) {}
}

function playCoinSound(audioCtx, dest) {
  try {
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(987.77, audioCtx.currentTime);
    osc2.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.7);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(dest);
    osc1.start();
    osc2.start();
    osc1.stop(audioCtx.currentTime + 0.7);
    osc2.stop(audioCtx.currentTime + 0.7);
  } catch (e) {}
}

// 吹き替え動画（WebM）のエクスポート
async function exportDubbedVideo() {
  if (isDubbingExporting) return;

  const videoEl = safeGetElement('source-video');
  const canvas = safeGetElement('hidden-dubbing-canvas');
  if (!videoEl || !canvas || !currentVideoAnalysisData) {
    alert('動画、または台本データが見つかりません。');
    return;
  }

  await initDubbingAudio();

  isDubbingExporting = true;
  dubbingRecordedChunks = [];

  const btnDubbing = safeGetElement('btn-video-dubbing');
  const statusDiv = safeGetElement('dubbing-export-status');
  const progressBar = safeGetElement('dubbing-progress-bar');
  const progressText = safeGetElement('dubbing-progress-text');

  if (btnDubbing) btnDubbing.disabled = true;
  if (statusDiv) statusDiv.classList.remove('hidden');

  const activeTab = document.querySelector('.script-tab-btn.active');
  const styleKey = activeTab ? activeTab.getAttribute('data-style') : 'buzz';
  const scenes = currentVideoAnalysisData.scripts[styleKey];

  const totalDuration = videoEl.duration;

  // Canvasのサイズを読み込んだ動画の解像度に合わせる
  canvas.width = videoEl.videoWidth || 720;
  canvas.height = videoEl.videoHeight || 1280;
  const ctx = canvas.getContext('2d');

  // ビデオを最初から再生
  videoEl.currentTime = 0;
  videoEl.muted = true; // 書き出し中はプレビュー側のスピーカー音を消音

  // CORS制限を回避するため、事前にデコードした AudioBuffer から再生を行います
  if (decodedAudioBuffer && videoAudioContext && videoAudioDestination) {
    try {
      activeAudioSource = videoAudioContext.createBufferSource();
      activeAudioSource.buffer = decodedAudioBuffer;
      activeAudioSource.connect(videoAudioDestination);
    } catch (err) {
      console.error("AudioBufferSourceNodeの作成エラー:", err);
    }
  }

  // キャプチャストリーム
  const canvasStream = canvas.captureStream(30);
  const tracks = [];

  canvasStream.getVideoTracks().forEach(track => tracks.push(track));

  if (videoAudioDestination) {
    videoAudioDestination.stream.getAudioTracks().forEach(track => tracks.push(track));
  }

  // スマホ対応：MediaStream作成時にトラック配列を直接渡すことで音声欠落を防ぎます
  const mixedStream = new MediaStream(tracks);

  // MediaRecorder インスタンス生成 (スマホ・PC互換性を高めるため MP4/AAC 形式を最優先)
  let options = { mimeType: 'video/mp4;codecs=avc1,mp4a' };
  let extension = 'mp4';
  
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options = { mimeType: 'video/mp4' };
  }
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options = { mimeType: 'video/webm;codecs=vp9,opus' };
    extension = 'webm';
  }
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options = { mimeType: 'video/webm;codecs=vp8,opus' };
    extension = 'webm';
  }
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options = { mimeType: 'video/webm' };
    extension = 'webm';
  }
  
  try {
    dubbingRecorder = new MediaRecorder(mixedStream, options);
  } catch (e) {
    console.error('MediaRecorderの初期化に失敗しました。デフォルト設定を使います:', e);
    dubbingRecorder = new MediaRecorder(mixedStream);
    if (dubbingRecorder.mimeType && dubbingRecorder.mimeType.includes('mp4')) {
      extension = 'mp4';
    } else {
      extension = 'webm';
    }
  }
  
  dubbingRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      dubbingRecordedChunks.push(event.data);
    }
  };
  
  dubbingRecorder.onstop = () => {
    const blob = new Blob(dubbingRecordedChunks, { type: dubbingRecorder.mimeType || 'video/webm' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `吹き替え動画_${styleKey}_カード開封.${extension}`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
    
    isDubbingExporting = false;
    if (btnDubbing) btnDubbing.disabled = false;
    if (statusDiv) statusDiv.classList.add('hidden');
    stopDubbingBgm();
    
    // バッファ再生ソースのクリーンアップ
    if (activeAudioSource) {
      try {
        activeAudioSource.stop();
      } catch (e) {}
      activeAudioSource = null;
    }
    videoEl.muted = false; // 音声を元に戻す
    videoEl.pause();
    alert('吹き替え動画の作成が完了し、ダウンロードを開始しました！');
  };

  // ビデオ再生＆録音開始
  videoEl.play();
  dubbingRecorder.start();
  if (activeAudioSource) {
    activeAudioSource.start(0, 0); // 音声を動画の開始に同期して再生
  }
  startDubbingBgm();

  let lastFrameTime = 0;

  function renderDubbingFrame() {
    if (!isDubbingExporting) return;

    const curTime = videoEl.currentTime;

    // 進捗表示
    const progress = Math.min((curTime / totalDuration) * 100, 100);
    if (progressBar) progressBar.style.width = progress + '%';
    if (progressText) progressText.textContent = Math.round(progress) + '%';

    if (videoEl.ended || curTime >= totalDuration) {
      dubbingRecorder.stop();
      return;
    }

    // Canvasにビデオフレームを描画
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    // テロップ字幕の合成
    // 4シーンに均等に時間分割してテロップを乗せる
    const sceneIdx = Math.min(Math.floor((curTime / totalDuration) * 4), 3);
    const currentScene = scenes[sceneIdx];

    if (currentScene) {
      // 1. 上部アド（利益）バッジの描画
      ctx.save();
      const formattedProfit = formatCurrency(currentVideoAnalysisData.profit);
      const formattedRate = `${currentVideoAnalysisData.profitRate}%`;
      
      const profitLabel = '獲得アド';
      const badgeText = `${profitLabel} ${formattedProfit} (還元率 ${formattedRate})`;
      
      ctx.font = '800 24px "Noto Sans JP", sans-serif';
      const textWidth = ctx.measureText(badgeText).width;
      const badgeW = textWidth + 60;
      const badgeH = 56;
      const badgeX = (canvas.width - badgeW) / 2;
      const badgeY = 50;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 28);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, canvas.width / 2, badgeY + badgeH / 2);
      ctx.restore();

      // 2. シーン3（利益発表）突入時にコイン効果音を鳴らす
      if (sceneIdx === 2 && curTime - (totalDuration / 4 * 2) < 0.1 && curTime - lastFrameTime > 0) {
        playCoinSound(videoAudioContext, isDubbingExporting ? videoAudioDestination : videoAudioContext.destination);
      }

      // 3. 画面中央の巨大数字表示
      const centerY = 450;
      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 14;
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 6;

      if (sceneIdx === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 36px "Noto Sans JP", sans-serif';
        ctx.strokeText(profitLabel, canvas.width / 2, centerY - 90);
        ctx.fillText(profitLabel, canvas.width / 2, centerY - 90);
        ctx.fillStyle = '#facc15';
        ctx.font = '900 85px "Noto Sans JP", sans-serif';
        ctx.strokeText(`+${formattedProfit}!!`, canvas.width / 2, centerY + 10);
        ctx.fillText(`+${formattedProfit}!!`, canvas.width / 2, centerY + 10);
      } else if (sceneIdx === 1) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 36px "Noto Sans JP", sans-serif';
        ctx.strokeText('パック代', canvas.width / 2, centerY - 90);
        ctx.fillText('パック代', canvas.width / 2, centerY - 90);
        ctx.fillStyle = '#ef4444';
        ctx.font = '900 85px "Noto Sans JP", sans-serif';
        const formattedCost = formatCurrency(currentVideoAnalysisData.purchasePrice);
        ctx.strokeText(`${formattedCost}`, canvas.width / 2, centerY + 10);
        ctx.fillText(`${formattedCost}`, canvas.width / 2, centerY + 10);
      } else if (sceneIdx === 2) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 36px "Noto Sans JP", sans-serif';
        ctx.strokeText('カード相場', canvas.width / 2, centerY - 90);
        ctx.fillText('カード相場', canvas.width / 2, centerY - 90);
        ctx.fillStyle = '#10b981';
        ctx.font = '900 85px "Noto Sans JP", sans-serif';
        const formattedSellPrice = formatCurrency(currentVideoAnalysisData.sellPrice);
        ctx.strokeText(`${formattedSellPrice}`, canvas.width / 2, centerY + 10);
        ctx.fillText(`${formattedSellPrice}`, canvas.width / 2, centerY + 10);
      } else if (sceneIdx === 3) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 36px "Noto Sans JP", sans-serif';
        ctx.strokeText('還元率', canvas.width / 2, centerY - 90);
        ctx.fillText('還元率', canvas.width / 2, centerY - 90);
        ctx.fillStyle = '#06b6d4';
        ctx.font = '900 85px "Noto Sans JP", sans-serif';
        ctx.strokeText(`${formattedRate}`, canvas.width / 2, centerY + 10);
        ctx.fillText(`${formattedRate}`, canvas.width / 2, centerY + 10);
      }
      ctx.restore();

      // 4. 下部字幕の合成描画
      const text = currentScene.speech;
      const textY = 1130;
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Noto Sans JP", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 3;

      const charsPerLine = 16;
      if (text.length > charsPerLine) {
        const line1 = text.substring(0, charsPerLine);
        const line2 = text.substring(charsPerLine);
        ctx.strokeText(line1, canvas.width / 2, textY - 26);
        ctx.fillText(line1, canvas.width / 2, textY - 26);
        ctx.strokeText(line2, canvas.width / 2, textY + 26);
        ctx.fillText(line2, canvas.width / 2, textY + 26);
      } else {
        ctx.strokeText(text, canvas.width / 2, textY);
        ctx.fillText(text, canvas.width / 2, textY);
      }
      ctx.restore();
    }

    lastFrameTime = curTime;
    requestAnimationFrame(renderDubbingFrame);
  }

  requestAnimationFrame(renderDubbingFrame);
}

// SRT字幕ファイルのダウンロード
function downloadSrtFile() {
  const videoEl = safeGetElement('source-video');
  const totalDuration = videoEl ? videoEl.duration : 32;
  const stepSec = totalDuration / 4;
  
  const activeTab = document.querySelector('.script-tab-btn.active');
  const styleKey = activeTab ? activeTab.getAttribute('data-style') : 'buzz';
  const scenes = currentVideoAnalysisData ? currentVideoAnalysisData.scripts[styleKey] : null;
  if (!scenes) return;
  
  let srtContent = '';
  
  scenes.forEach((scene, index) => {
    const startSec = index * stepSec;
    const endSec = (index + 1) * stepSec;
    
    const formatTime = (totalSec) => {
      const hrs = Math.floor(totalSec / 3600).toString().padStart(2, '0');
      const mins = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
      const secs = Math.floor(totalSec % 60).toString().padStart(2, '0');
      const ms = Math.floor((totalSec % 1) * 1000).toString().padStart(3, '0');
      return `${hrs}:${mins}:${secs},${ms}`;
    };
    
    srtContent += `${index + 1}\n`;
    srtContent += `${formatTime(startSec)} --> ${formatTime(endSec)}\n`;
    srtContent += `${scene.speech}\n\n`;
  });
  
  const blob = new Blob([srtContent], { type: 'text/srt;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const prodNameClean = currentVideoAnalysisData.productName ? currentVideoAnalysisData.productName.replace(/[\\/:*?"<>|]/g, '') : '吹き替え';
  a.download = `字幕_${styleKey}_${prodNameClean}.srt`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// JSON台本データのダウンロード
function downloadJsonScript() {
  if (!currentVideoAnalysisData) return;
  
  const jsonStr = JSON.stringify(currentVideoAnalysisData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const prodNameClean = currentVideoAnalysisData.productName ? currentVideoAnalysisData.productName.replace(/[\\/:*?"<>|]/g, '') : '吹き替え';
  a.download = `台本データ_${prodNameClean}.json`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
