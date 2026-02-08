import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhaseBubble } from './PhaseBubble';
import type { ThoughtPhase, ToolCallPhase, ResponsePhase } from '@opencode/shared';

// Mock crypto.randomUUID for consistent testing
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-uuid-123'),
});

describe('PhaseBubble', () => {
  describe('ThoughtPhase', () => {
    const thoughtPhase: ThoughtPhase = {
      type: 'thought',
      id: 'thought-1',
      content: 'I need to analyze this problem step by step. First, I should understand what is being asked...',
      timestamp: new Date('2024-01-01T12:00:00'),
      isExpanded: false,
    };

    it('renders thought phase with collapsed content', () => {
      render(<PhaseBubble phase={thoughtPhase} />);

      expect(screen.getByText('Thinking')).toBeTruthy();
      expect(screen.getByText(/12:00:00/)).toBeTruthy();
      // Content should not be in the document when collapsed
      expect(screen.queryByText(/I need to analyze/)).toBeNull();
    });

    it('expands thought content when clicked', () => {
      render(<PhaseBubble phase={thoughtPhase} />);

      const button = screen.getByText('Thinking').closest('button');
      expect(button).toBeTruthy();

      if (button) {
        fireEvent.click(button);
        expect(screen.getByText(/I need to analyze this problem/)).toBeTruthy();
      }
    });

    it('shows "Show more" button for long content', () => {
      const longThought: ThoughtPhase = {
        ...thoughtPhase,
        content: 'a'.repeat(600), // Longer than 500 chars
      };

      render(<PhaseBubble phase={longThought} />);

      // First expand the thought
      const button = screen.getByText('Thinking').closest('button');
      if (button) {
        fireEvent.click(button);
        expect(screen.getByText('Show more')).toBeTruthy();
      }
    });

    it('toggles between show more and show less', () => {
      const longThought: ThoughtPhase = {
        ...thoughtPhase,
        content: 'a'.repeat(600),
      };

      render(<PhaseBubble phase={longThought} />);

      const button = screen.getByText('Thinking').closest('button');
      if (button) {
        fireEvent.click(button);
        const showMoreButton = screen.getByText('Show more');
        fireEvent.click(showMoreButton);
        expect(screen.getByText('Show less')).toBeTruthy();
      }
    });
  });

  describe('ToolCallPhase', () => {
    const toolPhase: ToolCallPhase = {
      type: 'tool_call',
      id: 'tool-1',
      toolCallId: 'call-123',
      toolName: 'read_file',
      arguments: { path: '/test/file.txt' },
      status: 'executing',
      timestamp: new Date('2024-01-01T12:00:00'),
    };

    it('renders tool call with name and status', () => {
      render(<PhaseBubble phase={toolPhase} />);

      expect(screen.getByText('read_file')).toBeTruthy();
      expect(screen.getByText('Running...')).toBeTruthy();
    });

    it('shows completed status correctly', () => {
      const completedTool: ToolCallPhase = {
        ...toolPhase,
        status: 'completed',
        output: 'File contents here',
      };

      render(<PhaseBubble phase={completedTool} />);

      expect(screen.getByText('Completed')).toBeTruthy();
    });

    it('shows error status correctly', () => {
      const errorTool: ToolCallPhase = {
        ...toolPhase,
        status: 'error',
        error: 'File not found',
      };

      render(<PhaseBubble phase={errorTool} />);

      expect(screen.getByText('Error')).toBeTruthy();
    });

    it('shows arguments when toggled', () => {
      render(<PhaseBubble phase={toolPhase} />);

      // Initially arguments should not be visible
      expect(screen.queryByText(/"path": "\/test\/file.txt"/)).toBeNull();

      const showArgsButton = screen.getByText('Show arguments');
      fireEvent.click(showArgsButton);

      expect(screen.getByText(/"path": "\/test\/file.txt"/)).toBeTruthy();
    });

    it('shows output when tool is completed and toggled', () => {
      const completedTool: ToolCallPhase = {
        ...toolPhase,
        status: 'completed',
        output: 'File contents: Hello World',
      };

      render(<PhaseBubble phase={completedTool} />);

      const showOutputButton = screen.getByText('Show output');
      fireEvent.click(showOutputButton);

      expect(screen.getByText('File contents: Hello World')).toBeTruthy();
    });

    it('shows error output when tool has error', () => {
      const errorTool: ToolCallPhase = {
        ...toolPhase,
        status: 'error',
        error: 'Permission denied',
      };

      render(<PhaseBubble phase={errorTool} />);

      const showOutputButton = screen.getByText('Show output');
      fireEvent.click(showOutputButton);

      expect(screen.getByText('Permission denied')).toBeTruthy();
    });

    it('hides arguments section when tool has no arguments', () => {
      const toolNoArgs: ToolCallPhase = {
        ...toolPhase,
        arguments: {},
      };

      render(<PhaseBubble phase={toolNoArgs} />);

      expect(screen.queryByText('Show arguments')).toBeNull();
    });
  });

  describe('ResponsePhase', () => {
    const responsePhase: ResponsePhase = {
      type: 'response',
      id: 'response-1',
      content: 'Here is my response to your question about testing.',
      timestamp: new Date('2024-01-01T12:00:00'),
    };

    it('renders response content', () => {
      render(<PhaseBubble phase={responsePhase} />);

      expect(screen.getByText('Here is my response to your question about testing.')).toBeTruthy();
      expect(screen.getByText(/12:00:00/)).toBeTruthy();
    });
  });

  describe('Edge cases', () => {
    it('returns null for unknown phase type', () => {
      const unknownPhase = {
        type: 'unknown',
        id: 'unknown-1',
      } as unknown as ResponsePhase;

      const { container } = render(<PhaseBubble phase={unknownPhase} />);
      expect(container.firstChild).toBeNull();
    });
  });
});

describe('Phase Types TypeScript', () => {
  it('validates ThoughtPhase structure', () => {
    const phase: ThoughtPhase = {
      type: 'thought',
      id: 'test-id-1',
      content: 'Test thought',
      timestamp: new Date(),
      isExpanded: false,
    };

    expect(phase.type).toBe('thought');
    expect(phase.isExpanded).toBe(false);
  });

  it('validates ToolCallPhase structure', () => {
    const phase: ToolCallPhase = {
      type: 'tool_call',
      id: 'test-id-2',
      toolCallId: 'call-1',
      toolName: 'test_tool',
      arguments: { key: 'value' },
      status: 'executing',
      timestamp: new Date(),
    };

    expect(phase.type).toBe('tool_call');
    expect(phase.status).toBe('executing');
  });

  it('validates ResponsePhase structure', () => {
    const phase: ResponsePhase = {
      type: 'response',
      id: 'test-id-3',
      content: 'Test response',
      timestamp: new Date(),
    };

    expect(phase.type).toBe('response');
  });
});
