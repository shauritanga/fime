import { Linking } from 'react-native';

export const privacyPolicyUrl = 'https://fime-api.zanua.co.tz/privacy';

export function openPrivacyPolicy() {
  return Linking.openURL(privacyPolicyUrl).catch((error) => console.warn('Unable to open the privacy policy', error));
}
