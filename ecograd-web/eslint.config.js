// Varredura estática de acessibilidade (WCAG) dos componentes React.
// Só as regras do `jsx-a11y`: o projeto não adota um lint geral, e misturar as
// duas coisas afogaria as violações de acessibilidade em avisos de estilo.
// Uso: npm run lint:a11y
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const recomendado = jsxA11y.flatConfigs.recommended.rules;

export default [
  { ignores: ['dist/**', 'node_modules/**', 'bundle-report/**', 'perf-report/**'] },
  {
    files: ['src/**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'jsx-a11y': jsxA11y },
    // Diretivas `eslint-disable` de outros plugins (que não estão carregados aqui) não são erro.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      // O conjunto mais rigoroso do plugin...
      ...jsxA11y.flatConfigs.strict.rules,
      // ...com o `Select` do projeto declarado como controle: ele renderiza o
      // gatilho do Radix, um <button>, e o <label> que o envolve fica associado.
      'jsx-a11y/label-has-associated-control': ['error', { controlComponents: ['Select'], depth: 3 }],
      // Padrões do ARIA APG que o `strict` não distingue — listbox/option em
      // <ul>/<li> no combobox, Escape num diálogo. Valem as exceções do próprio
      // conjunto `recommended` do plugin, copiadas dele sem alteração.
      'jsx-a11y/no-noninteractive-element-to-interactive-role': recomendado['jsx-a11y/no-noninteractive-element-to-interactive-role'],
      'jsx-a11y/no-noninteractive-element-interactions': recomendado['jsx-a11y/no-noninteractive-element-interactions'],
      // Região rolável precisa receber foco para ser lida e rolada pelo teclado
      // (WCAG 2.1.1) — é o que a regra `scrollable-region-focusable` do axe exige.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { tags: [], roles: ['tabpanel', 'region'], allowExpressionValues: true }],
    },
  },
];
