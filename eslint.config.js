const globals = require("globals");

/*
 * The API had no linter at all, so an import left behind by a refactor sat
 * there until someone noticed by eye. These rules are the ones that answer a
 * question a person cannot reliably answer by reading: is this binding still
 * used, and does this name exist?
 */
module.exports = [
  {
    ignores: ["node_modules/**", "backups/**", ".vercel/**", "coverage/**"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // An unused require is the usual leftover of a refactor. Arguments are
      // exempt when prefixed with _, which is how Express handlers keep the
      // four-argument shape that marks them as error middleware.
      "no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-undef": "error",
      // A promise nobody waits on loses its rejection, which in a route means
      // a request that never answers.
      "require-atomic-updates": "off",
      "no-constant-condition": ["error", { checkLoops: false }],
    },
  },
  {
    // The test runner's globals plus a longer leash on unused fixtures.
    files: ["test/**/*.js", "test-helpers/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
