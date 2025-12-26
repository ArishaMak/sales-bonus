// файл: src/main.js  (НОВЫЙ, для тестов)

import {
  calculateSimpleRevenue,
  analyzeSalesData,
} from '../frontend/src/main.js'; // путь подправь под свою структуру

// tests ждут calculateBonusByProfit, а у тебя сейчас calculateBonusByRevenue
function calculateBonusByProfit(index, total, seller) {
  return calculateBonusByRevenue(index, total, seller);
}

// если calculateBonusByRevenue тоже нужно импортировать:
import { /* ... */ } from '../frontend/src/main.js';

export {
  calculateSimpleRevenue,
  calculateBonusByProfit,
  analyzeSalesData,
};
