import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from './MessageList';
import type { ChatMessage } from '@opencode/shared';

describe('MessageList', () => {
  const baseMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hello, can you help me?',
      timestamp: new Date('2024-01-01T12:00:00'),
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'Sure, I can help!',
      timestamp: new Date('2024-01-01T12:00:01'),
    },
  ];

  it('renders empty state when no messages', () => {
    render(
      <MessageList
        messages={[]}
        streamingContent=""
        streamingPhases={[]}
        isStreaming={false}
      />
    );

    expect(screen.getByText('Welcome to OpenCode')).toBeTruthy();
  });

  it('renders user and assistant messages', () => {
    render(
      <MessageList
        messages={baseMessages}
        streamingContent=""
        streamingPhases={[]}
        isStreaming={false}
      />
    );

    expect(screen.getByText('Hello, can you help me?')).toBeTruthy();
    expect(screen.getByText('Sure, I can help!')).toBeTruthy();
  });

  it('renders streaming content', () => {
    render(
      <MessageList
        messages={baseMessages}
        streamingContent="Streaming text..."
        streamingPhases={[]}
        isStreaming={true}
      />
    );

    expect(screen.getByText('Streaming text...')).toBeTruthy();
    // Check for the streaming indicator with the bullet point
    expect(screen.getByText(/• Streaming/)).toBeTruthy();
  });

  it('renders streaming phases when available', () => {
    const streamingPhases = [
      {
        type: 'thought' as const,
        id: 'thought-1',
        content: 'Thinking about this...',
        timestamp: new Date('2024-01-01T12:00:02'),
        isExpanded: false,
      },
      {
        type: 'tool_call' as const,
        id: 'tool-1',
        toolCallId: 'call-1',
        toolName: 'read_file',
        arguments: { path: '/test.txt' },
        status: 'completed' as const,
        timestamp: new Date('2024-01-01T12:00:03'),
      },
    ];

    render(
      <MessageList
        messages={baseMessages}
        streamingContent=""
        streamingPhases={streamingPhases}
        isStreaming={true}
      />
    );

    expect(screen.getByText('Thinking')).toBeTruthy();
    expect(screen.getByText('read_file')).toBeTruthy();
  });

  it('renders assistant message with phases', () => {
    const messagesWithPhases: ChatMessage[] = [
      {
        id: 'msg-3',
        role: 'assistant',
        content: 'Here is the answer',
        timestamp: new Date('2024-01-01T12:00:00'),
        phases: [
          {
            type: 'thought' as const,
            id: 'thought-1',
            content: 'Let me analyze this',
            timestamp: new Date('2024-01-01T12:00:00'),
            isExpanded: false,
          },
          {
            type: 'response' as const,
            id: 'response-1',
            content: 'Here is the answer',
            timestamp: new Date('2024-01-01T12:00:01'),
          },
        ],
      },
    ];

    render(
      <MessageList
        messages={messagesWithPhases}
        streamingContent=""
        streamingPhases={[]}
        isStreaming={false}
      />
    );

    expect(screen.getByText('Thinking')).toBeTruthy();
    expect(screen.getByText('Here is the answer')).toBeTruthy();
  });

  it('shows typing indicator when streaming with no content', () => {
    render(
      <MessageList
        messages={baseMessages}
        streamingContent=""
        streamingPhases={[]}
        isStreaming={true}
      />
    );

    // Typing indicator should have animated dots
    const dots = document.querySelectorAll('.animate-bounce');
    expect(dots.length).toBe(3);
  });

  it('renders system messages with error styling', () => {
    const messagesWithError: ChatMessage[] = [
      {
        id: 'msg-error',
        role: 'system',
        content: 'Something went wrong',
        timestamp: new Date('2024-01-01T12:00:00'),
      },
    ];

    render(
      <MessageList
        messages={messagesWithError}
        streamingContent=""
        streamingPhases={[]}
        isStreaming={false}
      />
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('filters out invalid messages', () => {
    const messagesWithInvalid = [
      ...baseMessages,
      null as unknown as ChatMessage,
      { invalid: 'data' } as unknown as ChatMessage,
    ];

    render(
      <MessageList
        messages={messagesWithInvalid}
        streamingContent=""
        streamingPhases={[]}
        isStreaming={false}
      />
    );

    // Should still render valid messages
    expect(screen.getByText('Hello, can you help me?')).toBeTruthy();
    expect(screen.getByText('Sure, I can help!')).toBeTruthy();
  });

  it('renders user message with agent mode badge', () => {
    const messageWithMode: ChatMessage[] = [
      {
        id: 'msg-mode',
        role: 'user',
        content: 'Plan this out',
        timestamp: new Date('2024-01-01T12:00:00'),
        agentMode: 'plan',
      },
    ];

    render(
      <MessageList
        messages={messageWithMode}
        streamingContent=""
        streamingPhases={[]}
        isStreaming={false}
      />
    );

    expect(screen.getByText('Plan Mode')).toBeTruthy();
  });
});
