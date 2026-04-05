import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { useState } from 'react';
import { SuggestionCard } from '../docs/suggestions/SuggestionCard';
import { singleSuggestion, multiPartSuggestion, mockSuggestions } from './mock-data';

const meta = {
  title: 'Suggestions/SuggestionCard',
  component: SuggestionCard,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    onAccept: fn(),
    onReject: fn(),
    onToggle: fn(),
    expanded: false,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 440 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SuggestionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  args: { suggestion: singleSuggestion, isProcessing: false, expanded: false },
};

export const Expanded: Story = {
  args: { suggestion: singleSuggestion, isProcessing: false, expanded: true },
};

export const Processing: Story = {
  args: { suggestion: singleSuggestion, isProcessing: true, expanded: true },
};

export const Deletion: Story = {
  name: 'Delete Suggestion',
  args: { suggestion: mockSuggestions[2], isProcessing: false, expanded: true },
};

export const MultiPart: Story = {
  name: 'Multi-Part',
  args: { suggestion: multiPartSuggestion, isProcessing: false, expanded: true },
};

function InteractiveList() {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-0.5">
      {mockSuggestions.map((s) => (
        <SuggestionCard
          key={s.id}
          suggestion={s}
          isProcessing={false}
          expanded={expandedIds.has(s.id)}
          onToggle={toggle}
          onAccept={fn()}
          onReject={fn()}
        />
      ))}
    </div>
  );
}

export const AllVariants: Story = {
  name: 'Interactive List',
  args: { suggestion: mockSuggestions[0], isProcessing: false },
  render: () => <InteractiveList />,
};
