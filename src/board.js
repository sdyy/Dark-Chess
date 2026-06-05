import { SIDE, PIECE_TYPE, PIECE_RANK, INITIAL_PIECE_COUNTS } from './constants.js';

export class Piece {
  constructor(id, side, type, revealed = false) {
    this.id = id;
    this.side = side;
    this.type = type;
    this.revealed = revealed;
  }

  get rank() {
    return PIECE_RANK[this.type];
  }

  clone() {
    return new Piece(this.id, this.side, this.type, this.revealed);
  }
}

export class Board {
  constructor(rules) {
    this.rules = rules || {
      ruleKingEatSoldier: false,
      ruleAdvisorEatChariot: false,
      ruleCannonDarkEat: true,
      ruleNoRepeatedMoves: true
    };
    this.grid = Array.from({ length: 4 }, () => Array(8).fill(null));
  }

  initialize() {
    // 1. 生成 32 顆棋子
    const pieces = [];
    let idCounter = 0;
    
    for (const side of [SIDE.RED, SIDE.BLACK]) {
      for (const [type, count] of Object.entries(INITIAL_PIECE_COUNTS)) {
        for (let i = 0; i < count; i++) {
          pieces.push(new Piece(`p-${idCounter++}`, side, type, false));
        }
      }
    }

    // 2. 洗牌 (Fisher-Yates Shuffle)
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }

    // 3. 填入 4x8 棋盤
    let index = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        this.grid[r][c] = pieces[index++];
      }
    }
  }

  clone() {
    const newBoard = new Board(this.rules);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.grid[r][c];
        newBoard.grid[r][c] = p ? p.clone() : null;
      }
    }
    return newBoard;
  }

  getPiece(row, col) {
    if (row < 0 || row >= 4 || col < 0 || col >= 8) return null;
    return this.grid[row][col];
  }

  setPiece(row, col, piece) {
    if (row >= 0 && row < 4 && col >= 0 && col < 8) {
      this.grid[row][col] = piece;
    }
  }

  // 取得所有未翻開的棋子種類與數量（AI 機率計算用）
  getRemainingUnrevealedPieces() {
    const counts = {};
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.grid[r][c];
        if (p && !p.revealed) {
          const key = `${p.side}_${p.type}`;
          counts[key] = (counts[key] || 0) + 1;
        }
      }
    }
    return counts;
  }

  // 判斷 A 棋子是否能吃 B 棋子 (A, B 均已翻開且為敵對)
  canEat(attacker, target) {
    if (attacker.side === target.side) return false;

    // 1. 炮的吃法：必须是跳吃 (跳吃邏輯由 isValidMove 判定，此處僅驗證階級)
    // 炮跳吃可以吃任何棋子
    if (attacker.type === PIECE_TYPE.CANNON) {
      return true;
    }

    // 2. 兵/卒 (1) 的吃法
    if (attacker.type === PIECE_TYPE.SOLDIER) {
      // 兵能吃兵(1)、炮(2)、或將/帥(7)
      return target.type === PIECE_TYPE.SOLDIER || 
             target.type === PIECE_TYPE.CANNON || 
             target.type === PIECE_TYPE.KING;
    }

    // 3. 將/帥 (7) 的吃法
    if (attacker.type === PIECE_TYPE.KING) {
      // 兵卒剋將帥：預設將帥不能吃兵卒
      if (target.type === PIECE_TYPE.SOLDIER) {
        return this.rules.ruleKingEatSoldier;
      }
      return true;
    }

    // 4. 仕/士可吃車規則 (仕 6, 車 4)
    if (this.rules.ruleAdvisorEatChariot) {
      if (attacker.type === PIECE_TYPE.ADVISOR && target.type === PIECE_TYPE.CHARIOT) {
        return true;
      }
      if (attacker.type === PIECE_TYPE.CHARIOT && target.type === PIECE_TYPE.ADVISOR) {
        return false;
      }
    }

    // 5. 一般大小判定 (大吃小或同級相克)
    // 注意：除了炮之外，其他棋子若階級大於等於目標，且排除上述例外，即可吃
    return attacker.rank >= target.rank;
  }

  // 驗證移動合法性
  // 回傳結果：{ valid: boolean, type: 'move'|'eat'|'dark_eat'|'invalid', error: string }
  isValidMove(fromR, fromC, toR, toC, isCannonDarkEatEnabled = true) {
    if (fromR < 0 || fromR >= 4 || fromC < 0 || fromC >= 8) {
      return { valid: false, type: 'invalid', error: '起點超出邊界' };
    }
    if (toR < 0 || toR >= 4 || toC < 0 || toC >= 8) {
      return { valid: false, type: 'invalid', error: '終點超出邊界' };
    }
    if (fromR === toR && fromC === toC) {
      return { valid: false, type: 'invalid', error: '起點與終點相同' };
    }

    const attacker = this.grid[fromR][fromC];
    if (!attacker) {
      return { valid: false, type: 'invalid', error: '起點沒有棋子' };
    }
    if (!attacker.revealed) {
      return { valid: false, type: 'invalid', error: '不能移動未翻開的棋子' };
    }

    const target = this.grid[toR][toC];

    // 如果目標是我方已翻開的棋子，不能移動/吃
    if (target && target.revealed && target.side === attacker.side) {
      return { valid: false, type: 'invalid', error: '不能吃我方棋子' };
    }

    // 距離計算
    const dr = Math.abs(toR - fromR);
    const dc = Math.abs(toC - fromC);

    // 炮 (CANNON) 規則
    if (attacker.type === PIECE_TYPE.CANNON) {
      // 情況 A：單純移動 (終點無子)
      if (!target) {
        // 只能移動相鄰一格
        if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
          return { valid: true, type: 'move' };
        }
        return { valid: false, type: 'invalid', error: '炮一般移動只能走一格' };
      }

      // 情況 B：跳吃 (終點有子，不論是已翻開或未翻開)
      // 必須在同一行或同一列，且中間恰好隔一子
      if (fromR !== toR && fromC !== toC) {
        return { valid: false, type: 'invalid', error: '跳吃必須在同一直線上' };
      }

      let obstacleCount = 0;
      if (fromR === toR) { // 水平跳
        const minC = Math.min(fromC, toC);
        const maxC = Math.max(fromC, toC);
        for (let c = minC + 1; c < maxC; c++) {
          if (this.grid[fromR][c] !== null) obstacleCount++;
        }
      } else { // 垂直跳
        const minR = Math.min(fromR, toR);
        const maxR = Math.max(fromR, toR);
        for (let r = minR + 1; r < maxR; r++) {
          if (this.grid[r][fromC] !== null) obstacleCount++;
        }
      }

      if (obstacleCount === 1) {
        if (!target.revealed) {
          // 炮暗吃判定
          if (this.rules.ruleCannonDarkEat) {
            return { valid: true, type: 'dark_eat' };
          } else {
            return { valid: false, type: 'invalid', error: '規則已關閉炮的暗吃功能' };
          }
        } else {
          // 已翻開的敵方棋子，炮可以直接跳吃
          return { valid: true, type: 'eat' };
        }
      }

      return { valid: false, type: 'invalid', error: '炮跳吃必須且只能隔一子' };
    }

    // 非炮棋子的移動與吃子規則：只能移動到相鄰一格
    const isAdjacent = (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
    if (!isAdjacent) {
      return { valid: false, type: 'invalid', error: '一般棋子只能移動到相鄰格子' };
    }

    if (!target) {
      // 終點無子：直接移動
      return { valid: true, type: 'move' };
    }

    if (target.revealed) {
      // 終點有已翻開的敵方子：檢查是否能吃
      if (this.canEat(attacker, target)) {
        return { valid: true, type: 'eat' };
      }
      return { valid: false, type: 'invalid', error: `${attacker.type} 無法吃 ${target.type}` };
    } else {
      // 終點為未翻開子：若暗吃開啟則為暗吃
      // 這裡暗吃不需要預先知道能否吃，暗吃本身是個合法動作，但大小判定在執行時發生
      return { valid: true, type: 'dark_eat' };
    }
  }

  // 取得某顆棋子的所有合法走步
  getValidMoves(r, c) {
    const moves = [];
    const p = this.grid[r][c];
    if (!p || !p.revealed) return moves;

    // 掃描全棋盤（對炮而言需要直線掃描，對一般子只需相鄰 4 格）
    // 為了效能，一般子只看相鄰 4 格；炮看同行同列
    if (p.type === PIECE_TYPE.CANNON) {
      for (let targetR = 0; targetR < 4; targetR++) {
        const res = this.isValidMove(r, c, targetR, c);
        if (res.valid) moves.push({ from: { r, c }, to: { r: targetR, c }, type: res.type });
      }
      for (let targetC = 0; targetC < 8; targetC++) {
        const res = this.isValidMove(r, c, r, targetC);
        if (res.valid) moves.push({ from: { r, c }, to: { r, c: targetC }, type: res.type });
      }
    } else {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        const targetR = r + dr;
        const targetC = c + dc;
        if (targetR >= 0 && targetR < 4 && targetC >= 0 && targetC < 8) {
          const res = this.isValidMove(r, c, targetR, targetC);
          if (res.valid) moves.push({ from: { r, c }, to: { r: targetR, c: targetC }, type: res.type });
        }
      }
    }
    return moves;
  }

  // 執行移動 / 吃子 / 暗吃 / 翻棋
  // 回傳：{ success: boolean, actionType: 'move'|'eat'|'dark_eat_success'|'dark_eat_fail'|'reveal', revealedPiece: Piece, error: string }
  executeAction(fromR, fromC, toR, toC) {
    const attacker = this.grid[fromR][fromC];
    const target = this.grid[toR][toC];

    const moveRes = this.isValidMove(fromR, fromC, toR, toC);
    if (!moveRes.valid) {
      return { success: false, error: moveRes.error };
    }

    if (moveRes.type === 'move') {
      this.grid[toR][toC] = attacker;
      this.grid[fromR][fromC] = null;
      return { success: true, actionType: 'move' };
    }

    if (moveRes.type === 'eat') {
      const eatenPiece = target.clone();
      this.grid[toR][toC] = attacker;
      this.grid[fromR][fromC] = null;
      return { success: true, actionType: 'eat', revealedPiece: eatenPiece };
    }

    if (moveRes.type === 'dark_eat') {
      const targetReal = target; // 隱藏棋子
      const canEat = this.canEat(attacker, targetReal);
      const eatenPiece = targetReal.clone();
      eatenPiece.revealed = true; // 被吃時揭露

      if (canEat) {
        // 暗吃成功：吃掉對方，我方移過去
        this.grid[toR][toC] = attacker;
        this.grid[fromR][fromC] = null;
        return { success: true, actionType: 'dark_eat_success', revealedPiece: eatenPiece };
      } else {
        // 暗吃失敗：我方陣亡，對方翻開
        const attackerPiece = attacker.clone();
        this.grid[fromR][fromC] = null;
        targetReal.revealed = true; // 目標翻開
        return { success: true, actionType: 'dark_eat_fail', revealedPiece: targetReal.clone(), attackerPiece };
      }
    }

    return { success: false, error: '未知行動類型' };
  }

  // 翻開棋子
  reveal(r, c) {
    const p = this.grid[r][c];
    if (!p) return { success: false, error: '該位置沒有棋子' };
    if (p.revealed) return { success: false, error: '棋子已翻開' };
    p.revealed = true;
    return { success: true, actionType: 'reveal', revealedPiece: p.clone() };
  }
}
