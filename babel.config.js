module.exports = {
  presets: ["module:@react-native/babel-preset"],
  plugins: [
    [
      "@babel/plugin-proposal-decorators",
      {
        legacy: true,
      },
    ],
    [
      "module-resolver",
      {
        root: ["./"],
        extensions: [
          ".ios.ts",
          ".android.ts",
          ".ts",
          ".ios.tsx",
          ".android.tsx",
          ".tsx",
          ".js",
          ".jsx",
          ".json",
        ],
        alias: {
          src: "./src",
          "@app": "./src/app",
          "@core": "./src/core",
          "@shared": "./src/shared",
          "@features": "./src/application/features",
          "@application": "./src/application",
          "@services": "./src/services",
          "@database": "./src/database",
          "@infrastructure": "./src/infrastructure",
          "@assets": "./src/assets",
        },
      },
    ],
  ],
  env: {
    production: {
      plugins: ["react-native-paper/babel"],
    },
  },
};
