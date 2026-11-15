/**
 * Entry point for React Native bundler.
 * This bridges to the TypeScript entry point.
 */
import { I18nManager } from 'react-native';

// تفعيل RTL على مستوى التطبيق
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

require('./index.ts');
