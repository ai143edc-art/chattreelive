export interface PhoneModel { name: string; w: number; h: number; }

export interface Wallpaper { name: string; css: string; }
export const WALLPAPERS: Wallpaper[] = [
  { name: 'Default', css: '' },
  { name: 'Cream', css: '#efeae2' },
  { name: 'Soft Green', css: 'linear-gradient(160deg,#dff3ea,#c9e9dd)' },
  { name: 'Sky', css: 'linear-gradient(160deg,#e3f0fb,#cfe3f5)' },
  { name: 'Sunset', css: 'linear-gradient(160deg,#ffe8d6,#ffd0c4)' },
  { name: 'Dark Navy', css: 'linear-gradient(160deg,#0b141a,#101f27)' },
  { name: 'Purple', css: 'linear-gradient(160deg,#2b1a3d,#3d2360)' },
];

export const MODELS: PhoneModel[] = [
  { name: "iPhone SE (2nd/3rd)", w: 375, h: 667 },
  { name: "iPhone 8", w: 375, h: 667 },
  { name: "iPhone 11 / XR", w: 414, h: 896 },
  { name: "iPhone 12 / 13 / 14", w: 390, h: 844 },
  { name: "iPhone 13 mini", w: 375, h: 812 },
  { name: "iPhone 15 / 16", w: 393, h: 852 },
  { name: "iPhone 15 Pro Max / 16 Pro Max", w: 430, h: 932 },
  { name: "Samsung Galaxy S8 / S9", w: 360, h: 740 },
  { name: "Samsung Galaxy S10", w: 360, h: 760 },
  { name: "Samsung Galaxy S20 / S21", w: 360, h: 800 },
  { name: "Samsung Galaxy S22 Ultra", w: 384, h: 854 },
  { name: "Samsung Galaxy S23 / S24", w: 360, h: 780 },
  { name: "Samsung Galaxy A / M series", w: 412, h: 915 },
  { name: "Google Pixel 5", w: 393, h: 851 },
  { name: "Google Pixel 7 / 8", w: 412, h: 915 },
  { name: "OnePlus 9 / 10 / 11", w: 412, h: 919 },
  { name: "Xiaomi Redmi Note", w: 393, h: 873 },
  { name: "Realme / Oppo (common)", w: 360, h: 800 },
  { name: "Vivo (common)", w: 392, h: 850 },
  { name: "Vivo V40e", w: 393, h: 870 },
  { name: "Vivo V29 / V30", w: 393, h: 873 },
  { name: "Vivo Y series", w: 390, h: 844 },
  { name: "iQOO Z9 / Neo", w: 393, h: 873 },
  { name: "Motorola Edge 50", w: 393, h: 873 },
  { name: "Nothing Phone (2a)", w: 387, h: 862 },
  { name: "Poco X6 / Redmi Note 13", w: 393, h: 873 },
  { name: "Samsung Galaxy F / M series", w: 385, h: 854 },
  { name: "iPad (portrait)", w: 768, h: 1024 },
  { name: "Desktop wide", w: 900, h: 820 },
];
