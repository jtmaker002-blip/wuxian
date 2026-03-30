// 国际化初始化 - 支持中英文切换，默认英文
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh-CN.json';
import en from './locales/en.json';

// 读取上次保存的语言偏好，默认英文
const savedLang = localStorage.getItem('lang') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'en': {
        translation: en,
      },
      'zh-CN': {
        translation: zhCN,
      },
    },
    lng: savedLang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React 已经处理 XSS
    },
  });

export default i18n;
