module.exports = {
    "env": {
        "browser": true,
        "es2021": true
    },
    "extends": "eslint:recommended",
    "overrides": [
    ],
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "rules": {
        "no-unused-vars": [
            "error", { "argsIgnorePattern": "^_" }
        ],
        "no-irregular-whitespace": [
            "error", { 
                "skipTemplates": true ,
                "skipStrings": true
            }
        ]
    }
}
