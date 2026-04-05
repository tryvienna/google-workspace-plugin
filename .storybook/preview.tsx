import type { Preview, Decorator } from '@storybook/react';
import React from 'react';

// Import Vienna UI styles (design tokens, Tailwind, theme system)
import '@tryvienna/ui/styles.css';
// Import Google Docs viewer styles
import '../src/docs/styles/docs-viewer.css';

const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme || 'dark';

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light', 'theme-vscode');

    if (theme === 'vscode') {
      root.classList.add('dark', 'theme-vscode');
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return (
    <div
      style={{
        backgroundColor: 'var(--surface-page)',
        color: 'var(--text-primary)',
        padding: '32px',
        minHeight: '100vh',
      }}
    >
      <Story />
    </div>
  );
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'dark', title: 'Dark' },
          { value: 'light', title: 'Light' },
          { value: 'vscode', title: 'VS Code Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'dark',
  },
  decorators: [withTheme],
  parameters: {
    layout: 'padded',
    backgrounds: { disable: true },
  },
};

export default preview;
