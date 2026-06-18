const baseConfig = require("./app.json");

const kakaoNativeAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;

const plugins = [...(baseConfig.expo.plugins || [])];

if (kakaoNativeAppKey) {
  plugins.push([
    "@react-native-seoul/kakao-login",
    {
      kakaoAppKey: kakaoNativeAppKey
    }
  ]);
}

module.exports = {
  expo: {
    ...baseConfig.expo,
    plugins,
    extra: {
      ...(baseConfig.expo.extra || {}),
      kakaoNativeAppKeyConfigured: Boolean(kakaoNativeAppKey)
    }
  }
};
