export const SIDE = {
  RED: 'RED',
  BLACK: 'BLACK'
};

export const PIECE_TYPE = {
  KING: 'KING',        // 帥/將 (7)
  ADVISOR: 'ADVISOR',  // 仕/士 (6)
  MINISTER: 'MINISTER',// 相/象 (5)
  CHARIOT: 'CHARIOT',  // 車/俥 (4)
  HORSE: 'HORSE',      // 馬/傌 (3)
  CANNON: 'CANNON',    // 包/炮 (2)
  SOLDIER: 'SOLDIER'   // 兵/卒 (1)
};

export const PIECE_RANK = {
  [PIECE_TYPE.KING]: 7,
  [PIECE_TYPE.ADVISOR]: 6,
  [PIECE_TYPE.MINISTER]: 5,
  [PIECE_TYPE.CHARIOT]: 4,
  [PIECE_TYPE.HORSE]: 3,
  [PIECE_TYPE.CANNON]: 2,
  [PIECE_TYPE.SOLDIER]: 1
};

export const PIECE_NAMES = {
  [SIDE.RED]: {
    [PIECE_TYPE.KING]: '帥',
    [PIECE_TYPE.ADVISOR]: '仕',
    [PIECE_TYPE.MINISTER]: '相',
    [PIECE_TYPE.CHARIOT]: '俥',
    [PIECE_TYPE.HORSE]: '傌',
    [PIECE_TYPE.CANNON]: '炮',
    [PIECE_TYPE.SOLDIER]: '兵'
  },
  [SIDE.BLACK]: {
    [PIECE_TYPE.KING]: '將',
    [PIECE_TYPE.ADVISOR]: '士',
    [PIECE_TYPE.MINISTER]: '象',
    [PIECE_TYPE.CHARIOT]: '車',
    [PIECE_TYPE.HORSE]: '馬',
    [PIECE_TYPE.CANNON]: '包',
    [PIECE_TYPE.SOLDIER]: '卒'
  }
};

export const INITIAL_PIECE_COUNTS = {
  [PIECE_TYPE.KING]: 1,
  [PIECE_TYPE.ADVISOR]: 2,
  [PIECE_TYPE.MINISTER]: 2,
  [PIECE_TYPE.CHARIOT]: 2,
  [PIECE_TYPE.HORSE]: 2,
  [PIECE_TYPE.CANNON]: 2,
  [PIECE_TYPE.SOLDIER]: 5
};
