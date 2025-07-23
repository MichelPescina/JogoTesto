module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        // Node.js globals
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        global: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        
        // Browser globals for client-side code
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        location: "readonly",
        io: "readonly"
      }
    },
    rules: {
      // Possible Errors
      "no-console": "off", // Allow console in game development
      "no-debugger": "error",
      "no-dupe-args": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-empty": "error",
      "no-extra-boolean-cast": "error",
      "no-extra-semi": "error",
      "no-func-assign": "error",
      "no-inner-declarations": "error",
      "no-invalid-regexp": "error",
      "no-irregular-whitespace": "error",
      "no-obj-calls": "error",
      "no-sparse-arrays": "error",
      "no-unreachable": "error",
      "use-isnan": "error",
      "valid-typeof": "error",

      // Best Practices
      "curly": "error",
      "eqeqeq": ["error", "always"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-with": "error",
      "radix": "error",
      "wrap-iife": "error",
      "no-unused-vars": ["error", { "args": "none" }],

      // Stylistic Issues
      "indent": ["error", 2],
      "quotes": ["error", "single", { "avoidEscape": true }],
      "semi": ["error", "always"],
      "comma-trailing": "off",
      "no-mixed-spaces-and-tabs": "error",
      "no-multiple-empty-lines": ["error", { "max": 2 }],
      "no-trailing-spaces": "error",
      "space-before-blocks": "error",
      "space-infix-ops": "error",
      "keyword-spacing": "error"
    }
  }
];