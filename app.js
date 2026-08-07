// ==========================================
// せどりショート動画台本自動生�? AI - ロジ�?�� (app.js)
// ==========================================

// グローバル要�?取得�?ルパ�?
function safeGetElement(id) {
  return document.getElementById(id);
}

// ア�??ロードされた画像データ
let uploadedImageDataA = null; // Base64 DataURL
let uploadedImageDataB = null; // Base64 DataURL
let uploadedFileNameA = "";
let uploadedFileNameB = "";

// 現在表示中の解析データ
let currentAnalysisData = null;

// 音声合�??�読み上げ?�用変数
let currentUtterance = null;
let currentPlayButton = null;

// 金額フォーマット関数 (¥1,500のような形式に変換)
function formatCurrency(amount) {
  const num = Number(amount);
  if (isNaN(num)) return '¥0';
  return '¥' + num.toLocaleString('ja-JP');
}

// 初期化�?�?
window.onload = function () {
  setupUploadMechanics();
  setupTabListeners();
  loadSavedApiKey();
  setupVideoGeneratorListeners();
};

// APIキーの自動読み込み・保�?
function loadSavedApiKey() {
  const apiKeyInput = safeGetElement('gemini-api-key');
  if (!apiKeyInput) return;

  // 保存されたキーがあれ�?自動�?�?
  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey) {
    apiKeyInput.value = savedKey;
  }

  // キーが�?力されるた�?にLocalStorageに自動保�?
  apiKeyInput.addEventListener('input', (e) => {
    localStorage.setItem('gemini_api_key', e.target.value.trim());
  });
}


// ア�??ロード関係�?イベント登録
function setupUploadMechanics() {
  const fileInputA = safeGetElement('file-input-a');
  const fileInputB = safeGetElement('file-input-b');
  const dropAreaA = safeGetElement('drop-area-a');
  const dropAreaB = safeGetElement('drop-area-b');
  const btnRemoveA = safeGetElement('btn-remove-a');
  const btnRemoveB = safeGetElement('btn-remove-b');
  const btnGenerateScript = safeGetElement('btn-generate-script');

  if (!fileInputA || !fileInputB || !dropAreaA || !dropAreaB) return;

  // ドラ�?��??��ロ�??時�?�?��ォルト動作をキャンセル
  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropAreaA.addEventListener(eventName, preventDefaults, false);
    dropAreaB.addEventListener(eventName, preventDefaults, false);
  });

  // ドラ�?��中ハイライ�?
  ['dragenter', 'dragover'].forEach(eventName => {
    dropAreaA.addEventListener(eventName, () => dropAreaA.classList.add('dragover'), false);
    dropAreaB.addEventListener(eventName, () => dropAreaB.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropAreaA.addEventListener(eventName, () => dropAreaA.classList.remove('dragover'), false);
    dropAreaB.addEventListener(eventName, () => dropAreaB.classList.remove('dragover'), false);
  });

  // ドロ�??時�?ファイル取�?
  dropAreaA.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    handleFileSelected(file, 'A');
  }, false);

  dropAreaB.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    handleFileSelected(file, 'B');
  }, false);

  // 領域クリ�?��でファイル選択ダイアログを開�?
  dropAreaA.addEventListener('click', () => {
    fileInputA.click();
  });

  dropAreaB.addEventListener('click', () => {
    fileInputB.click();
  });

  // ファイルインプット�?クリ�?��による選�?
  fileInputA.addEventListener('change', (e) => {
    handleFileSelected(e.target.files[0], 'A');
  });

  fileInputB.addEventListener('change', (e) => {
    handleFileSelected(e.target.files[0], 'B');
  });

  // 個別ファイル削除??ボタン??
  if (btnRemoveA) {
    btnRemoveA.onclick = (e) => {
      e.stopPropagation();
      resetUpload('A');
    };
  }

  if (btnRemoveB) {
    btnRemoveB.onclick = (e) => {
      e.stopPropagation();
      resetUpload('B');
    };
  }

  // 台本生�?実行�?タン
  if (btnGenerateScript) {
    btnGenerateScript.onclick = () => {
      executeScriptGenerationFlow();
    };
  }
}

// ファイル選択時の読み込み
function handleFileSelected(file, side) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('画像ファイル??NG、JPG、WEBPなど?�を選択してください�?');
    return;
  }

  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onloadend = () => {
    const base64Data = reader.result;
    if (side === 'A') {
      uploadedImageDataA = base64Data;
      uploadedFileNameA = file.name;
      
      const img = safeGetElement('preview-image-a');
      if (img) img.src = base64Data;
      const preview = safeGetElement('preview-container-a');
      if (preview) preview.classList.remove('hidden');
      const placeholder = safeGetElement('placeholder-a');
      if (placeholder) placeholder.classList.add('hidden');
    } else {
      uploadedImageDataB = base64Data;
      uploadedFileNameB = file.name;
      
      const img = safeGetElement('preview-image-b');
      if (img) img.src = base64Data;
      const preview = safeGetElement('preview-container-b');
      if (preview) preview.classList.remove('hidden');
      const placeholder = safeGetElement('placeholder-b');
      if (placeholder) placeholder.classList.add('hidden');
    }
    
    updateGenerateButtonState();
  };
}

// ア�??ロードファイルのリセ�?��
function resetUpload(side) {
  if (side === 'A') {
    uploadedImageDataA = null;
    uploadedFileNameA = "";
    const input = safeGetElement('file-input-a');
    if (input) input.value = "";
    const preview = safeGetElement('preview-container-a');
    if (preview) preview.classList.add('hidden');
    const placeholder = safeGetElement('placeholder-a');
    if (placeholder) placeholder.classList.remove('hidden');
  } else {
    uploadedImageDataB = null;
    uploadedFileNameB = "";
    const input = safeGetElement('file-input-b');
    if (input) input.value = "";
    const preview = safeGetElement('preview-container-b');
    if (preview) preview.classList.add('hidden');
    const placeholder = safeGetElement('placeholder-b');
    if (placeholder) placeholder.classList.remove('hidden');
  }
  updateGenerateButtonState();
}

// 実行�?タンのアク�?��ブ�?非アク�?��ブ制御
function updateGenerateButtonState() {
  const btn = safeGetElement('btn-generate-script');
  if (btn) {
    btn.disabled = !(uploadedImageDataA && uploadedImageDataB);
  }
}

// タブ�?リスナ�?登録
function setupTabListeners() {
  const tabBtns = document.querySelectorAll('.script-tab-btn');
  tabBtns.forEach(btn => {
    btn.onclick = (e) => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const style = btn.getAttribute('data-style');
      if (currentAnalysisData) {
        renderScriptViewer(currentAnalysisData.scripts[style]);
      }
    };
  });

  const btnCopyAll = safeGetElement('btn-copy-all');
  if (btnCopyAll) {
    btnCopyAll.onclick = () => {
      const activeTab = document.querySelector('.script-tab-btn.active');
      const style = activeTab ? activeTab.getAttribute('data-style') : 'buzz';
      if (currentAnalysisData) {
        copyEntireScript(currentAnalysisData.scripts[style], style);
      }
    };
  }
}

// AI処�?��ェーンの実行フロー
async function executeScriptGenerationFlow() {
  // 再生中の音声をキャンセル
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  const statusCard = safeGetElement('generation-status-card');
  const outputCard = safeGetElement('script-output-card');
  const progressBar = safeGetElement('status-progress-bar');
  const alertEl = safeGetElement('success-alert');

  if (statusCard) statusCard.classList.remove('hidden');
  if (outputCard) outputCard.classList.add('hidden');
  if (alertEl) alertEl.style.display = 'none';

  const steps = ['step-1', 'step-2', 'step-3', 'step-4'];
  steps.forEach(id => {
    const el = safeGetElement(id);
    if (el) {
      el.className = 'step-pending';
      const icon = el.querySelector('i');
      if (icon) icon.className = 'fa-regular fa-circle';
    }
  });
  if (progressBar) progressBar.style.width = '0%';

  // 1. 実績スクショ解�?
  await changeStepState('step-1', 'active', 25);
  await delay(1200);
  await changeStepState('step-1', 'completed', 25);

  // 2. 仕�?れ��額解�?
  await changeStepState('step-2', 'active', 50);
  await delay(1200);
  await changeStepState('step-2', 'completed', 50);

  // 3. 利益計�?
  await changeStepState('step-3', 'active', 75);
  await delay(1000);
  await changeStepState('step-3', 'completed', 75);

  // 4. 台本自動生�?
  await changeStepState('step-4', 'active', 90);

  let resultData = null;
  const apiKey = safeGetElement('gemini-api-key')?.value.trim();

  if (apiKey) {
    try {
      resultData = await fetchFromGeminiAPI(apiKey, uploadedImageDataA, uploadedImageDataB);
    } catch (err) {
      console.error('Gemini API呼び出しエラー。シミュレーション�:', err);
      alert('Gemini APIの実行中にエラーが発生したため�?�デモモードで生�します�?n詳細: ' + err.message);
      resultData = simulateHeuristicsAnalysis();
    }
  } else {
    resultData = simulateHeuristicsAnalysis();
  }

  // 利益と利益率をJS側で強制再計� (AIの算術計算エラーゃ�グを確実に防ぐ�?�画像から読み取った�?�料・手数料があれば差し引く)
  if (resultData) {
    const shipping = Number(resultData.shipping) || 0;
    const fee = Number(resultData.fee) || 0;
    resultData.profit = resultData.sellPrice - resultData.purchasePrice - shipping - fee;
    resultData.profitRate = resultData.sellPrice > 0 ? Math.round((resultData.profit / resultData.sellPrice) * 100) : 0;
  }

  await delay(800);
  await changeStepState('step-4', 'completed', 100);
  await delay(500);

  if (statusCard) statusCard.classList.add('hidden');
  
  displayScriptOutput(resultData);
}

// ユーヂ�リヂ�: ヂ�レイ
function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// 進行中スッ�プ�UI更新
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

function simulateHeuristicsAnalysis() {
  let sellPrice = 13500;
  let purchasePrice = 3800;
  let productName = "�d���ꂽ���i";

  const matchA = uploadedFileNameA.match(/\d+/);
  if (matchA && matchA[0]) {
        visual: "カメラに向かって手招きする笑顔�?�?像�?\nプロフィールのリンク先を拡大して、指差す矢印�?���??を表示�?GMがフェードアウト�?",
        speech: "こ�?ジャンルの美味しい仕�?れ基準をまとめた『�?�?�?��ード�?�??』�?、�?ロフリンクで今だけ無料�?付中?�今�?�?��に受け取ってね?�チャンネル登録高評価もよろしく�???"
      }
    ],
    educational: [
      {
        title: "フック??��ントロ",
        time: "0�?5�?",
        visual: "明る�?��フィスの背景。話し手が笑顔でボ�?ドを�?���?\n緑色の�?���??で「利益率" + profitRate + "%?�アパレル物販の真実」を表示�?",
        speech: "再現性抜群?�今回はメルカリで仕�?�?" + fCost + "から利�?" + fProfit + "を�?した、�?体的な�?��選定テクニックを解説します�?"
      },
      {
        title: "ノウハウ解説",
        time: "5�?18�?",
        visual: "�?��のコン�?��ション部�?��ソール�?��グなど?�をスライドでズー�?�?\nタイトル�?���?力�?コ�?��して「状態、モ�?��名�?��定」などのキーワードを目立たせる演�?�?",
        speech: "重要なのはキーワード設計です。メルカリで検索され�?���?��コラボ名』や『限定カラー』を�?��名�?先�?�に記載するだけで、インプレ�?��ョンは一気に3倍になります�?"
      },
      {
        title: "数�? of 裏付け",
        time: "18�?32�?",
        visual: "数値をグラフ化したスライドを表示�?\n仕�?れ価格: " + fCost + "、売値: " + fSell + "、諸経費を計算した表�?\n中古品を簡単にメン�?��ンス?�磨く作業?�して�?��1.5倍速�?�?像�?",
        speech: "今回の原価は" + fCost + "ですが�?100�??消しゴ�?クリーナ�?でほん�?1�?���?��から出品したことで、相場より�?3,000�?��く売ることに成功しました�?"
      },
      {
        title: "まとめとCTA",
        time: "32�?45�?",
        visual: "�?��ねとブックマ�?ク?�保存�?タン?�を�?��示す�?�??ア�??イラスト�?\n質問を�?��コメントテロ�??�?",
        speech: "後から仕�?れ店�?で見返せるよ�?��、今�?�?��にこ�?動画を保存しておいてくださいね。詳しい質問�?コメント�?��受付中です！チャンネル登録高評価もお願いします�?"
      }
    ],
    story: [
      {
        title: "オープニング",
        time: "0�?6�?",
        visual: "少し暗めの室�?��スマ�?の画面を眺めながらため息をつく映像�?\n突然メルカリの売上通知音が「チャリーン?�」と鳴り、表�?��パッと明るくなる演�?�?",
        speech: "副業を諦めかけて�?��平凡な会社員が、仕事帰り�?わず�?1時間で日給" + fProfit + "を稼ぎ�?したリアルな一日�?"
      },
      {
        title: "過去の苦悩",
        time: "6�?20�?",
        visual: "�??ホ�?�?をうつむ�?��歩く姿。リサイクルショ�??の棚�?前を�?���?��して何も買えずに帰る過去の様子�?\n白黒�?回想風エフェクト�?",
        speech: "手取�?18�?��毎日�?��まで働いても貯金�?増えず、焦って物販を始めましたが、最初�?どれを見ても赤字に見えて、仕�?れができず挫折寸前でした�?"
      },
      {
        title: "ブレイクスルー",
        time: "20�?40�?",
        visual: "お店�?棚�?奥から今回の�?��??" + productName + "?�を宝物のように見つけ�?す映像（カラーに戻る）�?\n仕�?れ時の原価レシート�?" + fCost + "?�がポップア�??. 出品直後に売れた履歴画面の表示�?",
        speech: "でも、リサーチ�?�?��方を変えて見つけたのがこの" + productName + "。仕�?れ原価" + fCost + "が、�?品後わずか2時間で" + fSell + "で売れ、手�?��" + fProfit + "残ったとき、本当に�?��ました�?"
      },
      {
        title: "未来への呼びかけ",
        time: "40�?55�?",
        visual: "パソコンに向かって前向きに作業して�?��背中の�?像�?\n画面下に「コメント�?��『副業』と入力」とアニメーション�?��を表示�?",
        speech: "正しい知識さえ身につければ、人生�?自�??手で変えられます。僕が�?�?�?��ら月10�?���?��ス�?��プ�?、コメント�?��『副業』と書�?��くれた方に共有します！チャンネル登録と高評価も忘れずに??"
      }
    ]�ト�?",
        speech: "こ�?ジャンルの美味しい仕�?れ基準をまとめた『�?�?�?��ード�?�??』�?、�?ロフリンクで今だけ無料�?付中?�今�?�?��に受け取ってね??"
      }
    ],
    educational: [
      {
        title: "フック??��ントロ",
        time: "0�?5�?",
        visual: "明る�?��フィスの背景。話し手が笑顔でボ�?ドを�?���?\n緑色の�?���??で「利益率" + profitRate + "%?�アパレル物販の真実」を表示�?",
        speech: "再現性抜群?�今回はメルカリで仕�?�?" + fCost + "から利�?" + fProfit + "を�?した、�?体的な�?��選定テクニックを解説します�?"
      },
      {
        title: "ノウハウ解説",
        time: "5�?18�?",
        visual: "�?��のコン�?��ション部�?��ソール�?��グなど?�をスライドでズー�?�?\nタイトル�?���?力�?コ�?��して「状態、モ�?��名�?��定」などのキーワードを目立たせる演�?�?",
        speech: "重要なのはキーワード設計です。メルカリで検索され�?���?��コラボ名』や『限定カラー』を�?��名�?先�?�に記載するだけで、インプレ�?��ョンは一気に3倍になります�?"
      },
      {
        title: "数字�?裏付け",
        time: "18�?32�?",
        visual: "数値をグラフ化したスライドを表示�?\n仕�?れ価格: " + fCost + "、売値: " + fSell + "、諸経費を計算した表�?\n中古品を簡単にメン�?��ンス?�磨く作業?�して�?��1.5倍速�?�?像�?",
        speech: "今回の原価は" + fCost + "ですが�?100�??消しゴ�?クリーナ�?でほん�?1�?���?��から出品したことで、相場より�?3,000�?��く売ることに成功しました�?"
      },
      {
        title: "まとめとCTA",
        time: "32�?45�?",
        visual: "�?��ねとブックマ�?ク?�保存�?タン?�を�?��示す�?�??ア�??イラスト�?\n質問を�?��コメントテロ�??�?",
        speech: "後から仕�?れ店�?で見返せるよ�?��、今�?�?��にこ�?動画を保存しておいてくださいね。詳しい質問�?コメント�?��受付中です�?"
      }
    ],
    story: [
      {
        title: "オープニング",
        time: "0�?6�?",
        visual: "少し暗めの室�?��スマ�?の画面を眺めながらため息をつく映像�?\n突然メルカリの売上通知音が「チャリーン?�」と鳴り、表�?��パッと明るくなる演�?�?",
        speech: "副業を諦めかけて�?��平凡な会社員が、仕事帰り�?わず�?1時間で日給" + fProfit + "を稼ぎ�?したリアルな一日�?"
      },
      {
        title: "過去の苦悩",
        time: "6�?20�?",
        visual: "�??ホ�?�?をうつむ�?��歩く姿。リサイクルショ�??の棚�?前を�?���?��して何も買えずに帰る過去の様子�?\n白黒�?回想風エフェクト�?",
        speech: "手取�?18�?��毎日�?��まで働いても貯金�?増えず、焦って物販を始めましたが、最初�?どれを見ても赤字に見えて、仕�?れができず挫折寸前でした�?"
      },
      {
        title: "ブレイクスルー",
        time: "20�?40�?",
        visual: "お店�?棚�?奥から今回の�?��??" + productName + "?�を宝物のように見つけ�?す映像（カラーに戻る）�?\n仕�?れ時の原価レシート�?" + fCost + "?�がポップア�??。�?品直後に売れた履歴画面の表示�?",
        speech: "でも、リサーチ�?�?��方を変えて見つけたのがこの" + productName + "。仕�?れ原価" + fCost + "が、�?品後わずか2時間で" + fSell + "で売れ、手�?��" + fProfit + "残ったとき、本当に�?��ました�?"
      },
      {
        title: "未来への呼びかけ",
        time: "40�?55�?",
        visual: "パソコンに向かって前向きに作業して�?��背中の�?像�?\n画面下に「コメント�?��『副業』と入力」とアニメーション�?��を表示�?",
        speech: "正しい知識さえ身につければ、人生�?自�??手で変えられます。僕が�?�?�?��ら月10�?���?��ス�?��プ�?、コメント�?��『副業』と書�?��くれた方に個別に共有します�?"
      }
    ]
  };
}

// Google Gemini API?��?ルチモーダルモ�?��?��?呼び出�?
async function fetchFromGeminiAPI(apiKey, base64ImageA, base64ImageB) {
  const getCleanBase64 = (dataUrl) => dataUrl.split(',')[1];
  const getMime = (dataUrl) => {
    const match = dataUrl.match(/data:(.*?);base64/);
    return match ? match[1] : 'image/jpeg';
  };

  const partA = {
    inlineData: {
      data: getCleanBase64(base64ImageA),
      mimeType: getMime(base64ImageA)
    }
  };

  const partB = {
    inlineData: {
      data: getCleanBase64(base64ImageB),
      mimeType: getMime(base64ImageB)
    }
  };

  const promptText = `
あなた�?せどり（物販?��?プロ動画クリエイター兼AI解析アシスタントです�?
ア�??ロードされた2枚�?画像データを詳細に�?��し、ショート動画用の台本を作�?してください�?

- 1枚目の画像�?mage A?��?、メルカリなどの販売完�?��面のスクリーンショ�?��です。ここから商品名、販売価格?�売上）、およ�?可能であれば送料�?��数料を読み取ってください�?
- 2枚目の画像�?mage B?��?、仕�?れ��額を示すレシート�??�収書、請求書、あるいは手書きメモの画像です。ここから商品�?仕�?れ原価を読み取ってください�?

【計算およ�?�??�のルール (厳�?)�?
1. 画像に直接�?��ストや数値として記載されて�?���?��報?�送料、販売手数料など?�を勝手に推測したり計算に含めたりしては�?��ません。た�?し、画像�?に「送料」や「手数料」�?金額が�?��ストとして明記されて�?��場合（例：表の中に「送料?�¥750」などの記載がある場合）�?、その値を正確に読み取って JSON の shipping, fee に格納してください。画像�?に明記されて�?���??�合�?、shipping と fee は 0 とします�?
2. 利益�?、「販売価格 ?? 仕�?れ価格 ?? 送料?�画像に記載がある場合�? ?? 手数料（画像に記載がある場合）」として計算します�?
3. 利益率 ?? 利�? ÷ 販売価格 �? 100 (%) を計算します�?
4. 画像から商品名が不�?な場合�?勝手に捏�?せず、「仕�?れた�?��」や「この�?��」と�?��プレーンで正確な表現を使用してください�?

【動画編�??特徴�?
�?像�?スマ�?トフォン画面のスクリーンショ�?��?�メルカリ取引画面、仕�?れメモ、クレジ�?��カード�?細、ヤマト�?��便局の発送サイズ定規など?��?スライドショーのみで構�?されます。実�?の撮影�?��は一�?��めな�?��ください�?
そ�?ため、各シーンの【映像演�?・�?���??�?��??isual?�】には、「どのスクリーンショ�?��画像を表示し、どのような簡潔な�?���??�?��を重�?るか」�?みを指定してください�?

【ナレーション・台本の特徴�?
せどりを�?��て�?��人?�物販プレイヤー?�が「あるある！」と深く�?感�?納得できる�?��描�?を交え、テンポよく極めて簡潔�?1シーンにつ�?15�?30�?��程度の非常に短�?��リフ）に書�?��ください。前置きや「こんにちは」などの無�?��挨拶は完�?に省略してください�?

【�?力フォーマット�?
以下�?JSON構�?のみを返してください。余計なマ�?クダウンの \`\`\`json ラ�?��ー�?��後�?説明テキスト�?一�?��めな�?��ください�?

{
  "productName": "読み取った商品名",
  "sellPrice": 販売価格(数値),
  "purchasePrice": 仕�?れ価格(数値),
  "shipping": 画像から読み取った送料 (記載がなければ 0),
  "feeRate": 画像から読み取った手数料率 (記載がなければ 0),
  "fee": 画像から読み取った手数料�? (記載がなければ 0),
  "profit": 利�?(販売価格 - 仕�?れ価格 - 送料 - 手数料�?数値),
  "profitRate": 利益率(数値、四捨五�?した整数),
  "scripts": {
    "buzz": [
      {
        "title": "シーン�?",
        "time": "時間(�?: 0�?3�?)",
        "visual": "表示するスクショと重�?るテロ�??の�?��",
        "speech": "簡潔なセリフ�?15�?30�?��程度??"
      }
    ],
    "educational": [
      {
        "title": "シーン�?",
        "time": "時間",
        "visual": "表示するスクショと重�?るテロ�??の�?��",
        "speech": "簡潔なセリフ�?15�?30�?��程度??"
      }
    ],
    "story": [
      {
        "title": "シーン�?",
        "time": "時間",
        "visual": "表示するスクショと重�?るテロ�??の�?��",
        "speech": "簡潔なセリフ�?15�?30�?��程度??"
      }
    ]
  }
}

�?��クリプトスタイルはそれぞれ4個�?短�?��ーンで構�?してください。また、すべてのスクリプトスタイルにおいて�?4番目?�最後）�?シーンのセリフ�?peech?��?末尾には、�?��視�?�?��チャンネル登録および高評価を�?��フレーズ?�例：「チャンネル登録・高評価もよろしく！」や「チャンネル登録と高評価も忘れずに?�」など?�を�?��含めてください�?
`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: promptText },
          partA,
          partB
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
  }

  const jsonResult = await response.json();
  const rawText = jsonResult.candidates[0].content.parts[0].text;
  return JSON.parse(rawText);
}

// 台本結果カード�?表示
function displayScriptOutput(data) {
  currentAnalysisData = data;
  const summaryArea = safeGetElement('script-analysis-summary');
  const outputCard = safeGetElement('script-output-card');
  const alertEl = safeGetElement('success-alert');

  if (outputCard) outputCard.classList.remove('hidden');
  if (alertEl) alertEl.style.display = 'flex';

  if (summaryArea) {
    const profitClass = data.profit >= 0 ? 'profit-positive' : 'profit-negative';
    summaryArea.innerHTML = `
      <div class="analysis-badge">
        <span class="badge-label"><i class="fa-solid fa-tag"></i> 判定商品名</span>
        <span class="badge-value" style="font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${data.productName}">${data.productName}</span>
      </div>
      <div class="analysis-badge">
        <span class="badge-label"><i class="fa-solid fa-basket-shopping"></i> 販売価格</span>
        <span class="badge-value">${formatCurrency(data.sellPrice)}</span>
      </div>
      <div class="analysis-badge">
        <span class="badge-label"><i class="fa-solid fa-yen-sign"></i> 仕�?れ価格</span>
        <span class="badge-value">${formatCurrency(data.purchasePrice)}</span>
      </div>
      ${(data.shipping > 0 || data.fee > 0) ? `
      <div class="analysis-badge">
        <span class="badge-label"><i class="fa-solid fa-truck-fast"></i> 送料・手数�?</span>
        <span class="badge-value" style="font-size: 0.95rem; font-weight: 600; color: var(--text-main);">
          ${formatCurrency(data.shipping)} + ${formatCurrency(data.fee)}
        </span>
      </div>
      ` : ''}
      <div class="analysis-badge">
        <span class="badge-label"><i class="fa-solid fa-hand-holding-dollar"></i> ${(data.shipping > 0 || data.fee > 0) ? '手残り利�?' : '利益�?'} (利益率)</span>
        <span class="badge-value ${profitClass}">
          ${formatCurrency(data.profit)} <span style="font-size: 0.85rem; font-weight: bold; color: inherit;">(${data.profitRate}%)</span>
        </span>
      </div>
    `;
  }

  // �?��ォルトで「インパクト重�?(buzz)」をレンダリングする
  const activeTab = document.querySelector('.script-tab-btn.active');
  const style = activeTab ? activeTab.getAttribute('data-style') : 'buzz';
  renderScriptViewer(data.scripts[style]);
}

// 台本シーンリスト�?HTML出�?
function renderScriptViewer(scenes) {
  const viewer = safeGetElement('script-content-viewer');
  if (!viewer) return;

  // 再生中音声を強制停止
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  currentPlayButton = null;

  let html = `<div class="scene-list">`;
  
  scenes.forEach((scene, index) => {
    html += `
      <div class="scene-card">
        <div class="scene-header">
          <span><i class="fa-solid fa-film"></i> シーン ${index + 1}: ${scene.title}</span>
          <span class="scene-time-badge"><i class="fa-regular fa-clock"></i> ${scene.time}</span>
        </div>
        <div class="scene-body">
          <div class="scene-col scene-col-left">
            <div class="col-title"><i class="fa-solid fa-camera"></i> �?像演�?・�?���??�?��</div>
            <div class="col-content">${scene.visual.replace(/\n/g, '<br>')}</div>
          </div>
          <div class="scene-col scene-col-right">
            <div class="col-title"><i class="fa-solid fa-microphone"></i> ナレーション原稿</div>
            <div class="speech-text-wrapper">
              <div class="col-content speech-content" id="speech-text-${index}">${scene.speech}</div>
              <div style="display: flex; gap: 0.1rem;">
                <button type="button" class="btn-scene-action btn-voice-play" data-index="${index}" title="セリフ�?音声を�?生す�?">
                  <i class="fa-solid fa-volume-high"></i>
                </button>
                <button type="button" class="btn-scene-action btn-copy-scene" data-index="${index}" title="セリフをコピ�?する">
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

  // �?��ーンのイベント割り当て
  viewer.querySelectorAll('.btn-voice-play').forEach(btn => {
    btn.onclick = (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
      handleSpeechSynthesisToggle(idx, scenes[idx].speech, e.currentTarget);
    };
  });

  viewer.querySelectorAll('.btn-copy-scene').forEach(btn => {
    btn.onclick = (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
      navigator.clipboard.writeText(scenes[idx].speech).then(() => {
        alert(`シーン ${idx + 1} のセリフをコピ�?しました。`);
      });
    };
  });
}

// 音声再生�?��替�?
function handleSpeechSynthesisToggle(idx, text, button) {
  if (!window.speechSynthesis) {
    alert('お使�??ブラウザは音声合�?に対応して�?��せん�?');
    return;
  }

  // 既に再生中の場�?
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    
    // 同じボタンを押したなら停止のみ
    if (currentPlayButton === button) {
      setVoiceButtonPlayingState(button, false);
      currentPlayButton = null;
      return;
    }
    
    // 別のボタンなら、前のボタンの状態を�?��戻�?
    if (currentPlayButton) {
      setVoiceButtonPlayingState(currentPlayButton, false);
    }
  }

  currentPlayButton = button;
  setVoiceButtonPlayingState(button, true);

  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.lang = 'ja-JP';

  // 日本語話�??セ�?��
  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find(v => v.lang.startsWith('ja'));
  if (jaVoice) {
    currentUtterance.voice = jaVoice;
  }

  currentUtterance.rate = 1.05; // わずかに�?��ポア�??

  currentUtterance.onend = () => {
    setVoiceButtonPlayingState(button, false);
    if (currentPlayButton === button) currentPlayButton = null;
  };

  currentUtterance.onerror = () => {
    setVoiceButtonPlayingState(button, false);
    if (currentPlayButton === button) currentPlayButton = null;
  };

  window.speechSynthesis.speak(currentUtterance);
}

function setVoiceButtonPlayingState(button, isPlaying) {
  const icon = button.querySelector('i');
  if (isPlaying) {
    button.classList.add('playing');
    button.title = '再生を停止';
    if (icon) icon.className = 'fa-solid fa-square';
  } else {
    button.classList.remove('playing');
    button.title = 'セリフ�?音声を�?生す�?';
    if (icon) icon.className = 'fa-solid fa-volume-high';
  }
}

// 全台本の一括コピ�?
function copyEntireScript(scenes, styleKey) {
  let styleTitle = "インパクト重�? (バズり系)";
  if (styleKey === 'educational') styleTitle = "解説・ノウハウ重�?";
  if (styleKey === 'story') styleTitle = "スト�?リー風 (実録)";

  let text = `【せどりショート動画台本】\n`;
  text += `構�?スタイル: ${styleTitle}\n`;
  text += `判定商�?: ${currentAnalysisData.productName}\n`;
  text += `手残り粗利: ${formatCurrency(currentAnalysisData.profit)} (利益率: ${currentAnalysisData.profitRate}%)\n`;
  text += `-------------------------------------------\n\n`;

  scenes.forEach((scene, index) => {
    text += `�? シーン ${index + 1}: ${scene.title} (${scene.time})\n`;
    text += `【映像演�?・�?���??�?��】\n${scene.visual}\n`;
    text += `【ナレーション原稿】\n${scene.speech}\n\n`;
  });

  navigator.clipboard.writeText(text).then(() => {
    alert('台本全体�?原稿?�映像演�??�ナレーション?�をクリ�??ボ�?ドにコピ�?しました??');
  }).catch(err => {
    alert('コピ�?に失敗しました: ' + err.message);
  });
}

// ==========================================
// 6. 動画自動生成�?連携機�? コアロジ�?�� (追�?)
// ==========================================

let videoPreloadedImages = null;
let videoIsPlaying = false;
let videoPlaybackTime = 0; // 現在の再生位置?�秒�?
const videoTotalDuration = 32; // 4シーン x �?8�? = 32秒固�?
let videoAnimationId = null;

// Web Audio API 関連
let videoAudioContext = null;
let videoAudioDestination = null;
let videoBgmInterval = null;

// MediaRecorder 関連
let videoRecorder = null;
let videoRecordedChunks = [];
let videoIsExporting = false;

// 外部動画編�?��プリ連携用イベント�?登録
function setupVideoGeneratorListeners() {
  const btnOpen = safeGetElement('btn-open-video-generator');
  const btnClose = safeGetElement('btn-close-video-modal');
  const overlay = safeGetElement('video-modal-overlay');
  
  const btnPlay = safeGetElement('btn-video-play');
  const btnExport = safeGetElement('btn-video-export');
  const btnDownloadSrt = safeGetElement('btn-download-srt');
  const btnDownloadJson = safeGetElement('btn-download-json');
  const canvasOverlay = safeGetElement('canvas-play-overlay');

  if (!btnOpen || !overlay) return;

  // モーダルを開�?
  btnOpen.addEventListener('click', async () => {
    if (!uploadedImageDataA || !uploadedImageDataB) {
      alert('動画を生成するには、実績画像と仕�?れ原価画像�?両方をア�??ロードしてください�?');
      return;
    }
    
    overlay.classList.remove('hidden');
    
    // 画像�?プリロー�?
    try {
      showCanvasLoading(true);
      videoPreloadedImages = await preloadVideoImages();
      showCanvasLoading(false);
      resetVideoState();
      drawStaticPreview();
    } catch (err) {
      console.error(err);
      alert('画像�?読み込みに失敗しました�?');
      showCanvasLoading(false);
    }
  });

  // モーダルを閉じる
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      stopVideoPreview();
      overlay.classList.add('hidden');
    });
  }

  // 再生ボタン
  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      // ユーザージェスチャーの直下で同期�?��AudioContextを�?期化/再開してスマ�?対策を行う
      if (!videoAudioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          videoAudioContext = new AudioContextClass();
        }
      }
      if (videoAudioContext && videoAudioContext.state === 'suspended') {
        videoAudioContext.resume();
      }

      if (videoIsPlaying) {
        pauseVideoPreview();
      } else {
        startVideoPreview();
      }
    });
  }

  // キャンバスオーバ�?レイのクリ�?��で再生
  if (canvasOverlay) {
    canvasOverlay.addEventListener('click', () => {
      // ユーザージェスチャーの直下で同期�?��AudioContextを�?期化/再開してスマ�?対策を行う
      if (!videoAudioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          videoAudioContext = new AudioContextClass();
        }
      }
      if (videoAudioContext && videoAudioContext.state === 'suspended') {
        videoAudioContext.resume();
      }
      startVideoPreview();
    });
  }

  // 動画エクスポ�?�?
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      // ユーザージェスチャーの直下で同期�?��AudioContextを�?期化/再開してスマ�?対策を行う
      if (!videoAudioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          videoAudioContext = new AudioContextClass();
        }
      }
      if (videoAudioContext && videoAudioContext.state === 'suspended') {
        videoAudioContext.resume();
      }
      exportVideoAsFile();
    });
  }

  // SRT字幕ダウンロー�?
  if (btnDownloadSrt) {
    btnDownloadSrt.addEventListener('click', () => {
      downloadSrtFile();
    });
  }

  // JSONダウンロー�?
  if (btnDownloadJson) {
    btnDownloadJson.addEventListener('click', () => {
      downloadJsonScript();
    });
  }
}

// キャンバス�??ロー�?��ング表示
function showCanvasLoading(show) {
  const canvas = safeGetElement('video-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (show) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Noto Sans JP", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('�?材画像をロード中...', canvas.width / 2, canvas.height / 2);
  }
}

// 画像�?リロー�?
function preloadVideoImages() {
  return new Promise((resolve, reject) => {
    let loadedCount = 0;
    const imgA = new Image();
    const imgB = new Image();
    
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount === 2) {
        resolve({ imgA, imgB });
      }
    };
    
    imgA.onload = checkLoaded;
    imgA.onerror = () => reject(new Error("Image A loading failed"));
    imgB.onload = checkLoaded;
    imgB.onerror = () => reject(new Error("Image B loading failed"));
    
    imgA.src = uploadedImageDataA;
    imgB.src = uploadedImageDataB;
  });
}

// 状態リセ�?��
function resetVideoState() {
  videoPlaybackTime = 0;
  videoIsPlaying = false;
  videoIsExporting = false;
  updatePlaybackUI();
}

// 静的プレビューの描画 (最初�?フレー�?)
function drawStaticPreview() {
  const canvas = safeGetElement('video-canvas');
  if (!canvas || !videoPreloadedImages) return;
  
  renderFrameAtTime(0);
  const overlay = safeGetElement('canvas-play-overlay');
  if (overlay) overlay.classList.remove('hidden');
}

// 再生開�?
async function startVideoPreview() {
  if (videoIsExporting) return;
  
  // 音声合�?の中断
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // AudioContext の初期�?
  await initAudioContext();
  
  videoIsPlaying = true;
  const btnPlay = safeGetElement('btn-video-play');
  if (btnPlay) {
    btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i> 一時停止';
  }
  
  const overlay = safeGetElement('canvas-play-overlay');
  if (overlay) overlay.classList.add('hidden');

  // BGM ビ�?ト生成�?開�?
  startSynthesizedBgm();

  // シーン音読の初回キ�?��
  speakCurrentSceneSpeech();

  let lastTime = performance.now();
  
  function animLoop(now) {
    if (!videoIsPlaying) return;
    
    const delta = (now - lastTime) / 1000;
    lastTime = now;
    
    // 時間を進める
    const oldSceneIdx = Math.floor(videoPlaybackTime / 8);
    videoPlaybackTime += delta;
    const newSceneIdx = Math.floor(videoPlaybackTime / 8);

    // シーンが変わったら喋らせる
    if (newSceneIdx !== oldSceneIdx && newSceneIdx < 4) {
      speakCurrentSceneSpeech();
    }
    
    if (videoPlaybackTime >= videoTotalDuration) {
      // 再生終�?
      stopVideoPreview();
      return;
    }
    
    renderFrameAtTime(videoPlaybackTime);
    updatePlaybackUI();
    
    videoAnimationId = requestAnimationFrame(animLoop);
  }
  
  videoAnimationId = requestAnimationFrame(animLoop);
}

// 一時停止
function pauseVideoPreview() {
  videoIsPlaying = false;
  const btnPlay = safeGetElement('btn-video-play');
  if (btnPlay) {
    btnPlay.innerHTML = '<i class="fa-solid fa-play"></i> プレビュー再生';
  }
  
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  
  stopSynthesizedBgm();
  
  if (videoAnimationId) {
    cancelAnimationFrame(videoAnimationId);
  }
}

// 完�?停止
function stopVideoPreview() {
  pauseVideoPreview();
  resetVideoState();
  drawStaticPreview();
}

// 再生状態UIの更新
function updatePlaybackUI() {
  const currentText = safeGetElement('video-time-current');
  const totalText = safeGetElement('video-time-total');
  const bar = safeGetElement('video-progress-bar');
  
  if (currentText) currentText.textContent = videoPlaybackTime.toFixed(1) + '�?';
  if (totalText) totalText.textContent = videoTotalDuration.toFixed(1) + '�?';
  
  if (bar) {
    const percentage = (videoPlaybackTime / videoTotalDuration) * 100;
    bar.style.width = percentage + '%';
  }

  // シーン�?��スト情報の更新
  const sceneIdx = Math.floor(videoPlaybackTime / 8);
  if (sceneIdx < 4) {
    const scenes = getActiveScriptScenes();
    if (scenes && scenes[sceneIdx]) {
      const activeScene = scenes[sceneIdx];
      const sceneNum = safeGetElement('preview-scene-num');
      const sceneTitle = safeGetElement('preview-scene-title');
      const sceneSpeech = safeGetElement('preview-scene-speech');
      
      if (sceneNum) sceneNum.textContent = `シーン ${sceneIdx + 1} / 4 (${activeScene.time})`;
      if (sceneTitle) sceneTitle.textContent = activeScene.title;
      if (sceneSpeech) sceneSpeech.textContent = activeScene.speech;
    }
  }
}

// 現在選択されて�?��スタイルの台本シーンリストを取�?
function getActiveScriptScenes() {
  if (!currentAnalysisData) return null;
  const activeTab = document.querySelector('.script-tab-btn.active');
  const style = activeTab ? activeTab.getAttribute('data-style') : 'buzz';
  return currentAnalysisData.scripts[style];
}

// 音声合�?で現在のシーンを読み上げ�?
function speakCurrentSceneSpeech() {
  if (!window.speechSynthesis || videoIsExporting) return;
  
  const sceneIdx = Math.floor(videoPlaybackTime / 8);
  const scenes = getActiveScriptScenes();
  if (!scenes || !scenes[sceneIdx]) return;
  
  window.speechSynthesis.cancel();
  
  const text = scenes[sceneIdx].speech;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 1.1; // �?��スピ�?�?��ーに
  
  // 日本語話�?���?
  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find(v => v.lang.startsWith('ja'));
  if (jaVoice) {
    utterance.voice = jaVoice;
  }
  
  window.speechSynthesis.speak(utterance);
}

// 特定�?時間のフレー�?を描画
function renderFrameAtTime(timeSec) {
  const canvas = safeGetElement('video-canvas');
  if (!canvas || !videoPreloadedImages) return;
  
  const ctx = canvas.getContext('2d');
  const currentSceneIdx = Math.min(Math.floor(timeSec / 8), 3);
  const nextSceneIdx = Math.min(currentSceneIdx + 1, 3);
  const sceneTimeOffset = timeSec % 8; // こ�?シーン�?��の経過時間(0�?8)
  
  const scenes = getActiveScriptScenes();
  if (!scenes) return;
  
  const currentScene = scenes[Math.min(currentSceneIdx, 3)];

  // 画像�?選�?
  // シーン1(0), 3(2), 4(3) は実績画�? A、シーン2(1) は仕�?れ原価画�? B
  const getImgForScene = (idx) => {
    return idx === 1 ? videoPreloadedImages.imgB : videoPreloadedImages.imgA;
  };

  const imgCurrent = getImgForScene(currentSceneIdx);
  const imgNext = getImgForScene(nextSceneIdx);

  // フェード率の計�? (最後�?0.5秒で次のシーンへ滑らかにクロスフェー�?)
  let fadeRatio = 0;
  if (sceneTimeOffset > 7.5 && currentSceneIdx < 3) {
    fadeRatio = (sceneTimeOffset - 7.5) / 0.5;
  }

  // 1. 画像をアスペクト比維持�? Contain 描画 (�?��取りを完�?に防ぎ、�?体を綺麗に表示)
  ctx.fillStyle = '#0a0f1d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawContainImg = (img, opacity) => {
    ctx.save();
    ctx.globalAlpha = opacity;
    
    // 画像�?完�?に固�? (ズー�?�?��ライド、�?り取り�?一�?��わな�?)
    ctx.translate(canvas.width / 2, canvas.height / 2);
    
    const imgRatio = img.width / img.height;
    const canvasRatio = canvas.width / canvas.height;
    let renderW, renderH;
    
    // 画面�?��ぴったり収め�? (Contain)
    if (imgRatio > canvasRatio) {
      renderW = canvas.width;
      renderH = canvas.width / imgRatio;
    } else {
      renderH = canvas.height;
      renderW = canvas.height * imgRatio;
    }
    
    ctx.drawImage(img, -renderW / 2, -renderH / 2, renderW, renderH);
    ctx.restore();
  };

  // 背景のクロスフェード描画
  if (fadeRatio > 0) {
    drawContainImg(imgCurrent, 1 - fadeRatio);
    drawContainImg(imgNext, fadeRatio);
  } else {
    drawContainImg(imgCurrent, 1);
  }

  // 全体を�?��暗めのシネ�?�?���?��グラ�??ション (�?���??の視認性確�?)
  const vGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  vGrad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
  vGrad.addColorStop(0.3, 'rgba(0, 0, 0, 0.2)');
  vGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.25)');
  vGrad.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. �?��大数字テロ�??の描画 (画面中央 Y=450 付近に配置)
  if (currentAnalysisData) {
    const formattedProfit = formatCurrency(currentAnalysisData.profit);
    const formattedCost = formatCurrency(currentAnalysisData.purchasePrice);
    const formattedRate = `${currentAnalysisData.profitRate}%`;
    const formattedSell = formatCurrency(currentAnalysisData.sellPrice);

    // 画像から送料・手数料が検�?されたかど�?��でラベルを変更
    const hasExtra = (currentAnalysisData.shipping > 0 || currentAnalysisData.fee > 0);
    const profitLabel = hasExtra ? '手残り利�?' : '利益差�?';
    const profitSubLabel = hasExtra ? '送料・手数料�??' : '画像データから自動計�?';

    const drawHugeNumber = (label, mainVal, subLabel = '', mainColor = '#facc15') => {
      ctx.save();
      const centerY = 450;

      // 極太の黒縁取りで画像との重なりでも絶対に見やすくする
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 14;
      ctx.lineJoin = 'round';

      // ネオン調の強力なドロ�??シャドウ (グロー効�?)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 6;

      // ラベル (一�?��益、仕�?れ原価など)
      if (label) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 36px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeText(label, canvas.width / 2, centerY - 90);
        ctx.fillText(label, canvas.width / 2, centerY - 90);
      }

      // メインの�?��大数値 (¥12,500 など)
      if (mainVal) {
        ctx.fillStyle = mainColor;
        ctx.font = '900 85px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeText(mainVal, canvas.width / 2, centerY + 10);
        ctx.fillText(mainVal, canvas.width / 2, centerY + 10);
      }

      // サブ情報
      if (subLabel) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 42px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeText(subLabel, canvas.width / 2, centerY + 95);
        ctx.fillText(subLabel, canvas.width / 2, centerY + 95);
      }
      ctx.restore();
    };

    // シーンごとの巨大数字アピ�?ル�?��替�?
    if (currentSceneIdx === 0) {
      // シーン1: フック
      drawHugeNumber(profitLabel, `+${formattedProfit}!!`, profitSubLabel, '#facc15'); // イエロー
    } else if (currentSceneIdx === 1) {
      // シーン2: 仕�?�? (仕�?れ原価を�?�?)
      drawHugeNumber('仕�?れ原価', `${formattedCost}`, `販売価格 ${formattedSell}`, '#ef4444'); // 赤
    } else if (currentSceneIdx === 2) {
      // シーン3: 利益�?訳 (利益額と利益率をアピ�?ル)
      drawHugeNumber(profitLabel, `+${formattedProfit}!!`, `利益率 ${formattedRate}`, '#10b981'); // グリーン
    } else if (currentSceneIdx === 3) {
      // シーン4: CTA・クロージング
      drawHugeNumber('利益率', `${formattedRate}`, '初�?�?��け物販ロード�?�??', '#06b6d4'); // シアン
    }
  }

  // 3. 利益効果音 (シーン3突�?�?)
  if (currentSceneIdx === 2 && sceneTimeOffset < 0.1) {
    playCoinSound(videoAudioContext, videoIsExporting ? videoAudioDestination : videoAudioContext.destination);
  }

  // 4. 字幕テロ�??の描画 (ナレーションは巨大数字と重ならな�?���?��下部 Y=1130 付近に配置)
  if (currentScene) {
    const text = currentScene.speech;
    const textY = 1130;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Noto Sans JP", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 読み�?��さを確保する黒縁取りとドロ�??シャドウ
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
}

// AudioContext の�?��初期�?
async function initAudioContext() {
  if (!videoAudioContext) {
    // ブラウザの互換性確�?
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      videoAudioContext = new AudioContextClass();
      // 録画用にオー�?��オストリー�?ノ�?ドを作�?
      if (videoAudioContext.createMediaStreamDestination) {
        videoAudioDestination = videoAudioContext.createMediaStreamDestination();
        
        // Chromeの無音トラ�?��破�?��グ対策：微弱な無音信号を常時流し、トラ�?��をアク�?��ブに保ちま�?
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

// BGM ビ�?ト生�?
function startSynthesizedBgm() {
  if (!videoAudioContext) return;
  if (videoBgmInterval) clearInterval(videoBgmInterval);
  
  // 書き�?し中は録画ノ�?ド、�?レビュー再生時�?スピ�?カー??estination?�へ動的にルー�?��ング
  const dest = videoIsExporting ? videoAudioDestination : videoAudioContext.destination;
  let beatCount = 0;
  
  // 0.5秒ごとにドラ�?キ�?��とハイハットをシミュレーション
  videoBgmInterval = setInterval(() => {
    if (!videoIsPlaying && !videoIsExporting) return;
    
    // ドラ�?キ�?�� (偶数�?)
    if (beatCount % 2 === 0) {
      triggerKick(videoAudioContext, dest);
    }
    
    // ハイハッ�? (全�?)
    triggerHihat(videoAudioContext, dest);
    
    beatCount++;
  }, 500);
}

function stopSynthesizedBgm() {
  if (videoBgmInterval) {
    clearInterval(videoBgmInterval);
    videoBgmInterval = null;
  }
}

// ドラ�?キ�?��シンセ
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
  } catch (e) {
    console.error(e);
  }
}

// ハイハットシンセ
function triggerHihat(audioCtx, dest) {
  try {
    const bufferSize = audioCtx.sampleRate * 0.05;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
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
  } catch (e) {
    console.error(e);
  }
}

// コイン音?�チャリーン?�シンセ
function playCoinSound(audioCtx, dest) {
  try {
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc1.type = 'sine';
    osc2.type = 'sine';
    
    osc1.frequency.setValueAtTime(987.77, audioCtx.currentTime); // B5
    osc2.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.05); // E6
    
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
  } catch (e) {
    console.error(e);
  }
}

// WebM 動画の作�?・ダウンロー�?
async function exportVideoAsFile() {
  if (videoIsExporting) return;
  
  // 現在の再生を停止
  stopVideoPreview();
  await initAudioContext();
  
  videoIsExporting = true;
  videoRecordedChunks = [];
  
  const btnExport = safeGetElement('btn-video-export');
  const statusDiv = safeGetElement('export-status');
  const progressBar = safeGetElement('export-progress-bar');
  const progressText = safeGetElement('export-progress-text');
  
  if (btnExport) btnExport.disabled = true;
  if (statusDiv) statusDiv.classList.remove('hidden');
  
  const canvas = safeGetElement('video-canvas');
  if (!canvas) return;

  // キャンバスストリー�? (30fps)
  const canvasStream = canvas.captureStream(30);
  const tracks = [];
  
  // �?像トラ�?��の追�?
  canvasStream.getVideoTracks().forEach(track => tracks.push(track));
  
  // 音声トラ�?��の追�? (Web Audio から)
  if (videoAudioDestination) {
    videoAudioDestination.stream.getAudioTracks().forEach(track => {
      tracks.push(track);
    });
  }

  // スマ�?対応：MediaStream作�?時にトラ�?��配�?を直接渡すことで音声�?落を防ぎま�?
  const mixedStream = new MediaStream(tracks);
  
  // MediaRecorder インスタンス生�? (スマ�?・PC互換性を高めるた�? MP4/AAC 形式を最優�?)
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
    videoRecorder = new MediaRecorder(mixedStream, options);
  } catch (e) {
    console.error('MediaRecorderの初期化に失敗しました。デフォルト設定を使�?���?:', e);
    videoRecorder = new MediaRecorder(mixedStream);
    if (videoRecorder.mimeType && videoRecorder.mimeType.includes('mp4')) {
      extension = 'mp4';
    } else {
      extension = 'webm';
    }
  }
  
  videoRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      videoRecordedChunks.push(event.data);
    }
  };
  
  videoRecorder.onstop = () => {
    const blob = new Blob(videoRecordedChunks, { type: videoRecorder.mimeType || 'video/webm' });
    const url = URL.createObjectURL(blob);
    
    // ダウンロードリンクを生成して発火
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    const activeTab = document.querySelector('.script-tab-btn.active');
    const styleKey = activeTab ? activeTab.getAttribute('data-style') : 'buzz';
    const prodNameClean = currentAnalysisData.productName.replace(/[\\/:*?"<>|]/g, '');
    a.download = `せどり動画台本_${styleKey}_${prodNameClean}.${extension}`;
    
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
    
    // UIの�?���?
    videoIsExporting = false;
    if (btnExport) btnExport.disabled = false;
    if (statusDiv) statusDiv.classList.add('hidden');
    stopSynthesizedBgm();
    resetVideoState();
    drawStaticPreview();
    alert('動画ファイルの書き�?しが完�?��、ダウンロードを開始しました??');
  };
  
  // 録画開�?
  videoRecorder.start();
  startSynthesizedBgm();
  
  // レンダリングルー�? (実時間で回す)
  let lastTime = performance.now();
  videoPlaybackTime = 0;
  
  function exportLoop(now) {
    const delta = (now - lastTime) / 1000;
    lastTime = now;
    
    videoPlaybackTime += delta;
    
    // 進捗表示
    const progress = Math.min((videoPlaybackTime / videoTotalDuration) * 100, 100);
    if (progressBar) progressBar.style.width = progress + '%';
    if (progressText) progressText.textContent = Math.round(progress) + '%';
    
    if (videoPlaybackTime >= videoTotalDuration) {
      // 終�?
      videoRecorder.stop();
      return;
    }
    
    renderFrameAtTime(videoPlaybackTime);
    
    requestAnimationFrame(exportLoop);
  }
  
  requestAnimationFrame(exportLoop);
}

// SRT字幕ファイルのダウンロー�?
function downloadSrtFile() {
  const scenes = getActiveScriptScenes();
  if (!scenes) return;
  
  let srtContent = '';
  
  scenes.forEach((scene, index) => {
    const startSec = index * 8;
    const endSec = (index + 1) * 8;
    
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
  
  const activeTab = document.querySelector('.script-tab-btn.active');
  const styleKey = activeTab ? activeTab.getAttribute('data-style') : 'buzz';
  const prodNameClean = currentAnalysisData.productName.replace(/[\\/:*?"<>|]/g, '');
  a.download = `字幕_${styleKey}_${prodNameClean}.srt`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// JSON台本�??タのダウンロー�?
function downloadJsonScript() {
  if (!currentAnalysisData) return;
  
  const jsonStr = JSON.stringify(currentAnalysisData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const prodNameClean = currentAnalysisData.productName.replace(/[\\/:*?"<>|]/g, '');
  a.download = `台本�??タ_${prodNameClean}.json`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
