import { CellInterest } from '../types';

export function calcAttentionScore(interest: CellInterest | undefined): number {
  if (!interest) return 0;
  const chatScore = Math.log(1 + interest.chatCount);
  let recencyBoost = 0;
  if (interest.lastChattedAt) {
    const daysSince = (Date.now() - new Date(interest.lastChattedAt).getTime()) / (1000 * 60 * 60 * 24);
    recencyBoost = Math.max(0, 2 - daysSince * 0.2); // decays over ~10 days
  }
  return chatScore + recencyBoost + (interest.star ? 1 : 0);
}

export function scoreToColor(score: number): string {
  if (score <= 0) return 'transparent';
  const alpha = Math.min(0.5, score * 0.1);
  return `rgba(59, 130, 246, ${alpha})`;
}
