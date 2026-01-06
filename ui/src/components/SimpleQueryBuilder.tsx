import { useState } from 'react';
import type { AuditLogQuerySpec } from '../types';
import { DateTimeRangePicker, type DateTimeRange } from './DateTimeRangePicker';

export interface SimpleQueryBuilderProps {
  onFilterChange: (spec: AuditLogQuerySpec) => void;
  initialLimit?: number;
  className?: string;
}

interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

const COMMON_FIELDS = [
  { value: 'verb', label: 'Action (verb)', type: 'string' },
  { value: 'objectRef.resource', label: 'Resource Type', type: 'string' },
  { value: 'objectRef.namespace', label: 'Namespace', type: 'string' },
  { value: 'objectRef.name', label: 'Resource Name', type: 'string' },
  { value: 'user.username', label: 'Username', type: 'string' },
  { value: 'level', label: 'Audit Level', type: 'string' },
  { value: 'stage', label: 'Stage', type: 'string' },
  { value: 'responseStatus.code', label: 'Status Code', type: 'number' },
];

const STRING_OPERATORS = [
  { value: '==', label: 'equals' },
  { value: '!=', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'endsWith', label: 'ends with' },
];

const NUMBER_OPERATORS = [
  { value: '==', label: 'equals' },
  { value: '!=', label: 'does not equal' },
  { value: '>', label: 'greater than' },
  { value: '>=', label: 'greater than or equal' },
  { value: '<', label: 'less than' },
  { value: '<=', label: 'less than or equal' },
];

const COMMON_VALUES: Record<string, string[]> = {
  verb: ['get', 'list', 'create', 'update', 'patch', 'delete', 'watch'],
  'objectRef.resource': ['pods', 'deployments', 'services', 'secrets', 'configmaps', 'namespaces'],
  level: ['Metadata', 'Request', 'RequestResponse'],
  stage: ['RequestReceived', 'ResponseStarted', 'ResponseComplete', 'Panic'],
};

export function SimpleQueryBuilder({
  onFilterChange,
  initialLimit = 100,
  className = '',
}: SimpleQueryBuilderProps) {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { id: '1', field: 'verb', operator: '==', value: '' },
  ]);
  const [limit, setLimit] = useState(initialLimit);
  const [advancedFilter, setAdvancedFilter] = useState('');
  const [timeRange, setTimeRange] = useState<DateTimeRange | null>(null);

  const addCondition = () => {
    const newCondition: FilterCondition = {
      id: Date.now().toString(),
      field: 'verb',
      operator: '==',
      value: '',
    };
    setConditions([...conditions, newCondition]);
  };

  const removeCondition = (id: string) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter(c => c.id !== id));
    }
  };

  const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
    setConditions(
      conditions.map(c => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const generateCEL = (): string => {
    const parts = conditions
      .filter(c => c.value) // Only include conditions with values
      .map(c => {
        const field = COMMON_FIELDS.find(f => f.value === c.field);
        const isNumber = field?.type === 'number';

        // Handle function-based operators
        if (['contains', 'startsWith', 'endsWith'].includes(c.operator)) {
          return `${c.field}.${c.operator}("${c.value}")`;
        }

        // Handle regular operators
        const value = isNumber ? c.value : `"${c.value}"`;
        return `${c.field} ${c.operator} ${value}`;
      });

    // Add time range conditions if set
    if (timeRange) {
      parts.push(`stageTimestamp >= timestamp("${timeRange.start}")`);
      parts.push(`stageTimestamp <= timestamp("${timeRange.end}")`);
    }

    return parts.join(' && ');
  };

  const handleApply = () => {
    const filter = mode === 'simple' ? generateCEL() : advancedFilter;
    onFilterChange({ filter, limit, startTime: timeRange?.start, endTime: timeRange?.end });
  };

  const handleTimeRangeChange = (range: DateTimeRange) => {
    setTimeRange(range);
  };

  const handleLimitChange = (newLimit: number) => {
    const validLimit = Math.min(Math.max(1, newLimit), 1000);
    setLimit(validLimit);
  };

  const getOperators = (fieldValue: string) => {
    const field = COMMON_FIELDS.find(f => f.value === fieldValue);
    return field?.type === 'number' ? NUMBER_OPERATORS : STRING_OPERATORS;
  };

  const switchMode = (newMode: 'simple' | 'advanced') => {
    if (newMode === 'advanced' && mode === 'simple') {
      // Switching to advanced, populate with generated CEL
      setAdvancedFilter(generateCEL());
    }
    setMode(newMode);
  };

  return (
    <div className={`simple-query-builder ${className}`}>
      <DateTimeRangePicker onChange={handleTimeRangeChange} />

      <div className="query-mode-toggle">
        <button
          type="button"
          className={`mode-button ${mode === 'simple' ? 'active' : ''}`}
          onClick={() => switchMode('simple')}
        >
          Simple
        </button>
        <button
          type="button"
          className={`mode-button ${mode === 'advanced' ? 'active' : ''}`}
          onClick={() => switchMode('advanced')}
        >
          Advanced
        </button>
      </div>

      {mode === 'simple' ? (
        <div className="simple-mode">
          <div className="conditions-list">
            {conditions.map((condition, index) => (
              <div key={condition.id} className="condition-row">
                {index > 0 && <span className="condition-connector">AND</span>}

                <select
                  value={condition.field}
                  onChange={(e) => updateCondition(condition.id, {
                    field: e.target.value,
                    operator: getOperators(e.target.value)[0].value
                  })}
                  className="condition-select field-select"
                >
                  {COMMON_FIELDS.map(field => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>

                <select
                  value={condition.operator}
                  onChange={(e) => updateCondition(condition.id, { operator: e.target.value })}
                  className="condition-select operator-select"
                >
                  {getOperators(condition.field).map(op => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {COMMON_VALUES[condition.field] ? (
                  <select
                    value={condition.value}
                    onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                    className="condition-select value-select"
                  >
                    <option value="">Select value...</option>
                    {COMMON_VALUES[condition.field].map(val => (
                      <option key={val} value={val}>
                        {val}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={condition.value}
                    onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                    placeholder="Enter value..."
                    className="condition-input value-input"
                  />
                )}

                {conditions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCondition(condition.id)}
                    className="remove-condition-button"
                    aria-label="Remove condition"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addCondition}
            className="add-condition-button"
          >
            + Add Condition
          </button>
        </div>
      ) : (
        <div className="advanced-mode">
          <label htmlFor="advanced-filter" style={{ display: 'block', marginBottom: '0.5rem' }}>
            <strong>CEL Filter Expression</strong>
          </label>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Write your query using CEL syntax
          </p>
          <textarea
            id="advanced-filter"
            value={advancedFilter}
            onChange={(e) => setAdvancedFilter(e.target.value)}
            placeholder='Example: verb == "delete" && objectRef.namespace == "production"'
            rows={4}
            className="filter-textarea"
          />
        </div>
      )}

      <div className="query-builder-footer">
        <div className="limit-group">
          <label htmlFor="limit-input">
            <strong>Results limit</strong>
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

        <button
          type="button"
          onClick={handleApply}
          className="apply-button"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}
