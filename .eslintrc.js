const restrictedGlobals = require("eslint-restricted-globals")

module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
  ],
  parserOptions: {
      "ecmaVersion": 6,
      "sourceType": "module",
      "ecmaFeatures": {
        "jsx": true
      }
  },
  plugins: ["prettier", "react", "node"],
  rules: {
    "array-callback-return": "error",
    curly: "error",
    eqeqeq: [
      "error",
      "always",
      {
        null: "ignore",
      },
    ],
    "for-direction": "error",
    "getter-return": "error",
    "guard-for-in": "error",
    "handle-callback-err": "error",
    "object-curly-spacing": ["error", "never"],
    "no-extra-bind": "error",
    "no-console": "off",
    "prefer-const": "error",
    "no-var": "error",
    "no-duplicate-imports": "error",
    "no-eval": "error",
    "no-extend-native": "error",
    "no-implied-eval": "error",
    "no-invalid-this": "error",
    "no-labels": "error",
    "no-path-concat": "error",
    "no-restricted-globals": ["error"].concat(restrictedGlobals),
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "no-useless-computed-key": "error",
    "prettier/prettier": ["error", {"jsxBracketSameLine": true}],
    quotes: ["error", "single", { avoidEscape: true }],
    "react/display-name": "off",
    "react/prop-types": "off",
    "unicode-bom": "error",
    "linebreak-style": [
      "error",
      "unix"
    ]
  },
}