import { SIDE, PIECE_TYPE, PIECE_RANK } from './constants.js';
import { Piece } from './board.js';

// 棋子價值評估 (用於 AI 局勢分析)
const PIECE_VALUES = {
  [PIECE_TYPE.KING]: 10000,
  [PIECE_TYPE.ADVISOR]: 2000,
  [PIECE_TYPE.MINISTER]: 800,
  [PIECE_TYPE.CHARIOT]: 500,
  [PIECE_TYPE.HORSE]: 300,
  [PIECE_TYPE.CANNON]: 250,
  [PIECE_TYPE.SOLDIER]: 100
};

export class BanqiAI {
  constructor(difficulty = 'Hard') {
    this.difficulty = difficulty;
  }

  // 取得最佳行動
  // 回傳：{ type: 'reveal'|'move'|'eat'|'dark_eat', from: {r,c}, to: {r,c} }
  getBestMove(game) {
    const aiSide = game.aiSide;
    const rules = game.rules;
    const board = game.board;

    // 如果 AI 還沒有陣營（表示第一步翻棋尚未走，但通常玩家先手，故此狀況極少見）
    if (!aiSide) {
      return this.getRandomRevealAction(board);
    }

    // 取得所有合法動作
    const allActions = this.getAllPossibleActions(board, aiSide);
    if (allActions.length === 0) return null; // 無法可走

    if (this.difficulty === 'Easy') {
      return this.getEasyMove(board, aiSide, allActions);
    } else {
      return this.getHardMove(board, aiSide, allActions, rules);
    }
  }

  // 取得隨機翻棋動作
  getRandomRevealAction(board) {
    const reveals = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board.grid[r][c];
        if (p && !p.revealed) {
          reveals.push({ type: 'reveal', to: { r, c } });
        }
      }
    }
    if (reveals.length > 0) {
      return reveals[Math.floor(Math.random() * reveals.length)];
    }
    return null;
  }

  // 取得所有可行動作（包含移動、吃、暗吃、翻棋）
  getAllPossibleActions(board, side) {
    const actions = [];
    
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board.grid[r][c];
        if (!p) continue;

        if (!p.revealed) {
          // 翻棋動作
          actions.push({ type: 'reveal', to: { r, c } });
        } else if (p.side === side) {
          // 已翻開的自方棋子：取得其可行步
          const moves = board.getValidMoves(r, c);
          for (const m of moves) {
            actions.push({
              type: m.type, // 'move', 'eat', 'dark_eat'
              from: m.from,
              to: m.to
            });
          }
        }
      }
    }
    return actions;
  }

  // Easy AI: 簡單啟發式與隨機混合
  getEasyMove(board, aiSide, actions) {
    // 優先權：
    // 1. 吃子 (eat) - 依照被吃棋子的價值排序，越大越好
    // 2. 暗吃 (dark_eat) - 隨機挑選，帶點賭博性
    // 3. 翻棋 (reveal) / 一般移動 (move) - 隨機
    const eats = actions.filter(a => a.type === 'eat');
    if (eats.length > 0) {
      // 排序：吃掉價值最高的子
      eats.sort((a, b) => {
        const targetA = board.getPiece(a.to.r, a.to.c);
        const targetB = board.getPiece(b.to.r, b.to.c);
        return (targetB ? PIECE_VALUES[targetB.type] : 0) - (targetA ? PIECE_VALUES[targetA.type] : 0);
      });
      return eats[0];
    }

    const darkEats = actions.filter(a => a.type === 'dark_eat');
    if (darkEats.length > 0 && Math.random() < 0.4) {
      return darkEats[Math.floor(Math.random() * darkEats.length)];
    }

    // 移動與翻棋混合
    const remaining = actions.filter(a => a.type === 'move' || a.type === 'reveal');
    if (remaining.length > 0) {
      return remaining[Math.floor(Math.random() * remaining.length)];
    }

    // 若都沒，選任意動作
    return actions[Math.floor(Math.random() * actions.length)];
  }

  // Hard AI: Expectiminimax 演算法
  getHardMove(board, aiSide, actions, rules) {
    let bestScore = -Infinity;
    let bestAction = null;
    const depth = 2; // 機率賽局搜尋 2 層 (AI 動作 -> 機率/玩家動作 -> 葉節點) 效果最佳且不卡頓

    // 對所有動作進行 Expectiminimax 評估
    for (const action of actions) {
      let score = 0;
      
      if (action.type === 'reveal') {
        // 機率節點：翻開蓋棋
        score = this.evaluateRevealExpectation(board, action.to.r, action.to.c, depth - 1, aiSide, rules);
      } else if (action.type === 'dark_eat') {
        // 機率節點：暗吃蓋棋
        score = this.evaluateDarkEatExpectation(board, action.from, action.to, depth - 1, aiSide, rules);
      } else {
        // 確定性節點：移動或吃子
        const nextBoard = board.clone();
        nextBoard.executeAction(action.from.r, action.from.c, action.to.r, action.to.c);
        score = this.expectiminimax(nextBoard, depth - 1, false, -Infinity, Infinity, aiSide, rules);
      }

      // 稍微加點隨機擾動，避免每次遇到相同局勢走法死板
      score += (Math.random() - 0.5) * 5;

      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }

    return bestAction;
  }

  // 評估翻棋機率期望值
  evaluateRevealExpectation(board, r, c, depth, aiSide, rules) {
    const unrevealedPool = board.getRemainingUnrevealedPieces();
    let totalUnrevealed = 0;
    for (const count of Object.values(unrevealedPool)) {
      totalUnrevealed += count;
    }

    if (totalUnrevealed === 0) return this.evaluateBoard(board, aiSide);

    let expectedScore = 0;

    for (const [key, count] of Object.entries(unrevealedPool)) {
      const prob = count / totalUnrevealed;
      const [side, type] = key.split('_');

      // 模擬此格翻出該棋子
      const nextBoard = board.clone();
      const simPiece = new Piece(`sim-${Date.now()}`, side, type, true);
      nextBoard.setPiece(r, c, simPiece);

      // 翻開後，輪到對手 (isMax = false)
      const score = this.expectiminimax(nextBoard, depth, false, -Infinity, Infinity, aiSide, rules);
      expectedScore += prob * score;
    }

    return expectedScore;
  }

  // 評估暗吃機率期望值
  evaluateDarkEatExpectation(board, from, to, depth, aiSide, rules) {
    const unrevealedPool = board.getRemainingUnrevealedPieces();
    let totalUnrevealed = 0;
    for (const count of Object.values(unrevealedPool)) {
      totalUnrevealed += count;
    }

    if (totalUnrevealed === 0) return this.evaluateBoard(board, aiSide);

    const attacker = board.getPiece(from.r, from.c);
    if (!attacker) return -Infinity;

    let expectedScore = 0;

    for (const [key, count] of Object.entries(unrevealedPool)) {
      const prob = count / totalUnrevealed;
      const [side, type] = key.split('_');

      // 建立隱藏子模擬對象
      const simTarget = new Piece(`sim-${Date.now()}`, side, type, false);

      const nextBoard = board.clone();
      nextBoard.setPiece(to.r, to.c, simTarget);

      // 執行暗吃
      nextBoard.executeAction(from.r, from.c, to.r, to.c);

      // 執行後輪到對手 (isMax = false)
      const score = this.expectiminimax(nextBoard, depth, false, -Infinity, Infinity, aiSide, rules);
      expectedScore += prob * score;
    }

    return expectedScore;
  }

  // Expectiminimax 主遞迴
  expectiminimax(board, depth, isMax, alpha, beta, aiSide, rules) {
    if (depth === 0) {
      return this.evaluateBoard(board, aiSide);
    }

    const currentSide = isMax ? aiSide : (aiSide === SIDE.RED ? SIDE.BLACK : SIDE.RED);
    const actions = this.getAllPossibleActions(board, currentSide);

    if (actions.length === 0) {
      // 無步可走判定輸贏
      // 如果是 isMax 回合無步可走，代表 AI 輸了，回傳極小值
      return isMax ? -20000 : 20000;
    }

    if (isMax) {
      let maxScore = -Infinity;
      for (const action of actions) {
        let score = 0;
        if (action.type === 'reveal') {
          score = this.evaluateRevealExpectation(board, action.to.r, action.to.c, depth - 1, aiSide, rules);
        } else if (action.type === 'dark_eat') {
          score = this.evaluateDarkEatExpectation(board, action.from, action.to, depth - 1, aiSide, rules);
        } else {
          const nextBoard = board.clone();
          nextBoard.executeAction(action.from.r, action.from.c, action.to.r, action.to.c);
          score = this.expectiminimax(nextBoard, depth - 1, false, alpha, beta, aiSide, rules);
        }

        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break; // Alpha-Beta 剪枝
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const action of actions) {
        let score = 0;
        if (action.type === 'reveal') {
          score = this.evaluateRevealExpectation(board, action.to.r, action.to.c, depth - 1, aiSide, rules);
        } else if (action.type === 'dark_eat') {
          score = this.evaluateDarkEatExpectation(board, action.from, action.to, depth - 1, aiSide, rules);
        } else {
          const nextBoard = board.clone();
          nextBoard.executeAction(action.from.r, action.from.c, action.to.r, action.to.c);
          score = this.expectiminimax(nextBoard, depth - 1, true, alpha, beta, aiSide, rules);
        }

        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break; // Alpha-Beta 剪枝
      }
      return minScore;
    }
  }

  // 靜態局勢評估函數
  evaluateBoard(board, aiSide) {
    let score = 0;
    const playerSide = aiSide === SIDE.RED ? SIDE.BLACK : SIDE.RED;

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board.grid[r][c];
        if (!p) continue;

        const val = PIECE_VALUES[p.type] || 0;

        if (p.revealed) {
          // 已翻開的棋子
          if (p.side === aiSide) {
            score += val;
            // 加上微小的移動力分
            const moves = board.getValidMoves(r, c);
            score += moves.length * 10;
          } else {
            score -= val;
            const moves = board.getValidMoves(r, c);
            score -= moves.length * 10;
          }
        } else {
          // 未翻開的棋子：在局勢尚未明朗前，未翻開子屬於雙方潛在價值
          // 但因為 AI 知道此未翻子的陣營，但不知道玩家會翻哪格，所以：
          // 這裡對未翻子做「輕微折舊」評估，讓 AI 傾向翻開未翻子或保留我方未翻子
          if (p.side === aiSide) {
            score += val * 0.2; // 保留我方暗棋的潛在價值
          } else {
            score -= val * 0.2; // 敵方暗棋的潛在價值
          }
        }
      }
    }
    return score;
  }
}
