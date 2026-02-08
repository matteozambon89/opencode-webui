import { useState, type FC } from 'react';
import { Bot, Brain, Wrench, ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { MessagePhase, ThoughtPhase, ToolCallPhase, ResponsePhase } from '@opencode/shared';

interface PhaseBubbleProps {
  phase: MessagePhase;
}

export const PhaseBubble: FC<PhaseBubbleProps> = ({ phase }) => {
  switch (phase.type) {
    case 'thought':
      return <ThoughtPhaseBubble phase={phase} />;
    case 'tool_call':
      return <ToolCallPhaseBubble phase={phase} />;
    case 'response':
      return <ResponsePhaseBubble phase={phase} />;
    default:
      return null;
  }
};

// Thought Phase Component
const ThoughtPhaseBubble: FC<{ phase: ThoughtPhase }> = ({ phase }) => {
  const [isExpanded, setIsExpanded] = useState(phase.isExpanded ?? false);
  const [showAll, setShowAll] = useState(false);

  // Truncate content if very long (show first 500 chars by default)
  const shouldTruncate = phase.content.length > 500;
  const displayContent = shouldTruncate && !showAll
    ? phase.content.slice(0, 500) + '...'
    : phase.content;

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
        <Brain className="w-5 h-5" />
      </div>
      <div className="max-w-[80%]">
        <div
          className={`bg-amber-50 border border-amber-200 rounded-lg overflow-hidden transition-all duration-300 ${
            isExpanded ? '' : 'hover:bg-amber-100'
          }`}
        >
          {/* Header - always visible */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-2 flex items-center justify-between text-amber-900 hover:bg-amber-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">Thinking</span>
              <span className="text-xs text-amber-600 opacity-70">
                {phase.timestamp.toLocaleTimeString()}
              </span>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-amber-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-amber-600" />
            )}
          </button>

          {/* Content - visible when expanded */}
          {isExpanded && (
            <div className="px-4 pb-3 border-t border-amber-200">
              <pre className="mt-3 text-sm text-amber-800 whitespace-pre-wrap font-mono leading-relaxed">
                {displayContent}
              </pre>
              {shouldTruncate && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="mt-2 text-xs text-amber-600 hover:text-amber-800 underline"
                >
                  {showAll ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Tool Call Phase Component
const ToolCallPhaseBubble: FC<{ phase: ToolCallPhase }> = ({ phase }) => {
  const [showArgs, setShowArgs] = useState(false);
  const [showOutput, setShowOutput] = useState(false);

  const getStatusIcon = () => {
    switch (phase.status) {
      case 'pending':
        return <div className="w-2 h-2 bg-gray-400 rounded-full" />;
      case 'executing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (phase.status) {
      case 'pending':
        return 'Pending';
      case 'executing':
        return 'Running...';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return '';
    }
  };

  // Format arguments for display
  const argsText = JSON.stringify(phase.arguments, null, 2);
  const shouldTruncateArgs = argsText.length > 300;
  const displayArgs = shouldTruncateArgs && !showArgs
    ? argsText.slice(0, 300) + '...'
    : argsText;

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
        <Wrench className="w-5 h-5" />
      </div>
      <div className="max-w-[80%] w-full">
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-blue-900">{phase.toolName}</span>
              <span className="text-xs text-blue-600 opacity-70">
                {phase.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {getStatusIcon()}
              <span className={`text-xs ${
                phase.status === 'error' ? 'text-red-600' :
                phase.status === 'completed' ? 'text-green-600' :
                'text-blue-600'
              }`}>
                {getStatusText()}
              </span>
            </div>
          </div>

          {/* Arguments Section */}
          {Object.keys(phase.arguments).length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowArgs(!showArgs)}
                className="text-xs text-blue-600 hover:text-blue-800 underline mb-1"
              >
                {showArgs ? 'Hide arguments' : 'Show arguments'}
              </button>
              {showArgs && (
                <pre className="text-xs text-blue-800 bg-blue-100/50 rounded px-2 py-1.5 overflow-x-auto font-mono">
                  {displayArgs}
                </pre>
              )}
            </div>
          )}

          {/* Output Section (only show if completed or error) */}
          {(phase.output || phase.error) && (
            <div className="mt-2 pt-2 border-t border-blue-200">
              <button
                onClick={() => setShowOutput(!showOutput)}
                className="text-xs text-blue-600 hover:text-blue-800 underline mb-1"
              >
                {showOutput ? 'Hide output' : 'Show output'}
              </button>
              {showOutput && (
                <div className={`text-xs rounded px-2 py-1.5 overflow-x-auto font-mono ${
                  phase.error ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }`}>
                  {phase.error || phase.output}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Response Phase Component
const ResponsePhaseBubble: FC<{ phase: ResponsePhase }> = ({ phase }) => {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0">
        <Bot className="w-5 h-5" />
      </div>
      <div className="max-w-[80%] bg-white border border-gray-200 rounded-lg px-4 py-2">
        <p className="whitespace-pre-wrap text-gray-900">{phase.content}</p>
        <span className="text-xs text-gray-500 mt-1 block">
          {phase.timestamp.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

export default PhaseBubble;
