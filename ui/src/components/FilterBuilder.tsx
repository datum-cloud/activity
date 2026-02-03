import { useState } from 'react';
import type { AuditLogQuerySpec } from '../types';
import { FILTER_FIELDS } from '../types';

export interface FilterBuilderProps {
  onFilterChange: (spec: AuditLogQuerySpec) => void;
  initialFilter?: string;
  initialLimit?: number;
  className?: string;
}

/**
 * FilterBuilder component for constructing CEL filter expressions
 */
export function FilterBuilder({
  onFilterChange,
  initialFilter = '',
  initialLimit = 100,
  className = '',
}: FilterBuilderProps) {
  const [filter, setFilter] = useState(initialFilter);
  const [limit, setLimit] = useState(initialLimit);
  const [showHelp, setShowHelp] = useState(false);

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    onFilterChange({ filter: newFilter, limit });
  };

  const handleLimitChange = (newLimit: number) => {
    const validLimit = Math.min(Math.max(1, newLimit), 1000);
    setLimit(validLimit);
    onFilterChange({ filter, limit: validLimit });
  };

  const insertExample = (example: string) => {
    const newFilter = filter ? `${filter} && ${example}` : example;
    handleFilterChange(newFilter);
  };

  return (
    <div className={`filter-builder ${className}`}>
      <div className="filter-builder-header">
        <h3>Build Your Query</h3>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="help-toggle"
          type="button"
        >
          {showHelp ? 'Hide' : 'Show'} Help
        </button>
      </div>

      {showHelp && (
        <div className="filter-help">
          <h4>Available Filter Fields</h4>
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

          <div className="cel-operators">
            <h4>Common Operators</h4>
            <ul>
              <li><code>==</code> - Equals</li>
              <li><code>!=</code> - Not equals</li>
              <li><code>&amp;&amp;</code> - And</li>
              <li><code>||</code> - Or</li>
              <li><code>in</code> - In list (e.g., <code>verb in ["create", "delete"]</code>)</li>
              <li><code>.startsWith()</code> - String starts with</li>
              <li><code>.contains()</code> - String contains</li>
              <li><code>timestamp()</code> - Parse timestamp (e.g., <code>timestamp("2024-01-01T00:00:00Z")</code>)</li>
            </ul>
          </div>
        </div>
      )}

      <div className="filter-input-group">
        <label htmlFor="filter-input">
          CEL Filter Expression
        </label>
        <textarea
          id="filter-input"
          value={filter}
          onChange={(e) => handleFilterChange(e.target.value)}
          placeholder='e.g., verb == "delete" && ns == "production"'
          rows={4}
          className="filter-textarea"
        />
      </div>

      <div className="limit-input-group">
        <label htmlFor="limit-input">
          Result Limit (max 1,000)
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

      <div className="quick-filters">
        <h4>Quick Filters</h4>
        <div className="quick-filter-buttons">
          <button onClick={() => insertExample('verb == "delete"')} type="button">
            Delete Operations
          </button>
          <button onClick={() => insertExample('resource == "secrets"')} type="button">
            Secret Access
          </button>
          <button onClick={() => insertExample('user.startsWith("system:")')} type="button">
            System Users
          </button>
          <button onClick={() => insertExample('stage == "ResponseComplete"')} type="button">
            Completed Requests
          </button>
        </div>
      </div>
    </div>
  );
}
