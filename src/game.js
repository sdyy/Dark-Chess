import { Board } from './board.js';
import { SIDE, PIECE_TYPE, PIECE_NAMES } from './constants.js';

export class Game {
  constructor(rules, aiDifficulty = 'Hard') {
    this.gameId = Math.random(); // 唯一局數識別碼，防非同步競態衝突
    this.rules = rules;
    this.aiDifficulty = aiDifficulty;
    this.board = new Board(rules);
    
    // 遊戲狀態
    this.playerSide = null; // 玩家的陣營 (RED 或 BLACK)，第一步翻棋後決定
    this.aiSide = null;
    this.currentTurn = null; // 當前回合陣營。若尚未翻棋，則為 playerSide 或 null
    this.winner = null;
    this.isGameOver = false;
    
    // 陣亡棋子列表，用於側邊欄墓碑區
    this.capturedPieces = {
      [SIDE.RED]: [],
      [SIDE.BLACK]: []
    };

    this.logs = [];
    this.history = []; // 悔棋堆疊
    this.moveRecord = []; // 用於判定長打的最近移動紀錄
  }

  start() {
    this.gameId = Math.random(); // 每次開始對局重新生成識別碼
    this.board.initialize();
    this.playerSide = null;
    this.aiSide = null;
    this.currentTurn = null; // 誰先翻棋，誰的回合。預設玩家先動
    this.winner = null;
    this.isGameOver = false;
    this.capturedPieces = {
      [SIDE.RED]: [],
      [SIDE.BLACK]: []
    };
    this.logs = ['對局開始！請點擊任意覆蓋棋子進行第一步翻棋。'];
    this.history = [];
    this.moveRecord = [];
  }

  // 儲存狀態，以便悔棋
  saveState() {
    const state = {
      board: this.board.clone(),
      playerSide: this.playerSide,
      aiSide: this.aiSide,
      currentTurn: this.currentTurn,
      winner: this.winner,
      isGameOver: this.isGameOver,
      capturedPieces: {
        [SIDE.RED]: [...this.capturedPieces[SIDE.RED]],
        [SIDE.BLACK]: [...this.capturedPieces[SIDE.BLACK]]
      },
      logs: [...this.logs],
      moveRecord: JSON.parse(JSON.stringify(this.moveRecord))
    };
    this.history.push(state);
  }

  // 悔棋
  undo() {
    if (this.history.length === 0) return false;
    
    // 如果是與 AI 對戰，我們應該悔棋「兩步」（回到玩家上一次動作前），除非是第一步
    let targetState = null;
    
    // 如果有 AI 在玩，且歷史記錄夠多，回滾兩次
    if (this.aiSide !== null && this.history.length >= 2) {
      this.history.pop(); // 彈出 AI 的那一步
      targetState = this.history.pop(); // 彈出玩家的那一步
    } else {
      targetState = this.history.pop();
    }

    if (!targetState) return false;

    this.board = targetState.board;
    this.playerSide = targetState.playerSide;
    this.aiSide = targetState.aiSide;
    this.currentTurn = targetState.currentTurn;
    this.winner = targetState.winner;
    this.isGameOver = targetState.isGameOver;
    this.capturedPieces = targetState.capturedPieces;
    this.logs = targetState.logs;
    this.moveRecord = targetState.moveRecord;
    
    return true;
  }

  // 檢查是否違反長打 (重複步) 規則
  // 長打指：同一個玩家連續使用同一個棋子在兩個格子間往返 3 次 (A -> B -> A -> B -> A -> B)
  isRepeatedMove(playerSide, fromR, fromC, toR, toC) {
    if (!this.rules.ruleNoRepeatedMoves) return false;

    // 篩選出該玩家的最近移動
    const playerMoves = this.moveRecord.filter(m => m.side === playerSide && m.action === 'move');
    if (playerMoves.length < 2) return false;

    // 我們需要看最近兩次移動是否是 to->from, from->to
    // 若當前要走 from->to，且前一次是 to->from，再前一次是 from->to...
    const m1 = playerMoves[playerMoves.length - 1]; // 最近一次
    const m2 = playerMoves[playerMoves.length - 2]; // 上上次

    // 檢查是否是往返
    const isLoop = (
      m1.from.r === toR && m1.from.c === toC && m1.to.r === fromR && m1.to.c === fromC &&
      m2.from.r === fromR && m2.from.c === fromC && m2.to.r === toR && m2.to.c === toC
    );

    if (isLoop) {
      // 這裡表示已經有了一次往返 A->B, B->A。
      // 若再走 A->B 就是第 2 次循環。若限制更嚴格（禁止連續長追）：
      // 如果再看前幾步，如果已經連續循環了兩次，第三次就禁止。
      if (playerMoves.length >= 4) {
        const m3 = playerMoves[playerMoves.length - 3];
        const m4 = playerMoves[playerMoves.length - 4];
        
        const doubleLoop = (
          m3.from.r === toR && m3.from.c === toC && m3.to.r === fromR && m3.to.c === fromC &&
          m4.from.r === fromR && m4.from.c === fromC && m4.to.r === toR && m4.to.c === toC
        );

        if (doubleLoop) {
          // 已走 A->B, B->A, A->B, B->A，禁止第三次 A->B
          return true;
        }
      }
    }

    return false;
  }

  // 執行玩家動作 (翻棋)
  playerReveal(r, c) {
    if (this.isGameOver) return { success: false, error: '遊戲已結束' };
    if (this.currentTurn && this.currentTurn !== this.playerSide && this.playerSide !== null) {
      return { success: false, error: '現在是 AI 的回合' };
    }

    this.saveState();

    const res = this.board.reveal(r, c);
    if (!res.success) {
      this.history.pop(); // 失敗則撤銷儲存
      return res;
    }

    const revealed = res.revealedPiece;
    const name = PIECE_NAMES[revealed.side][revealed.type];
    const sideName = revealed.side === SIDE.RED ? '紅' : '黑';

    // 第一步翻棋：決定陣營
    if (this.playerSide === null) {
      this.playerSide = revealed.side;
      this.aiSide = revealed.side === SIDE.RED ? SIDE.BLACK : SIDE.RED;
      this.currentTurn = this.playerSide; // 翻完後仍為該陣營的回合（或換手，暗棋通常是翻開後換對手）
      this.logs.push(`第一步翻出【${sideName}方 ${name}】，玩家分配為【${sideName}方】！`);
    } else {
      this.logs.push(`玩家 翻開了 (${r + 1}, ${c + 1}) 的【${sideName} ${name}】。`);
    }

    this.recordMove(this.playerSide, 'reveal', null, { r, c });
    this.switchTurn();
    this.checkGameStatus();

    return { success: true, actionType: 'reveal', revealedPiece: revealed };
  }

  // 執行玩家動作 (移動/吃/暗吃)
  playerMove(fromR, fromC, toR, toC) {
    if (this.isGameOver) return { success: false, error: '遊戲已結束' };
    if (this.currentTurn && this.currentTurn !== this.playerSide) {
      return { success: false, error: '現在是 AI 的回合' };
    }

    const attacker = this.board.getPiece(fromR, fromC);
    if (!attacker || attacker.side !== this.playerSide) {
      return { success: false, error: '只能移動自己的棋子' };
    }

    // 檢查長打重複限制
    const moveRes = this.board.isValidMove(fromR, fromC, toR, toC);
    if (moveRes.valid && moveRes.type === 'move') {
      if (this.isRepeatedMove(this.playerSide, fromR, fromC, toR, toC)) {
        return { success: false, error: '禁止長打（重複往返移動超過限制）' };
      }
    }

    this.saveState();

    const res = this.board.executeAction(fromR, fromC, toR, toC);
    if (!res.success) {
      this.history.pop();
      return res;
    }

    const attName = PIECE_NAMES[attacker.side][attacker.type];
    const attSide = attacker.side === SIDE.RED ? '紅' : '黑';

    if (res.actionType === 'move') {
      this.logs.push(`玩家 移動【${attSide} ${attName}】從 (${fromR+1}, ${fromC+1}) 到 (${toR+1}, ${toC+1})。`);
      this.recordMove(this.playerSide, 'move', { r: fromR, c: fromC }, { r: toR, c: toC });
    } else if (res.actionType === 'eat') {
      const target = res.revealedPiece;
      const tarName = PIECE_NAMES[target.side][target.type];
      const tarSide = target.side === SIDE.RED ? '紅' : '黑';
      this.capturedPieces[target.side].push(target);
      this.logs.push(`玩家 用【${attSide} ${attName}】吃掉了【${tarSide} ${tarName}】。`);
      this.recordMove(this.playerSide, 'eat', { r: fromR, c: fromC }, { r: toR, c: toC }, target);
    } else if (res.actionType === 'dark_eat_success') {
      const target = res.revealedPiece;
      const tarName = PIECE_NAMES[target.side][target.type];
      const tarSide = target.side === SIDE.RED ? '紅' : '黑';
      this.capturedPieces[target.side].push(target);
      this.logs.push(`玩家 用【${attSide} ${attName}】暗吃 (${toR+1}, ${toC+1})，成功吃掉隱藏的【${tarSide} ${tarName}】！`);
      this.recordMove(this.playerSide, 'dark_eat_success', { r: fromR, c: fromC }, { r: toR, c: toC }, target);
    } else if (res.actionType === 'dark_eat_fail') {
      const target = res.revealedPiece; // 翻開後的棋子
      const tarName = PIECE_NAMES[target.side][target.type];
      const tarSide = target.side === SIDE.RED ? '紅' : '黑';
      const deadAttacker = res.attackerPiece;
      this.capturedPieces[deadAttacker.side].push(deadAttacker);

      const isFriendlyFire = deadAttacker.side === target.side;
      if (isFriendlyFire) {
        this.logs.push(`玩家 用【${attSide} ${attName}】暗吃 (${toR+1}, ${toC+1}) 失敗（撞到自己人的【${tarSide} ${tarName}】）！我方【${attSide} ${attName}】陣亡。`);
      } else {
        this.logs.push(`玩家 用【${attSide} ${attName}】暗吃 (${toR+1}, ${toC+1}) 失敗（對方的【${tarSide} ${tarName}】較大）！我方【${attSide} ${attName}】陣亡。`);
      }
      this.recordMove(this.playerSide, 'dark_eat_fail', { r: fromR, c: fromC }, { r: toR, c: toC }, target);
    }

    this.switchTurn();
    this.checkGameStatus();
    return res;
  }

  // 記錄移動日誌
  recordMove(side, action, from, to, targetPiece = null) {
    this.moveRecord.push({
      side,
      action,
      from,
      to,
      targetPiece
    });
    // 保持 moveRecord 長度不超過 20，避免記憶體浪費
    if (this.moveRecord.length > 20) {
      this.moveRecord.shift();
    }
  }

  switchTurn() {
    if (this.currentTurn === SIDE.RED) {
      this.currentTurn = SIDE.BLACK;
    } else if (this.currentTurn === SIDE.BLACK) {
      this.currentTurn = SIDE.RED;
    } else {
      // 尚未決定陣營
      this.currentTurn = null;
    }
  }

  // AI 執行動作
  executeAiAction(action) {
    if (this.isGameOver) return;
    
    // AI 動作用於記錄，我們不需要再次 saveState，因為 AI 的動作會存在與玩家的歷史記錄中
    this.saveState();

    const sideName = this.aiSide === SIDE.RED ? '紅' : '黑';

    if (action.type === 'reveal') {
      const { r, c } = action.to;
      const res = this.board.reveal(r, c);
      const revealed = res.revealedPiece;
      const name = PIECE_NAMES[revealed.side][revealed.type];
      const pieceSideName = revealed.side === SIDE.RED ? '紅' : '黑';
      this.logs.push(`AI 翻開了 (${r + 1}, ${c + 1}) 的【${pieceSideName} ${name}】。`);
      this.recordMove(this.aiSide, 'reveal', null, { r, c });
    } else {
      const { r: fromR, c: fromC } = action.from;
      const { r: toR, c: toC } = action.to;
      const attacker = this.board.getPiece(fromR, fromC);
      const attName = PIECE_NAMES[attacker.side][attacker.type];

      const res = this.board.executeAction(fromR, fromC, toR, toC);

      if (res.actionType === 'move') {
        this.logs.push(`AI 移動【${sideName} ${attName}】從 (${fromR+1}, ${fromC+1}) 到 (${toR+1}, ${toC+1})。`);
        this.recordMove(this.aiSide, 'move', { r: fromR, c: fromC }, { r: toR, c: toC });
      } else if (res.actionType === 'eat') {
        const target = res.revealedPiece;
        const tarName = PIECE_NAMES[target.side][target.type];
        const tarSide = target.side === SIDE.RED ? '紅' : '黑';
        this.capturedPieces[target.side].push(target);
        this.logs.push(`AI 用【${sideName} ${attName}】吃掉了【${tarSide} ${tarName}】。`);
        this.recordMove(this.aiSide, 'eat', { r: fromR, c: fromC }, { r: toR, c: toC }, target);
      } else if (res.actionType === 'dark_eat_success') {
        const target = res.revealedPiece;
        const tarName = PIECE_NAMES[target.side][target.type];
        const tarSide = target.side === SIDE.RED ? '紅' : '黑';
        this.capturedPieces[target.side].push(target);
        this.logs.push(`AI 用【${sideName} ${attName}】暗吃 (${toR+1}, ${toC+1})，成功吃掉隱藏的【${tarSide} ${tarName}】！`);
        this.recordMove(this.aiSide, 'dark_eat_success', { r: fromR, c: fromC }, { r: toR, c: toC }, target);
      } else if (res.actionType === 'dark_eat_fail') {
        const target = res.revealedPiece;
        const tarName = PIECE_NAMES[target.side][target.type];
        const tarSide = target.side === SIDE.RED ? '紅' : '黑';
        const deadAttacker = res.attackerPiece;
        this.capturedPieces[deadAttacker.side].push(deadAttacker);

        const isFriendlyFire = deadAttacker.side === target.side;
        if (isFriendlyFire) {
          this.logs.push(`AI 用【${sideName} ${attName}】暗吃 (${toR+1}, ${toC+1}) 失敗（撞到自己人的【${tarSide} ${tarName}】）！AI【${sideName} ${attName}】陣亡。`);
        } else {
          this.logs.push(`AI 用【${sideName} ${attName}】暗吃 (${toR+1}, ${toC+1}) 失敗（對方的【${tarSide} ${tarName}】較大）！AI【${sideName} ${attName}】陣亡。`);
        }
        this.recordMove(this.aiSide, 'dark_eat_fail', { r: fromR, c: fromC }, { r: toR, c: toC }, target);
      }
    }

    this.switchTurn();
    this.checkGameStatus();
  }

  // 判斷遊戲是否結束
  checkGameStatus() {
    // 檢查是否有棋子或可行步
    // 紅黑雙方在棋盤上是否還有棋子
    let redAlive = 0;
    let blackAlive = 0;
    let redMoves = 0;
    let blackMoves = 0;

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board.grid[r][c];
        if (p) {
          if (p.side === SIDE.RED) redAlive++;
          else blackAlive++;

          // 如果棋子已翻開，計算其可行步
          if (p.revealed) {
            const moves = this.board.getValidMoves(r, c);
            if (p.side === SIDE.RED) redMoves += moves.length;
            else blackMoves += moves.length;
          } else {
            // 未翻開的棋子可以被翻開，這也算是一個可行動作
            // 只要場上有未翻開棋子，擁有它的玩家（或任何玩家）就還有翻牌的動作
            if (p.side === SIDE.RED) redMoves++;
            else blackMoves++;
          }
        }
      }
    }

    // 當某方沒有任何棋子活著
    if (this.playerSide !== null) {
      if (redAlive === 0) {
        this.winner = SIDE.BLACK;
        this.isGameOver = true;
        this.logs.push('黑方勝利！紅方所有棋子已被消滅。');
        return;
      }
      if (blackAlive === 0) {
        this.winner = SIDE.RED;
        this.isGameOver = true;
        this.logs.push('紅方勝利！黑方所有棋子已被消滅。');
        return;
      }

      // 檢查目前回合方是否還有可行步
      // 僅在已分配顏色的情況下判斷
      if (this.currentTurn === SIDE.RED && redMoves === 0) {
        this.winner = SIDE.BLACK;
        this.isGameOver = true;
        this.logs.push('黑方勝利！紅方已無可行棋步（無路可走）。');
        return;
      }
      if (this.currentTurn === SIDE.BLACK && blackMoves === 0) {
        this.winner = SIDE.RED;
        this.isGameOver = true;
        this.logs.push('紅方勝利！黑方已無可行棋步（無路可走）。');
        return;
      }
    }
  }
}
