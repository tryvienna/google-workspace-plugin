import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { SuggestionsPanel } from '../docs/suggestions/SuggestionsPanel';
import { mockSuggestions } from './mock-data';

const meta = {
  title: 'Suggestions/SuggestionsPanel',
  component: SuggestionsPanel,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: {
    onAccept: fn(),
    onReject: fn(),
    onAcceptAll: fn(),
    onRejectAll: fn(),
    onClear: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480 }} className="border border-border rounded-lg overflow-hidden bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SuggestionsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    suggestions: mockSuggestions,
    processingIds: new Set(),
    isProcessingAll: false,
  },
};

export const SingleSuggestion: Story = {
  args: {
    suggestions: [mockSuggestions[0]],
    processingIds: new Set(),
    isProcessingAll: false,
  },
};

export const ProcessingOne: Story = {
  name: 'Processing One Suggestion',
  args: {
    suggestions: mockSuggestions,
    processingIds: new Set(['sug_1']),
    isProcessingAll: false,
  },
};

export const ProcessingAll: Story = {
  name: 'Processing All (Bulk Accept)',
  args: {
    suggestions: mockSuggestions,
    processingIds: new Set(),
    isProcessingAll: true,
  },
};

export const Empty: Story = {
  name: 'No Suggestions',
  args: {
    suggestions: [],
    processingIds: new Set(),
    isProcessingAll: false,
  },
};
