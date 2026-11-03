export type Karat = 'K24' | 'K18' | 'K14' | 'FAKE';
export type TradedKarat = Exclude<Karat, 'FAKE'>;

export interface KaratInfo {
  label: string;
  short: string;
  /** Gold content in parts per 10.000. */
  purity: number;
  /** Colour of the streak left on the touchstone. */
  streak: string;
  streakText: string;
}

export const KARATS: Record<Karat, KaratInfo> = {
  K24: { label: 'Vàng 9999 (24K)', short: '9999', purity: 9999, streak: '#f2b632', streakText: 'Vệt vàng đậm, óng ánh' },
  K18: { label: 'Vàng 18K (75%)', short: '18K', purity: 7500, streak: '#e3bf5f', streakText: 'Vệt vàng nhạt hơn' },
  K14: { label: 'Vàng 14K (58,5%)', short: '14K', purity: 5850, streak: '#d4a86a', streakText: 'Vệt vàng nhạt, hơi ánh đỏ' },
  FAKE: { label: 'Không đạt (mạ vàng)', short: 'Không đạt', purity: 0, streak: '#c9b27a', streakText: 'Vệt sáng nhưng xỉn rất nhanh' },
};

export const TRADED_KARATS: TradedKarat[] = ['K24', 'K18', 'K14'];
export const ALL_KARATS: Karat[] = ['K24', 'K18', 'K14', 'FAKE'];
