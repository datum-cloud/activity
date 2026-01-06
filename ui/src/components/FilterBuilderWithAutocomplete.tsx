import { useState, useRef, useEffect } from 'react';
import type { AuditLogQuerySpec } from '../types';
import { FILTER_FIELDS } from '../types';

export interface FilterBuilderWithAutocompleteProps {
  onFilterChange: (spec: AuditLogQuerySpec) => void;
  initialFilter?: string;
  initialLimit?: number;
  className?: string;
}

interface Suggestion {
  text: string;
  description: string;
  type: 'field' | 'operator' | 'value' | 'function';
}

const OPERATORS: Suggestion[] = [
  { text: '==', description: 'Equals', type: 'operator' },
  { text: '!=', description: 'Not equals', type: 'operator' },
  { text: '>', description: 'Greater than', type: 'operator' },
  { text: '>=', description: 'Greater than or equal', type: 'operator' },
  { text: '<', description: 'Less than', type: 'operator' },
  { text: '<=', description: 'Less than or equal', type: 'operator' },
  { text: 'in', description: 'In array', type: 'operator' },
  { text: '&&', description: 'Logical AND', type: 'operator' },
  { text: '||', description: 'Logical OR', type: 'operator' },
];

const FUNCTIONS: Suggestion[] = [
  { text: '.startsWith(', description: 'String starts with', type: 'function' },
  { text: '.contains(', description: 'String contains', type: 'function' },
  { text: '.endsWith(', description: 'String ends with', type: 'function' },
  { text: '.matches(', description: 'Regex match', type: 'function' },
  { text: 'timestamp(', description: 'Parse timestamp', type: 'function' },
];

const COMMON_VALUES: Record<string, Suggestion[]> = {
  verb: [
    { text: '"get"', description: 'GET requests', type: 'value' },
    { text: '"list"', description: 'LIST requests', type: 'value' },
    { text: '"create"', description: 'CREATE requests', type: 'value' },
    { text: '"update"', description: 'UPDATE requests', type: 'value' },
    { text: '"patch"', description: 'PATCH requests', type: 'value' },
    { text: '"delete"', description: 'DELETE requests', type: 'value' },
    { text: '"watch"', description: 'WATCH requests', type: 'value' },
  ],
  'objectRef.resource': [
    { text: '"pods"', description: 'Pods', type: 'value' },
    { text: '"deployments"', description: 'Deployments', type: 'value' },
    { text: '"services"', description: 'Services', type: 'value' },
    { text: '"secrets"', description: 'Secrets', type: 'value' },
    { text: '"configmaps"', description: 'ConfigMaps', type: 'value' },
    { text: '"namespaces"', description: 'Namespaces', type: 'value' },
    { text: '"replicasets"', description: 'ReplicaSets', type: 'value' },
    { text: '"daemonsets"', description: 'DaemonSets', type: 'value' },
    { text: '"statefulsets"', description: 'StatefulSets', type: 'value' },
  ],
  stage: [
    { text: '"RequestReceived"', description: 'Request received', type: 'value' },
    { text: '"ResponseStarted"', description: 'Response started', type: 'value' },
    { text: '"ResponseComplete"', description: 'Response complete', type: 'value' },
    { text: '"Panic"', description: 'Panic occurred', type: 'value' },
  ],
  level: [
    { text: '"Metadata"', description: 'Metadata level', type: 'value' },
    { text: '"Request"', description: 'Request level', type: 'value' },
    { text: '"RequestResponse"', description: 'Request and Response', type: 'value' },
  ],
};

/**
 * Enhanced FilterBuilder with autocomplete suggestions for CEL expressions
 */
export function FilterBuilderWithAutocomplete({
  onFilterChange,
  initialFilter = '',
  initialLimit = 100,
  className = '',
}: FilterBuilderWithAutocompleteProps) {
  const [filter, setFilter] = useState(initialFilter);
  const [limit, setLimit] = useState(initialLimit);
  const [showHelp, setShowHelp] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    onFilterChange({ filter: newFilter, limit });
    updateSuggestions(newFilter);
  };

  const handleLimitChange = (newLimit: number) => {
    const validLimit = Math.min(Math.max(1, newLimit), 1000);
    setLimit(validLimit);
    onFilterChange({ filter, limit: validLimit });
  };

  const updateSuggestions = (text: string) => {
    const cursorPos = textareaRef.current?.selectionStart || text.length;
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastWord = textBeforeCursor.split(/[\s()[\]]/g).pop() || '';

    let newSuggestions: Suggestion[] = [];

    // Check if we just finished a complete expression (e.g., verb == "get")
    // Suggest logical operators to continue
    const completedValuePattern = /["'][^"']*["']\s*$/;
    const completedNumberPattern = /\d+\s*$/;
    const afterLogicalOp = /(\&\&|\|\|)\s*$/;

    if ((completedValuePattern.test(textBeforeCursor) || completedNumberPattern.test(textBeforeCursor)) && !afterLogicalOp.test(textBeforeCursor)) {
      // After a complete value, suggest logical operators
      newSuggestions.push(
        { text: ' && ', description: 'Logical AND - add another condition', type: 'operator' },
        { text: ' || ', description: 'Logical OR - add alternative condition', type: 'operator' }
      );
    }

    // After && or || suggest fields
    if (afterLogicalOp.test(textBeforeCursor)) {
      const fieldSuggestions = FILTER_FIELDS.map(f => ({
        text: f.name,
        description: f.description,
        type: 'field' as const,
      }));
      newSuggestions.push(...fieldSuggestions);
    }

    // Field name suggestions when typing
    if (lastWord && !lastWord.includes('==') && !lastWord.includes('!=') && !lastWord.includes('&&') && !lastWord.includes('||')) {
      const fieldSuggestions = FILTER_FIELDS
        .filter(f => f.name.toLowerCase().startsWith(lastWord.toLowerCase()))
        .map(f => ({
          text: f.name,
          description: f.description,
          type: 'field' as const,
        }));
      if (fieldSuggestions.length > 0) {
        newSuggestions = fieldSuggestions; // Replace suggestions with field matches
      }
    }

    // Operator suggestions after field name
    const lastToken = textBeforeCursor.trim().split(/\s+/).pop() || '';
    if (FILTER_FIELDS.some(f => lastToken === f.name)) {
      newSuggestions.push(...OPERATORS.filter(op => !['&&', '||'].includes(op.text)));
    }

    // Function suggestions when typing dot
    if (lastWord.startsWith('.') || textBeforeCursor.endsWith('.')) {
      newSuggestions.push(...FUNCTIONS);
    }

    // Value suggestions based on field
    for (const [fieldName, values] of Object.entries(COMMON_VALUES)) {
      const pattern = new RegExp(`${fieldName}\\s*[!=<>]+\\s*$`);
      if (pattern.test(textBeforeCursor)) {
        newSuggestions.push(...values);
      }
    }

    setSuggestions(newSuggestions);
    setShowSuggestions(newSuggestions.length > 0);
    setSelectedSuggestion(0);
  };

  const insertSuggestion = (suggestion: Suggestion) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBefore = filter.substring(0, cursorPos);
    const textAfter = filter.substring(cursorPos);

    // Find the last word to replace
    const lastSpaceIndex = Math.max(
      textBefore.lastIndexOf(' '),
      textBefore.lastIndexOf('('),
      textBefore.lastIndexOf('['),
      textBefore.lastIndexOf('.'),
      0
    );

    const beforeWord = textBefore.substring(0, lastSpaceIndex === 0 ? 0 : lastSpaceIndex + 1);
    const newText = beforeWord + suggestion.text + textAfter;

    setFilter(newText);
    onFilterChange({ filter: newText, limit });
    setShowSuggestions(false);

    // Set cursor position after inserted text
    setTimeout(() => {
      const newPos = beforeWord.length + suggestion.text.length;
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Space to manually trigger autocomplete
    if (e.key === ' ' && e.ctrlKey) {
      e.preventDefault();
      updateSuggestions(filter);
      return;
    }

    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestion(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestion(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
      case 'Tab':
        if (suggestions.length > 0) {
          e.preventDefault();
          insertSuggestion(suggestions[selectedSuggestion]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const insertExample = (example: string) => {
    const newFilter = filter ? `${filter} && ${example}` : example;
    handleFilterChange(newFilter);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`filter-builder ${className}`}>
      <div className="filter-builder-header">
        <h3>Search Audit Logs</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className="help-toggle"
            type="button"
            title="View keyboard shortcuts"
          >
            ⌨️ {showShortcuts ? 'Hide' : ''} Shortcuts
          </button>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="help-toggle"
            type="button"
            title="View available filter fields and examples"
          >
            💡 {showHelp ? 'Hide' : ''} Field Guide
          </button>
        </div>
      </div>

      {showShortcuts && (
        <div className="filter-help" style={{ background: '#f0f9ff', borderColor: '#3b82f6' }}>
          <h4>Keyboard Shortcuts</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.75rem 1.5rem', alignItems: 'start' }}>
            <kbd style={{ padding: '0.25rem 0.5rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.875rem' }}>Ctrl+Space</kbd>
            <span>Trigger autocomplete suggestions at cursor position</span>

            <kbd style={{ padding: '0.25rem 0.5rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.875rem' }}>↑ / ↓</kbd>
            <span>Navigate through autocomplete suggestions</span>

            <kbd style={{ padding: '0.25rem 0.5rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.875rem' }}>Tab</kbd>
            <span>Accept the selected suggestion</span>

            <kbd style={{ padding: '0.25rem 0.5rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.875rem' }}>Enter</kbd>
            <span>Accept the selected suggestion</span>

            <kbd style={{ padding: '0.25rem 0.5rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.875rem' }}>Esc</kbd>
            <span>Close autocomplete suggestions</span>
          </div>

          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'white', borderRadius: '4px', fontSize: '0.875rem' }}>
            <strong>Pro Tips:</strong>
            <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
              <li>Autocomplete appears automatically as you type</li>
              <li>After completing a value (e.g., <code>"get"</code>), suggestions show logical operators (<code>&&</code>, <code>||</code>)</li>
              <li>After typing <code>&&</code> or <code>||</code>, all field names are suggested</li>
              <li>Type <code>.</code> after a field name to see available string functions</li>
            </ul>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="filter-help">
          <h4>Available Fields & Examples</h4>
          <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.9rem' }}>
            Click "Insert" to add an example to your query
          </p>
          <div className="filter-fields">
            {FILTER_FIELDS.map((field) => (
              <div key={field.name} className="filter-field">
                <div className="filter-field-header">
                  <strong>{field.name}</strong>
                  <span className="filter-field-type">{field.type}</span>
                </div>
                <p className="filter-field-description">{field.description}</p>
                {field.examples && field.examples.length > 0 && (
                  <div className="filter-field-examples">
                    <strong>Examples:</strong>
                    {field.examples.map((example, idx) => (
                      <div key={idx} className="example-item">
                        <code>{example}</code>
                        <button
                          onClick={() => insertExample(example)}
                          className="insert-example"
                          type="button"
                        >
                          Insert
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="filter-input-group" style={{ position: 'relative' }}>
        <label htmlFor="filter-input" style={{ display: 'block', marginBottom: '0.5rem' }}>
          <strong>Filter Expression</strong>
          <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#9ca3af', fontWeight: 'normal' }}>
            Press Ctrl+Space for suggestions
          </span>
        </label>
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
          Use autocomplete to build your query, or type field names directly (e.g., verb, objectRef.resource)
        </p>
        <textarea
          ref={textareaRef}
          id="filter-input"
          value={filter}
          onChange={(e) => handleFilterChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => updateSuggestions(filter)}
          placeholder='Example: verb == "delete" && objectRef.namespace == "production"'
          rows={4}
          className="filter-textarea"
        />

        {showSuggestions && suggestions.length > 0 && (
          <div className="autocomplete-suggestions">
            {suggestions.map((suggestion, idx) => (
              <div
                key={idx}
                className={`suggestion-item ${idx === selectedSuggestion ? 'selected' : ''}`}
                onClick={() => insertSuggestion(suggestion)}
                onMouseEnter={() => setSelectedSuggestion(idx)}
              >
                <span className="suggestion-text">{suggestion.text}</span>
                <span className="suggestion-description">{suggestion.description}</span>
                <span className={`suggestion-type type-${suggestion.type}`}>
                  {suggestion.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="limit-input-group">
        <label htmlFor="limit-input">
          <strong>Number of results</strong>
          <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#9ca3af', fontWeight: 'normal' }}>
            (1 to 1,000 events)
          </span>
        </label>
        <input
          id="limit-input"
          type="number"
          value={limit}
          onChange={(e) => handleLimitChange(parseInt(e.target.value) || 100)}
          min={1}
          max={1000}
          className="limit-input"
        />
      </div>

    </div>
  );
}
