// ==========================================
// せどりショート動画台本自動生成 AI - ロジック (app.js)
// ==========================================

// グローバル要素取得ヘルパー
function safeGetElement(id) {
  return document.getElementById(id);
}

// アップロードされた画像データ
let uploadedImageDataA = null; // Base64 DataURL
let uploadedImageDataB = null; // Base64 DataURL
let uploadedFileNameA = "";
let uploadedFileNameB = "";

// 現在表示中の解析データ
let currentAnalysisData = null;

// 音声合成（読み上げ）用変数
let currentUtterance = null;
let currentPlayButton = null;

// 金額フォーマット関数 (¥1,500のような形式に変換)
function formatCurrency(amount) {
  const num = Number(amount);
  if (isNaN(num)) return '¥0';
  return '¥' + num.toLocaleString('ja-JP');
}

// 初期化処理
window.onload = function () {
  setupUploadMechanics();
  setupTabListeners();
  loadSavedApiKey();
  setupVideoGeneratorListeners();
};

// APIキーの自動読み込み・保存
function loadSavedApiKey() {
  const apiKeyInput = safeGetElement('gemini-api-key');
  if (!apiKeyInput) return;

  // 保存されたキーがあれば自動入力
  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey) {
    apiKeyInput.value = savedKey;
  }

  // キーが入力されるたびにLocalStorageに自動保存
  apiKeyInput.addEventListener('input', (e) => {
    localStorage.setItem('gemini_api_key', e.target.value.trim());
  });
}


// アップロード関係のイベント登録
function setupUploadMechanics() {
  const fileInputA = safeGetElement('file-input-a');
  const fileInputB = safeGetElement('file-input-b');
  const dropAreaA = safeGetElement('drop-area-a');
  const dropAreaB = safeGetElement('drop-area-b');
  const btnRemoveA = safeGetElement('btn-remove-a');
  const btnRemoveB = safeGetElement('btn-remove-b');
  const btnGenerateScript = safeGetElement('btn-generate-script');

  if (!fileInputA || !fileInputB || !dropAreaA || !dropAreaB) return;

  // ドラッグ＆ドロップ時のデフォルト動作をキャンセル
  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropAreaA.addEventListener(eventName, preventDefaults, false);
    dropAreaB.addEventListener(eventName, preventDefaults, false);
  });

  // ドラッグ中ハイライト
  ['dragenter', 'dragover'].forEach(eventName => {
    dropAreaA.addEventListener(eventName, () => dropAreaA.classList.add('dragover'), false);
    dropAreaB.addEventListener(eventName, () => dropAreaB.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropAreaA.addEventListener(eventName, () => dropAreaA.classList.remove('dragover'), false);
    dropAreaB.addEventListener(eventName, () => dropAreaB.classList.remove('dragover'), false);
  });

  // ドロップ時のファイル取得
  dropAreaA.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    handleFileSelected(file, 'A');
  }, false);

  dropAreaB.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    handleFileSelected(file, 'B');
  }, false);

  // 領域クリックでファイル選択ダイアログを開く
  dropAreaA.addEventListener('click', () => {
    fileInputA.click();
  });

  dropAreaB.addEventListener('click', () => {
    fileInputB.click();
  });

  // ファイルインプットのクリックによる選択
  fileInputA.addEventListener('change', (e) => {
    handleFileSelected(e.target.files[0], 'A');
  });

  fileInputB.addEventListener('change', (e) => {
    handleFileSelected(e.target.files[0], 'B');
  });

  // 個別ファイル削除（Xボタン）
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

  // 台本生成実行ボタン
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
    alert('画像ファイル（PNG、JPG、WEBPなど）を選択してください。');
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

// アップロードファイルのリセット
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

// 実行ボタンのアクティブ・非アクティブ制御
function updateGenerateButtonState() {
  const btn = safeGetElement('btn-generate-script');
  if (btn) {
    btn.disabled = !(uploadedImageDataA && uploadedImageDataB);
  }
}

// タブのリスナー登録
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

// AI処理チェーンの実行フロー
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

  // 1. 実績スクショ解析
  await changeStepState('step-1', 'active', 25);
  await delay(1200);
  await changeStepState('step-1', 'completed', 25);

  // 2. 仕入れ金額解析
  await changeStepState('step-2', 'active', 50);
  await delay(1200);
  await changeStepState('step-2', 'completed', 50);

  // 3. 利益計算
  await changeStepState('step-3', 'active', 75);
  await delay(1000);
  await changeStepState('step-3', 'completed', 75);

  // 4. 台本自動生成
  await changeStepState('step-4', 'active', 90);

  let resultData = null;
  const apiKey = safeGetElement('gemini-api-key')?.value.trim();

  if (apiKey) {
    try {
      resultData = await fetchFromGeminiAPI(apiKey, uploadedImageDataA, uploadedImageDataB);
    } catch (err) {
      console.error('Gemini API呼び出しエラー。シミュレーションモードへフォールバックします:', err);
      alert('Gemini APIの実行中にエラーが発生したため、デモモードで生成します。\n詳細: ' + err.message);
      resultData = simulateHeuristicsAnalysis();
    }
  } else {
    resultData = simulateHeuristicsAnalysis();
  }

  // 利益と利益率をJS側で強制再計算 (AIの算術計算エラーやバグを確実に防ぐ。画像から読み取った送料・手数料があれば差し引く)
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

// ユーティリティ: ディレイ
function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// 進行中ステップのUI更新
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

// ファイル名から金額や商品名を推測するデモ解析
function simulateHeuristicsAnalysis() {
  let sellPrice = 13500;
  let purchasePrice = 3800;
  let productName = "仕入れた商品"; // 捏造商品名を廃止し、一般名称に固定

  // 実績ファイル名から金額抽出
  const matchA = uploadedFileNameA.match(/\d+/);
  if (matchA && matchA[0]) {
    const val = parseInt(matchA[0], 10);
    if (val >= 300) sellPrice = val;
  }

  // 仕入れファイル名から金額抽出
  const matchB = uploadedFileNameB.match(/\d+/);
  if (matchB && matchB[0]) {
    const val = parseInt(matchB[0], 10);
    if (val >= 100) purchasePrice = val;
  }

  // 粗利を強制的にプラスにする補正
  if (purchasePrice >= sellPrice) {
    purchasePrice = Math.round(sellPrice * 0.35);
  }

  // 送料や手数料の勝手な推測を廃止
  const shipping = 0;
  const feeRate = 0;
  const fee = 0;
  const profit = sellPrice - purchasePrice; // 単純な販売差額
  const profitRate = sellPrice > 0 ? Math.round((profit / sellPrice) * 100) : 0;

  return {
    productName,
    sellPrice,
    purchasePrice,
    shipping,
    feeRate,
    fee,
    profit,
    profitRate,
    scripts: generateDemoScriptTemplates(productName, sellPrice, purchasePrice, shipping, fee, profit, profitRate)
  };
}

// デモ用の台本テンプレート群
function generateDemoScriptTemplates(productName, sellPrice, purchasePrice, shipping, fee, profit, profitRate) {
  const fSell = formatCurrency(sellPrice);
  const fCost = formatCurrency(purchasePrice);
  const fProfit = formatCurrency(profit);
  const fShipping = formatCurrency(shipping);
  const fFee = formatCurrency(fee);

  return {
    buzz: [
      {
        title: "フック（冒頭の惹きつけ）",
        time: "0〜3秒",
        visual: "画面いっぱいに「一撃利益 " + fProfit + "」の赤い太文字テロップ！\\n次の瞬間、仕入れたばかりの " + productName + " を画面の目の前にドカン！と差し出す映像。\\nアップテンポでエネルギッシュなBGM開始。",
        speech: "たった1回の取引で利益" + fProfit + "！メルカリで即売れした" + productName + "の仕入れの裏側を大公開！"
      },
      {
        title: "問題提起（共感）",
        time: "3〜12秒",
        visual: "スマホでメルカリの画面を見ながら、残念そうに首を振る様子。\\n「せどりはもう稼げない？」という白いゴシック体の文字テロップ。",
        speech: "せどりはオワコン、もう利益商品なんて見つからないって諦めてませんか？実は、仕入れる『特定の状態』を知るだけで、簡単に利益を独占できるんです。"
      },
      {
        title: "解決策（仕入れ実録と利益内訳）",
        time: "12〜25秒",
        visual: "店舗での値札画像（" + fCost + "）と、今回の売値（" + fSell + "）の画像を左右に並べて表示。\\n送料 " + fShipping + " 、手数料 " + fFee + " などの内訳をグラフィカルに算出してアニメーションさせる。",
        speech: "今回の仕入れはたったの" + fCost + "。送料と手数料を引いても、手残りの純利益は" + fProfit + "！利益率は驚異の" + profitRate + "%です！"
      },
      {
        title: "クロージング（行動への誘導）",
        time: "25〜35秒",
        visual: "カメラに向かって手招きする笑顔の映像。\\nプロフィールのリンク先を拡大して、指差す矢印テロップを表示。BGMがフェードアウト。",
        speech: "このジャンルの美味しい仕入れ基準をまとめた『初心者ロードマップ』は、プロフリンクで今だけ無料配付中！今のうちに受け取ってね！"
      }
    ],
    educational: [
      {
        title: "フック＆イントロ",
        time: "0〜5秒",
        visual: "明るいオフィスの背景。話し手が笑顔でボードを指す。\\n緑色のテロップで「利益率" + profitRate + "%！アパレル物販の真実」を表示。",
        speech: "再現性抜群！今回はメルカリで仕入れ" + fCost + "から利益" + fProfit + "を出した、具体的な商品選定テクニックを解説します。"
      },
      {
        title: "ノウハウ解説",
        time: "5〜18秒",
        visual: "商品のコンディション部分（ソールやタグなど）をスライドでズーム。\\nタイトル文字入力のコツとして「状態、モデル名、限定」などのキーワードを目立たせる演出。",
        speech: "重要なのはキーワード設計です。メルカリで検索されやすい『コラボ名』や『限定カラー』を商品名の先頭に記載するだけで、インプレッションは一気に3倍になります。"
      },
      {
        title: "数字の裏付け",
        time: "18〜32秒",
        visual: "数値をグラフ化したスライドを表示。\\n仕入れ価格: " + fCost + "、売値: " + fSell + "、諸経費を計算した表。\\n中古品を簡単にメンテナンス（磨く作業）している1.5倍速の映像。",
        speech: "今回の原価は" + fCost + "ですが、100均の消しゴムクリーナーでほんの1分磨いてから出品したことで、相場より約3,000円高く売ることに成功しました。"
      },
      {
        title: "まとめとCTA",
        time: "32〜45秒",
        visual: "いいねとブックマーク（保存ボタン）を指し示すポップアップイラスト。\\n質問を促すコメントテロップ。",
        speech: "後から仕入れ店舗で見返せるように、今のうちにこの動画を保存しておいてくださいね。詳しい質問はコメント欄で受付中です！"
      }
    ],
    story: [
      {
        title: "オープニング",
        time: "0〜6秒",
        visual: "少し暗めの室内。スマホの画面を眺めながらため息をつく映像。\\n突然メルカリの売上通知音が「チャリーン！」と鳴り、表情がパッと明るくなる演出。",
        speech: "副業を諦めかけていた平凡な会社員が、仕事帰りのわずか1時間で日給" + fProfit + "を稼ぎ出したリアルな一日。"
      },
      {
        title: "過去の苦悩",
        time: "6〜20秒",
        visual: "駅のホームをうつむいて歩く姿。リサイクルショップの棚の前をうろうろして何も買えずに帰る過去の様子。\\n白黒の回想風エフェクト。",
        speech: "手取り18万。毎日遅くまで働いても貯金は増えず、焦って物販を始めましたが、最初はどれを見ても赤字に見えて、仕入れができず挫折寸前でした。"
      },
      {
        title: "ブレイクスルー",
        time: "20〜40秒",
        visual: "お店の棚の奥から今回の商品（" + productName + "）を宝物のように見つけ出す映像（カラーに戻る）。\\n仕入れ時の原価レシート（" + fCost + "）がポップアップ。出品直後に売れた履歴画面の表示。",
        speech: "でも、リサーチの考え方を変えて見つけたのがこの" + productName + "。仕入れ原価" + fCost + "が、出品後わずか2時間で" + fSell + "で売れ、手元に" + fProfit + "残ったとき、本当に震えました。"
      },
      {
        title: "未来への呼びかけ",
        time: "40〜55秒",
        visual: "パソコンに向かって前向きに作業している背中の映像。\\n画面下に「コメント欄に『副業』と入力」とアニメーション文字を表示。",
        speech: "正しい知識さえ身につければ、人生は自分の手で変えられます。僕が初心者から月10万稼いだステップは、コメント欄に『副業』と書いてくれた方に個別に共有します！"
      }
    ]
  };
}

// Google Gemini API（マルチモーダルモデル）の呼び出し
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
あなたはせどり（物販）のプロ動画クリエイター兼AI解析アシスタントです。
アップロードされた2枚の画像データを詳細に分析し、ショート動画用の台本を作成してください。

- 1枚目の画像（Image A）は、メルカリなどの販売完了画面のスクリーンショットです。ここから商品名、販売価格（売上）、および可能であれば送料や手数料を読み取ってください。
- 2枚目の画像（Image B）は、仕入れ金額を示すレシート、領収書、請求書、あるいは手書きメモの画像です。ここから商品の仕入れ原価を読み取ってください。

【計算および情報のルール (厳守)】
1. 画像に直接テキストや数値として記載されていない情報（送料、販売手数料など）を勝手に推測したり計算に含めたりしてはいけません。ただし、画像内に「送料」や「手数料」の金額がテキストとして明記されている場合（例：表の中に「送料：¥750」などの記載がある場合）は、その値を正確に読み取って JSON の shipping, fee に格納してください。画像内に明記されていない場合は、shipping と fee は 0 とします。
2. 利益は、「販売価格 － 仕入れ価格 － 送料（画像に記載がある場合） － 手数料（画像に記載がある場合）」として計算します。
3. 利益率 ＝ 利益 ÷ 販売価格 × 100 (%) を計算します。
4. 画像から商品名が不明な場合は勝手に捏造せず、「仕入れた商品」や「この商品」というプレーンで正確な表現を使用してください。

【動画編集の特徴】
映像はスマートフォン画面のスクリーンショット（メルカリ取引画面、仕入れメモ、クレジットカード明細、ヤマトや郵便局の発送サイズ定規など）のスライドショーのみで構成されます。実写の撮影指示は一切含めないでください。
そのため、各シーンの【映像演出・テロップ指示（visual）】には、「どのスクリーンショット画像を表示し、どのような簡潔なテロップ文字を重ねるか」のみを指定してください。

【ナレーション・台本の特徴】
せどりをやっている人（物販プレイヤー）が「あるある！」と深く共感・納得できる心理描写を交え、テンポよく極めて簡潔（1シーンにつき15〜30文字程度の非常に短いセリフ）に書いてください。前置きや「こんにちは」などの無駄な挨拶は完全に省略してください。

【出力フォーマット】
以下のJSON構造のみを返してください。余計なマークダウンの \`\`\`json ラッパーや前後の説明テキストは一切含めないでください。

{
  "productName": "読み取った商品名",
  "sellPrice": 販売価格(数値),
  "purchasePrice": 仕入れ価格(数値),
  "shipping": 画像から読み取った送料 (記載がなければ 0),
  "feeRate": 画像から読み取った手数料率 (記載がなければ 0),
  "fee": 画像から読み取った手数料額 (記載がなければ 0),
  "profit": 利益(販売価格 - 仕入れ価格 - 送料 - 手数料の数値),
  "profitRate": 利益率(数値、四捨五入した整数),
  "scripts": {
    "buzz": [
      {
        "title": "シーン名",
        "time": "時間(例: 0〜3秒)",
        "visual": "表示するスクショと重ねるテロップの指示",
        "speech": "簡潔なセリフ（15〜30文字程度）"
      }
    ],
    "educational": [
      {
        "title": "シーン名",
        "time": "時間",
        "visual": "表示するスクショと重ねるテロップの指示",
        "speech": "簡潔なセリフ（15〜30文字程度）"
      }
    ],
    "story": [
      {
        "title": "シーン名",
        "time": "時間",
        "visual": "表示するスクショと重ねるテロップの指示",
        "speech": "簡潔なセリフ（15〜30文字程度）"
      }
    ]
  }
}

各スクリプトスタイルはそれぞれ4個の短いシーンで構成してください。
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

// 台本結果カードの表示
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
        <span class="badge-label"><i class="fa-solid fa-yen-sign"></i> 仕入れ価格</span>
        <span class="badge-value">${formatCurrency(data.purchasePrice)}</span>
      </div>
      ${(data.shipping > 0 || data.fee > 0) ? `
      <div class="analysis-badge">
        <span class="badge-label"><i class="fa-solid fa-truck-fast"></i> 送料・手数料</span>
        <span class="badge-value" style="font-size: 0.95rem; font-weight: 600; color: var(--text-main);">
          ${formatCurrency(data.shipping)} + ${formatCurrency(data.fee)}
        </span>
      </div>
      ` : ''}
      <div class="analysis-badge">
        <span class="badge-label"><i class="fa-solid fa-hand-holding-dollar"></i> ${(data.shipping > 0 || data.fee > 0) ? '手残り利益' : '利益額'} (利益率)</span>
        <span class="badge-value ${profitClass}">
          ${formatCurrency(data.profit)} <span style="font-size: 0.85rem; font-weight: bold; color: inherit;">(${data.profitRate}%)</span>
        </span>
      </div>
    `;
  }

  // デフォルトで「インパクト重視(buzz)」をレンダリングする
  const activeTab = document.querySelector('.script-tab-btn.active');
  const style = activeTab ? activeTab.getAttribute('data-style') : 'buzz';
  renderScriptViewer(data.scripts[style]);
}

// 台本シーンリストのHTML出力
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
            <div class="col-title"><i class="fa-solid fa-camera"></i> 映像演出・テロップ指示</div>
            <div class="col-content">${scene.visual.replace(/\n/g, '<br>')}</div>
          </div>
          <div class="scene-col scene-col-right">
            <div class="col-title"><i class="fa-solid fa-microphone"></i> ナレーション原稿</div>
            <div class="speech-text-wrapper">
              <div class="col-content speech-content" id="speech-text-${index}">${scene.speech}</div>
              <div style="display: flex; gap: 0.1rem;">
                <button type="button" class="btn-scene-action btn-voice-play" data-index="${index}" title="セリフの音声を再生する">
                  <i class="fa-solid fa-volume-high"></i>
                </button>
                <button type="button" class="btn-scene-action btn-copy-scene" data-index="${index}" title="セリフをコピーする">
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

  // 各シーンのイベント割り当て
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
        alert(`シーン ${idx + 1} のセリフをコピーしました。`);
      });
    };
  });
}

// 音声再生切り替え
function handleSpeechSynthesisToggle(idx, text, button) {
  if (!window.speechSynthesis) {
    alert('お使いのブラウザは音声合成に対応していません。');
    return;
  }

  // 既に再生中の場合
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    
    // 同じボタンを押したなら停止のみ
    if (currentPlayButton === button) {
      setVoiceButtonPlayingState(button, false);
      currentPlayButton = null;
      return;
    }
    
    // 別のボタンなら、前のボタンの状態を元に戻す
    if (currentPlayButton) {
      setVoiceButtonPlayingState(currentPlayButton, false);
    }
  }

  currentPlayButton = button;
  setVoiceButtonPlayingState(button, true);

  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.lang = 'ja-JP';

  // 日本語話者のセット
  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find(v => v.lang.startsWith('ja'));
  if (jaVoice) {
    currentUtterance.voice = jaVoice;
  }

  currentUtterance.rate = 1.05; // わずかにテンポアップ

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
    button.title = 'セリフの音声を再生する';
    if (icon) icon.className = 'fa-solid fa-volume-high';
  }
}

// 全台本の一括コピー
function copyEntireScript(scenes, styleKey) {
  let styleTitle = "インパクト重視 (バズり系)";
  if (styleKey === 'educational') styleTitle = "解説・ノウハウ重視";
  if (styleKey === 'story') styleTitle = "ストーリー風 (実録)";

  let text = `【せどりショート動画台本】\n`;
  text += `構成スタイル: ${styleTitle}\n`;
  text += `判定商品: ${currentAnalysisData.productName}\n`;
  text += `手残り粗利: ${formatCurrency(currentAnalysisData.profit)} (利益率: ${currentAnalysisData.profitRate}%)\n`;
  text += `-------------------------------------------\n\n`;

  scenes.forEach((scene, index) => {
    text += `■ シーン ${index + 1}: ${scene.title} (${scene.time})\n`;
    text += `【映像演出・テロップ指示】\n${scene.visual}\n`;
    text += `【ナレーション原稿】\n${scene.speech}\n\n`;
  });

  navigator.clipboard.writeText(text).then(() => {
    alert('台本全体の原稿（映像演出＋ナレーション）をクリップボードにコピーしました！');
  }).catch(err => {
    alert('コピーに失敗しました: ' + err.message);
  });
}

// ==========================================
// 6. 動画自動生成・連携機能 コアロジック (追加)
// ==========================================

let videoPreloadedImages = null;
let videoIsPlaying = false;
let videoPlaybackTime = 0; // 現在の再生位置（秒）
const videoTotalDuration = 32; // 4シーン x 各8秒 = 32秒固定
let videoAnimationId = null;

// Web Audio API 関連
let videoAudioContext = null;
let videoAudioDestination = null;
let videoBgmInterval = null;

// MediaRecorder 関連
let videoRecorder = null;
let videoRecordedChunks = [];
let videoIsExporting = false;

// 外部動画編集アプリ連携用イベントの登録
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

  // モーダルを開く
  btnOpen.addEventListener('click', async () => {
    if (!uploadedImageDataA || !uploadedImageDataB) {
      alert('動画を生成するには、実績画像と仕入れ原価画像の両方をアップロードしてください。');
      return;
    }
    
    overlay.classList.remove('hidden');
    
    // 画像のプリロード
    try {
      showCanvasLoading(true);
      videoPreloadedImages = await preloadVideoImages();
      showCanvasLoading(false);
      resetVideoState();
      drawStaticPreview();
    } catch (err) {
      console.error(err);
      alert('画像の読み込みに失敗しました。');
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
      if (videoIsPlaying) {
        pauseVideoPreview();
      } else {
        startVideoPreview();
      }
    });
  }

  // キャンバスオーバーレイのクリックで再生
  if (canvasOverlay) {
    canvasOverlay.addEventListener('click', () => {
      startVideoPreview();
    });
  }

  // 動画エクスポート
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      exportVideoAsFile();
    });
  }

  // SRT字幕ダウンロード
  if (btnDownloadSrt) {
    btnDownloadSrt.addEventListener('click', () => {
      downloadSrtFile();
    });
  }

  // JSONダウンロード
  if (btnDownloadJson) {
    btnDownloadJson.addEventListener('click', () => {
      downloadJsonScript();
    });
  }
}

// キャンバス内のローディング表示
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
    ctx.fillText('素材画像をロード中...', canvas.width / 2, canvas.height / 2);
  }
}

// 画像プリロード
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

// 状態リセット
function resetVideoState() {
  videoPlaybackTime = 0;
  videoIsPlaying = false;
  videoIsExporting = false;
  updatePlaybackUI();
}

// 静的プレビューの描画 (最初のフレーム)
function drawStaticPreview() {
  const canvas = safeGetElement('video-canvas');
  if (!canvas || !videoPreloadedImages) return;
  
  renderFrameAtTime(0);
  const overlay = safeGetElement('canvas-play-overlay');
  if (overlay) overlay.classList.remove('hidden');
}

// 再生開始
function startVideoPreview() {
  if (videoIsExporting) return;
  
  // 音声合成の中断
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // AudioContext の初期化
  initAudioContext();
  
  videoIsPlaying = true;
  const btnPlay = safeGetElement('btn-video-play');
  if (btnPlay) {
    btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i> 一時停止';
  }
  
  const overlay = safeGetElement('canvas-play-overlay');
  if (overlay) overlay.classList.add('hidden');

  // BGM ビート生成の開始
  startSynthesizedBgm();

  // シーン音読の初回キック
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
      // 再生終了
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

// 完全停止
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
  
  if (currentText) currentText.textContent = videoPlaybackTime.toFixed(1) + '秒';
  if (totalText) totalText.textContent = videoTotalDuration.toFixed(1) + '秒';
  
  if (bar) {
    const percentage = (videoPlaybackTime / videoTotalDuration) * 100;
    bar.style.width = percentage + '%';
  }

  // シーンテキスト情報の更新
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

// 現在選択されているスタイルの台本シーンリストを取得
function getActiveScriptScenes() {
  if (!currentAnalysisData) return null;
  const activeTab = document.querySelector('.script-tab-btn.active');
  const style = activeTab ? activeTab.getAttribute('data-style') : 'buzz';
  return currentAnalysisData.scripts[style];
}

// 音声合成で現在のシーンを読み上げる
function speakCurrentSceneSpeech() {
  if (!window.speechSynthesis || videoIsExporting) return;
  
  const sceneIdx = Math.floor(videoPlaybackTime / 8);
  const scenes = getActiveScriptScenes();
  if (!scenes || !scenes[sceneIdx]) return;
  
  window.speechSynthesis.cancel();
  
  const text = scenes[sceneIdx].speech;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 1.1; // ややスピーディーに
  
  // 日本語話者設定
  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find(v => v.lang.startsWith('ja'));
  if (jaVoice) {
    utterance.voice = jaVoice;
  }
  
  window.speechSynthesis.speak(utterance);
}

// 特定の時間のフレームを描画
function renderFrameAtTime(timeSec) {
  const canvas = safeGetElement('video-canvas');
  if (!canvas || !videoPreloadedImages) return;
  
  const ctx = canvas.getContext('2d');
  const currentSceneIdx = Math.min(Math.floor(timeSec / 8), 3);
  const nextSceneIdx = Math.min(currentSceneIdx + 1, 3);
  const sceneTimeOffset = timeSec % 8; // このシーン内での経過時間(0〜8)
  
  const scenes = getActiveScriptScenes();
  if (!scenes) return;
  
  const currentScene = scenes[Math.min(currentSceneIdx, 3)];

  // 画像の選択
  // シーン1(0), 3(2), 4(3) は実績画像 A、シーン2(1) は仕入れ原価画像 B
  const getImgForScene = (idx) => {
    return idx === 1 ? videoPreloadedImages.imgB : videoPreloadedImages.imgA;
  };

  const imgCurrent = getImgForScene(currentSceneIdx);
  const imgNext = getImgForScene(nextSceneIdx);

  // フェード率の計算 (最後の0.5秒で次のシーンへ滑らかにクロスフェード)
  let fadeRatio = 0;
  if (sceneTimeOffset > 7.5 && currentSceneIdx < 3) {
    fadeRatio = (sceneTimeOffset - 7.5) / 0.5;
  }

  // 1. 画像をアスペクト比維持の Contain 描画 (切り取りを完全に防ぎ、全体を綺麗に表示)
  ctx.fillStyle = '#0a0f1d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawContainImg = (img, opacity) => {
    ctx.save();
    ctx.globalAlpha = opacity;
    
    // 画像は完全に固定 (ズームやスライド、切り取りは一切行わない)
    ctx.translate(canvas.width / 2, canvas.height / 2);
    
    const imgRatio = img.width / img.height;
    const canvasRatio = canvas.width / canvas.height;
    let renderW, renderH;
    
    // 画面内にぴったり収める (Contain)
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

  // 全体を覆う暗めのシネマティックグラデーション (テロップの視認性確保)
  const vGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  vGrad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
  vGrad.addColorStop(0.3, 'rgba(0, 0, 0, 0.2)');
  vGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.25)');
  vGrad.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. 超巨大数字テロップの描画 (画面中央 Y=450 付近に配置)
  if (currentAnalysisData) {
    const formattedProfit = formatCurrency(currentAnalysisData.profit);
    const formattedCost = formatCurrency(currentAnalysisData.purchasePrice);
    const formattedRate = `${currentAnalysisData.profitRate}%`;
    const formattedSell = formatCurrency(currentAnalysisData.sellPrice);

    // 画像から送料・手数料が検出されたかどうかでラベルを変更
    const hasExtra = (currentAnalysisData.shipping > 0 || currentAnalysisData.fee > 0);
    const profitLabel = hasExtra ? '手残り利益' : '利益差額';
    const profitSubLabel = hasExtra ? '送料・手数料考慮' : '画像データから自動計算';

    const drawHugeNumber = (label, mainVal, subLabel = '', mainColor = '#facc15') => {
      ctx.save();
      const centerY = 450;

      // 極太の黒縁取りで画像との重なりでも絶対に見やすくする
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 14;
      ctx.lineJoin = 'round';

      // ネオン調の強力なドロップシャドウ (グロー効果)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 6;

      // ラベル (一撃利益、仕入れ原価など)
      if (label) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 36px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeText(label, canvas.width / 2, centerY - 90);
        ctx.fillText(label, canvas.width / 2, centerY - 90);
      }

      // メインの超巨大数値 (¥12,500 など)
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

    // シーンごとの巨大数字アピール切り替え
    if (currentSceneIdx === 0) {
      // シーン1: フック
      drawHugeNumber(profitLabel, `+${formattedProfit}!!`, profitSubLabel, '#facc15'); // イエロー
    } else if (currentSceneIdx === 1) {
      // シーン2: 仕入れ (仕入れ原価を公開)
      drawHugeNumber('仕入れ原価', `${formattedCost}`, `販売価格 ${formattedSell}`, '#ef4444'); // 赤
    } else if (currentSceneIdx === 2) {
      // シーン3: 利益内訳 (利益額と利益率をアピール)
      drawHugeNumber(profitLabel, `+${formattedProfit}!!`, `利益率 ${formattedRate}`, '#10b981'); // グリーン
    } else if (currentSceneIdx === 3) {
      // シーン4: CTA・クロージング
      drawHugeNumber('利益率', `${formattedRate}`, '初心者向け物販ロードマップ', '#06b6d4'); // シアン
    }
  }

  // 3. 利益効果音 (シーン3突入時)
  if (currentSceneIdx === 2 && sceneTimeOffset < 0.1 && !videoIsExporting) {
    playCoinSound(videoAudioContext, videoAudioDestination || videoAudioContext.destination);
  }

  // 4. 字幕テロップの描画 (ナレーションは巨大数字と重ならないよう最下部 Y=1130 付近に配置)
  if (currentScene) {
    const text = currentScene.speech;
    const textY = 1130;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Noto Sans JP", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 読みやすさを確保する黒縁取りとドロップシャドウ
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

// AudioContext の遅延初期化
function initAudioContext() {
  if (videoAudioContext) return;
  
  // ブラウザの互換性確保
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    videoAudioContext = new AudioContextClass();
    // 録画用にオーディオストリームノードを作成
    if (videoAudioContext.createMediaStreamDestination) {
      videoAudioDestination = videoAudioContext.createMediaStreamDestination();
    }
  }
}

// BGM ビート生成
function startSynthesizedBgm() {
  if (!videoAudioContext) return;
  if (videoBgmInterval) clearInterval(videoBgmInterval);
  
  const dest = videoAudioDestination ? videoAudioDestination : videoAudioContext.destination;
  let beatCount = 0;
  
  // 0.5秒ごとにドラムキックとハイハットをシミュレーション
  videoBgmInterval = setInterval(() => {
    if (!videoIsPlaying && !videoIsExporting) return;
    
    // ドラムキック (偶数拍)
    if (beatCount % 2 === 0) {
      triggerKick(videoAudioContext, dest);
    }
    
    // ハイハット (全拍)
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

// ドラムキックシンセ
function triggerKick(audioCtx, dest) {
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(dest);
    
    osc.frequency.setValueAtTime(120, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
    
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch (e) {
    console.error(e);
  }
}

// ハイハットシンセ
function triggerHihat(audioCtx, dest) {
  try {
    const bufferSize = audioCtx.sampleRate * 0.04;
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
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    
    noise.start();
  } catch (e) {
    console.error(e);
  }
}

// コイン音（チャリーン）シンセ
function playCoinSound(audioCtx, dest) {
  try {
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc1.type = 'sine';
    osc2.type = 'sine';
    
    osc1.frequency.setValueAtTime(987.77, audioCtx.currentTime); // B5
    osc2.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.05); // E6
    
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.7);
    
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

// WebM 動画の作成・ダウンロード
async function exportVideoAsFile() {
  if (videoIsExporting) return;
  
  // 現在の再生を停止
  stopVideoPreview();
  initAudioContext();
  
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

  // キャンバスストリーム (30fps)
  const canvasStream = canvas.captureStream(30);
  const mixedStream = new MediaStream();
  
  // 映像トラックの追加
  canvasStream.getVideoTracks().forEach(track => mixedStream.addTrack(track));
  
  // 音声トラックの追加 (Web Audio から)
  if (videoAudioDestination) {
    videoAudioDestination.stream.getAudioTracks().forEach(track => {
      mixedStream.addTrack(track);
    });
  }
  
  // MediaRecorder インスタンス生成
  let options = { mimeType: 'video/webm;codecs=vp9,opus' };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options = { mimeType: 'video/webm;codecs=vp8,opus' };
  }
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options = { mimeType: 'video/webm' };
  }
  
  try {
    videoRecorder = new MediaRecorder(mixedStream, options);
  } catch (e) {
    console.error('MediaRecorderの初期化に失敗しました。デフォルト設定を使います:', e);
    videoRecorder = new MediaRecorder(mixedStream);
  }
  
  videoRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      videoRecordedChunks.push(event.data);
    }
  };
  
  videoRecorder.onstop = () => {
    const blob = new Blob(videoRecordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    
    // ダウンロードリンクを生成して発火
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    const activeTab = document.querySelector('.script-tab-btn.active');
    const styleKey = activeTab ? activeTab.getAttribute('data-style') : 'buzz';
    const prodNameClean = currentAnalysisData.productName.replace(/[\\/:*?"<>|]/g, '');
    a.download = `せどり動画台本_${styleKey}_${prodNameClean}.webm`;
    
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
    
    // UIの元戻し
    videoIsExporting = false;
    if (btnExport) btnExport.disabled = false;
    if (statusDiv) statusDiv.classList.add('hidden');
    stopSynthesizedBgm();
    resetVideoState();
    drawStaticPreview();
    alert('動画ファイルの書き出しが完了し、ダウンロードを開始しました！');
  };
  
  // 録画開始
  videoRecorder.start();
  startSynthesizedBgm();
  
  // レンダリングループ (実時間で回す)
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
      // 終了
      videoRecorder.stop();
      return;
    }
    
    renderFrameAtTime(videoPlaybackTime);
    
    requestAnimationFrame(exportLoop);
  }
  
  requestAnimationFrame(exportLoop);
}

// SRT字幕ファイルのダウンロード
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

// JSON台本データのダウンロード
function downloadJsonScript() {
  if (!currentAnalysisData) return;
  
  const jsonStr = JSON.stringify(currentAnalysisData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const prodNameClean = currentAnalysisData.productName.replace(/[\\/:*?"<>|]/g, '');
  a.download = `台本データ_${prodNameClean}.json`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
