import { Game } from './game.js';
import { BanqiAI } from './ai.js';
import { SIDE, PIECE_NAMES } from './constants.js';

let game;
let ai;
let selectedPiece = null; // 格式: { r, c }
let validMovesForSelected = [];
let isWaitingForAi = false;

// 輔助延遲函數
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 從 DOM 取得當前規則開關狀態
function getRulesFromUI() {
  return {
    ruleKingEatSoldier: document.getElementById('rule-king-eat-soldier').checked,
    ruleAdvisorEatChariot: document.getElementById('rule-advisor-eat-chariot').checked,
    ruleCannonDarkEat: document.getElementById('rule-cannon-dark-eat').checked,
    ruleNoRepeatedMoves: document.getElementById('rule-no-repeated-moves').checked
  };
}

// 取得當前設定的 AI 難度
function getDifficultyFromUI() {
  const activeBtn = document.querySelector('#ai-difficulty-group .toggle-btn.active');
  return activeBtn ? activeBtn.dataset.value : 'Hard';
}

// 初始化遊戲
function initGame() {
  const rules = getRulesFromUI();
  const difficulty = getDifficultyFromUI();
  
  game = new Game(rules, difficulty);
  ai = new BanqiAI(difficulty);
  
  game.start();
  selectedPiece = null;
  validMovesForSelected = [];
  isWaitingForAi = false;
  
  render();
}

// 渲染畫面
function render() {
  renderBoard();
  renderTurnBanner();
  renderLogs();
  renderCapturedPieces();
  checkGameOverModal();
}

// 渲染棋盤
function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 8; c++) {
      const slot = document.createElement('div');
      slot.className = 'piece-slot';
      
      const piece = game.board.getPiece(r, c);
      const isSelected = selectedPiece && selectedPiece.r === r && selectedPiece.c === c;
      const isValidTarget = validMovesForSelected.some(m => m.to.r === r && m.to.c === c);

      if (piece) {
        // 渲染棋子卡片
        const card = document.createElement('div');
        card.className = 'piece-card';
        if (piece.revealed) {
          card.classList.add('revealed');
        }
        if (isSelected) {
          card.classList.add('selected');
        }
        
        card.dataset.row = r;
        card.dataset.col = c;

        // 卡片正面 (文字)
        const front = document.createElement('div');
        front.className = `piece-face piece-front ${piece.side.toLowerCase()}`;
        front.textContent = PIECE_NAMES[piece.side][piece.type];

        // 卡片背面 (紋路)
        const back = document.createElement('div');
        back.className = 'piece-face piece-back';

        card.appendChild(front);
        card.appendChild(back);
        
        // 點擊事件
        card.addEventListener('click', () => handlePieceClick(r, c));
        slot.appendChild(card);
      } else if (isValidTarget) {
        // 如果該格是空地，且是合法移動目的地：渲染小金點
        const dot = document.createElement('div');
        dot.className = 'move-dot';
        dot.addEventListener('click', () => handleMove(selectedPiece.r, selectedPiece.c, r, c));
        slot.appendChild(dot);
      }

      boardEl.appendChild(slot);
    }
  }
}

// 點擊棋子處理
async function handlePieceClick(r, c) {
  if (isWaitingForAi || game.isGameOver) return;

  const piece = game.board.getPiece(r, c);
  if (!piece) return;

  // 1. 翻棋
  if (!piece.revealed) {
    // 只能在屬於玩家的回合翻棋 (第一步時 currentTurn 為 null，允許翻棋)
    if (game.currentTurn && game.currentTurn !== game.playerSide) {
      showToast('現在是 AI 的回合！');
      return;
    }
    
    // 播放翻棋動畫與音效模擬
    const card = document.querySelector(`.piece-card[data-row="${r}"][data-col="${c}"]`);
    if (card) {
      card.classList.add('revealed');
    }
    
    // 延遲一點點讓翻牌動畫播放
    await sleep(250);
    
    game.playerReveal(r, c);
    selectedPiece = null;
    validMovesForSelected = [];
    render();
    
    // 觸發 AI 回合
    triggerAiIfNeeded();
    return;
  }

  // 2. 選中我方棋子
  if (piece.side === game.playerSide) {
    if (game.currentTurn !== game.playerSide) {
      showToast('現在是 AI 的回合！');
      return;
    }

    if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
      // 重複點擊取消選取
      selectedPiece = null;
      validMovesForSelected = [];
    } else {
      selectedPiece = { r, c };
      validMovesForSelected = game.board.getValidMoves(r, c);
    }
    render();
    return;
  }

  // 3. 點擊敵方棋子（已翻開或未翻開的暗吃）
  if (selectedPiece) {
    const isMoveValid = validMovesForSelected.some(m => m.to.r === r && m.to.c === c);
    if (isMoveValid) {
      handleMove(selectedPiece.r, selectedPiece.c, r, c);
    } else {
      // 點擊非合法目標，視為取消選取或改選
      selectedPiece = null;
      validMovesForSelected = [];
      render();
    }
  }
}

// 處理移動與吃子 (含暗吃動畫)
async function handleMove(fromR, fromC, toR, toC) {
  if (isWaitingForAi || game.isGameOver) return;

  const attacker = game.board.getPiece(fromR, fromC);
  const target = game.board.getPiece(toR, toC);
  const moveRes = game.board.isValidMove(fromR, fromC, toR, toC);

  if (!moveRes.valid) {
    // 播放震動動畫
    const card = document.querySelector(`.piece-card[data-row="${fromR}"][data-col="${fromC}"]`);
    if (card) {
      card.classList.add('shake');
      setTimeout(() => card.classList.remove('shake'), 400);
    }
    showToast(moveRes.error);
    return;
  }

  // 鎖定 UI 播放動畫
  isWaitingForAi = true;

  const attCard = document.querySelector(`.piece-card[data-row="${fromR}"][data-col="${fromC}"]`);
  const tarCard = document.querySelector(`.piece-card[data-row="${toR}"][data-col="${toC}"]`);

  if (moveRes.type === 'move') {
    // 執行普通移動
    game.playerMove(fromR, fromC, toR, toC);
  } else if (moveRes.type === 'eat') {
    // 播放吃子碎裂動畫
    if (tarCard) tarCard.classList.add('shatter');
    await sleep(500);
    game.playerMove(fromR, fromC, toR, toC);
  } else if (moveRes.type === 'dark_eat') {
    // 暗吃判定
    const canEat = game.board.canEat(attacker, target);
    if (canEat) {
      // 暗吃成功：先揭露隱藏子，然後碎裂它
      if (tarCard) {
        tarCard.classList.add('revealed');
        const front = tarCard.querySelector('.piece-front');
        front.className = `piece-face piece-front ${target.side.toLowerCase()}`;
        front.textContent = PIECE_NAMES[target.side][target.type];
        await sleep(350);
        tarCard.classList.add('shatter');
      }
      await sleep(400);
    } else {
      // 暗吃失敗：我方棋子碎裂，敵方暗棋當場翻開
      if (attCard) attCard.classList.add('shatter');
      if (tarCard) tarCard.classList.add('revealed');
      await sleep(550);
    }
    game.playerMove(fromR, fromC, toR, toC);
  }

  selectedPiece = null;
  validMovesForSelected = [];
  isWaitingForAi = false;
  render();

  // 觸發 AI 回合
  triggerAiIfNeeded();
}

// AI 行動決策與動畫
async function triggerAiIfNeeded() {
  if (game.isGameOver || game.currentTurn !== game.aiSide) return;

  isWaitingForAi = true;
  
  // 更新回合提示 Banner
  const banner = document.getElementById('turn-banner');
  banner.textContent = 'AI 大師正在思考棋局...';
  
  // 思考時間模擬
  await sleep(800);

  const aiAction = ai.getBestMove(game);
  if (!aiAction) {
    // AI 無棋可走
    isWaitingForAi = false;
    game.checkGameStatus();
    render();
    return;
  }

  // 執行 AI 動畫與狀態
  const { r: toR, c: toC } = aiAction.to;

  if (aiAction.type === 'reveal') {
    // AI 翻棋動畫
    const card = document.querySelector(`.piece-card[data-row="${toR}"][data-col="${toC}"]`);
    if (card) {
      card.classList.add('revealed');
    }
    await sleep(300);
    game.executeAiAction(aiAction);
  } else if (aiAction.type === 'move') {
    game.executeAiAction(aiAction);
  } else {
    // AI 吃子或暗吃
    const { r: fromR, c: fromC } = aiAction.from;
    const attacker = game.board.getPiece(fromR, fromC);
    const target = game.board.getPiece(toR, toC);

    const attCard = document.querySelector(`.piece-card[data-row="${fromR}"][data-col="${fromC}"]`);
    const tarCard = document.querySelector(`.piece-card[data-row="${toR}"][data-col="${toC}"]`);

    if (aiAction.type === 'eat') {
      if (tarCard) tarCard.classList.add('shatter');
      await sleep(500);
    } else if (aiAction.type === 'dark_eat') {
      const canEat = game.board.canEat(attacker, target);
      if (canEat) {
        if (tarCard) {
          tarCard.classList.add('revealed');
          const front = tarCard.querySelector('.piece-front');
          front.className = `piece-face piece-front ${target.side.toLowerCase()}`;
          front.textContent = PIECE_NAMES[target.side][target.type];
          await sleep(350);
          tarCard.classList.add('shatter');
        }
        await sleep(400);
      } else {
        if (attCard) attCard.classList.add('shatter');
        if (tarCard) tarCard.classList.add('revealed');
        await sleep(550);
      }
    }
    game.executeAiAction(aiAction);
  }

  isWaitingForAi = false;
  render();
}

// 渲染回合狀態 Banner
function renderTurnBanner() {
  const banner = document.getElementById('turn-banner');
  banner.className = 'turn-banner';

  if (game.playerSide === null) {
    banner.textContent = '請翻棋決定陣營';
    return;
  }

  if (game.isGameOver) {
    banner.textContent = '對局結束';
    return;
  }

  const turnName = game.currentTurn === SIDE.RED ? '紅方' : '黑方';
  if (game.currentTurn === game.playerSide) {
    banner.textContent = `我的回合 (${turnName})`;
    banner.classList.add(game.playerSide === SIDE.RED ? 'red-turn' : 'black-turn');
  } else {
    banner.textContent = `AI 回合 (${turnName})`;
    banner.classList.add(game.aiSide === SIDE.RED ? 'red-turn' : 'black-turn');
  }
}

// 渲染已陣亡棋子墓碑
function renderCapturedPieces() {
  const redContainer = document.getElementById('captured-red');
  const blackContainer = document.getElementById('captured-black');
  
  redContainer.innerHTML = '';
  blackContainer.innerHTML = '';

  // 排序讓排列整齊：按階級大小降序
  const sortPieces = (list) => {
    return list.sort((a, b) => b.rank - a.rank);
  };

  sortPieces(game.capturedPieces[SIDE.RED]).forEach(p => {
    const mini = document.createElement('div');
    mini.className = 'captured-piece-mini red';
    mini.textContent = PIECE_NAMES[SIDE.RED][p.type];
    redContainer.appendChild(mini);
  });

  sortPieces(game.capturedPieces[SIDE.BLACK]).forEach(p => {
    const mini = document.createElement('div');
    mini.className = 'captured-piece-mini black';
    mini.textContent = PIECE_NAMES[SIDE.BLACK][p.type];
    blackContainer.appendChild(mini);
  });
}

// 渲染日誌流
function renderLogs() {
  const logBox = document.getElementById('log-box');
  logBox.innerHTML = '';

  game.logs.forEach(log => {
    const item = document.createElement('div');
    item.className = 'log-item';
    
    if (log.startsWith('AI')) {
      item.classList.add('ai');
    } else if (log.startsWith('玩家') || log.startsWith('第一步')) {
      item.classList.add('player');
    }

    item.textContent = log;
    logBox.appendChild(item);
  });

  // 自動滾動到底部
  logBox.scrollTop = logBox.scrollHeight;
}

// 彈出遊戲結束視窗
function checkGameOverModal() {
  const modal = document.getElementById('modal-gameover');
  const title = document.getElementById('modal-title');
  const msg = document.getElementById('modal-message');

  if (game.isGameOver) {
    modal.classList.add('active');
    
    if (game.winner === game.playerSide) {
      title.textContent = '🏆 恭喜凱旋！';
      msg.textContent = '您成功擊敗了 AI 暗棋大師！';
    } else if (game.winner === game.aiSide) {
      title.textContent = '💀 棋差一招';
      msg.textContent = 'AI 大師獲得了這場對決的勝利。';
    } else {
      title.textContent = '🤝 和局結算';
      msg.textContent = '雙方均無路可走，握手言和。';
    }
  } else {
    modal.classList.remove('active');
  }
}

// 顯示提示訊息 (Toast)
function showToast(message) {
  const div = document.createElement('div');
  div.style.position = 'fixed';
  div.style.bottom = '30px';
  div.style.left = '50%';
  div.style.transform = 'translateX(-50%)';
  div.style.background = 'rgba(207, 34, 46, 0.9)';
  div.style.color = '#fff';
  div.style.padding = '10px 24px';
  div.style.borderRadius = '20px';
  div.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
  div.style.zIndex = '1000';
  div.style.fontSize = '0.95rem';
  div.style.fontWeight = '600';
  div.style.fontFamily = 'var(--font-chinese)';
  div.style.letterSpacing = '1px';
  
  div.textContent = message;
  document.body.appendChild(div);
  
  setTimeout(() => {
    div.style.transition = 'opacity 0.5s';
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 500);
  }, 1800);
}

// 事件綁定
function setupEventListeners() {
  // 規則開關監聽：更新設定到實例中
  const updateSettings = () => {
    if (game) {
      game.rules = getRulesFromUI();
      game.board.rules = game.rules;
    }
  };

  document.getElementById('rule-king-eat-soldier').addEventListener('change', updateSettings);
  document.getElementById('rule-advisor-eat-chariot').addEventListener('change', updateSettings);
  document.getElementById('rule-cannon-dark-eat').addEventListener('change', updateSettings);
  document.getElementById('rule-no-repeated-moves').addEventListener('change', updateSettings);

  // AI 難度按鈕切換
  const diffBtns = document.querySelectorAll('#ai-difficulty-group .toggle-btn');
  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      diffBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const newDifficulty = btn.dataset.value;
      if (game && ai) {
        game.aiDifficulty = newDifficulty;
        ai.difficulty = newDifficulty;
        game.logs.push(`系統：AI 難度已切換為【${newDifficulty === 'Easy' ? '休閒' : '大師'}】`);
        renderLogs();
      }
    });
  });

  // 控制按鈕
  document.getElementById('btn-undo').addEventListener('click', () => {
    if (isWaitingForAi) return;
    const ok = game.undo();
    if (ok) {
      selectedPiece = null;
      validMovesForSelected = [];
      render();
    } else {
      showToast('無法悔棋（已經是開局狀態）');
    }
  });

  document.getElementById('btn-restart').addEventListener('click', () => {
    if (confirm('確定要結束當前對局並重來嗎？')) {
      initGame();
    }
  });

  document.getElementById('btn-modal-restart').addEventListener('click', () => {
    document.getElementById('modal-gameover').classList.remove('active');
    initGame();
  });
}

// 啟動遊戲
window.addEventListener('DOMContentLoaded', () => {
  initGame();
});
