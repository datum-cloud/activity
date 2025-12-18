# FilterBuilderWithAutocomplete - Intelligent Query Builder

## Overview

We now offer **TWO filter builder components**:

### 1. **FilterBuilder** (Original)
- Basic CEL expression builder
- Help documentation
- Quick filter buttons
- Example insertion

### 2. **FilterBuilderWithAutocomplete** (NEW! ✨)
- **Everything from FilterBuilder PLUS:**
- **Smart autocomplete suggestions** as you type
- **Context-aware suggestions** based on cursor position
- **Keyboard navigation** (Arrow keys, Tab, Enter)
- **Multiple suggestion types**: fields, operators, values, functions

## Autocomplete Features

### Field Name Suggestions
Start typing and get suggestions for available fields:
- `ns` → namespace
- `ver` → verb
- `res` → resource
- `user` → user
- etc.

### Operator Suggestions
After typing a field name, get operator suggestions:
- `==` (Equals)
- `!=` (Not equals)
- `in` (In array)
- `&&` (Logical AND)
- `||` (Logical OR)
- `>`, `>=`, `<`, `<=`

### Value Suggestions
Context-aware value suggestions based on the field:

**For `verb`:**
- `"get"`, `"list"`, `"create"`, `"update"`, `"delete"`, `"watch"`

**For `resource`:**
- `"pods"`, `"deployments"`, `"services"`, `"secrets"`, `"configmaps"`

**For `stage`:**
- `"RequestReceived"`, `"ResponseStarted"`, `"ResponseComplete"`, `"Panic"`

**For `level`:**
- `"Metadata"`, `"Request"`, `"RequestResponse"`

### Function Suggestions
Type a dot (`.`) after a field to see string functions:
- `.startsWith(` - String starts with
- `.contains(` - String contains
- `.endsWith(` - String ends with
- `.matches(` - Regex match
- `timestamp(` - Parse timestamp

## Usage

### Basic Usage

```tsx
import { FilterBuilderWithAutocomplete, ActivityApiClient } from '@miloapis/activity-ui';

function MyComponent() {
  const client = new ActivityApiClient({ baseUrl: '...' });

  return (
    <FilterBuilderWithAutocomplete
      onFilterChange={(spec) => console.log(spec)}
      initialFilter=""
      initialLimit={100}
    />
  );
}
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **↓** | Move down in suggestions |
| **↑** | Move up in suggestions |
| **Tab** or **Enter** | Accept selected suggestion |
| **Esc** | Close suggestions |
| **Type** | Show/update suggestions |

### Example Workflow

1. **Start typing:** `verb`
   - Suggestions appear: `verb`, `verbFilter`, etc.

2. **Select `verb` and press Tab**
   - Autocompletes to `verb`

3. **Type space**
   - Operator suggestions appear: `==`, `!=`, `in`, etc.

4. **Select `==` and press Tab**
   - Now shows: `verb ==`

5. **Type space**
   - Value suggestions appear: `"get"`, `"list"`, `"create"`, etc.

6. **Select `"delete"` and press Tab**
   - Complete filter: `verb == "delete"`

7. **Continue building:**
   - Type ` && res`
   - Gets `resource` suggestion
   - Build complex queries easily!

## Component Comparison

| Feature | FilterBuilder | FilterBuilderWithAutocomplete |
|---------|--------------|------------------------------|
| CEL Expression Input | ✅ | ✅ |
| Help Documentation | ✅ | ✅ |
| Quick Filters | ✅ | ✅ |
| Example Insertion | ✅ | ✅ |
| **Autocomplete** | ❌ | ✅ |
| **Smart Suggestions** | ❌ | ✅ |
| **Keyboard Navigation** | ❌ | ✅ |
| **Context-Aware** | ❌ | ✅ |

## All Available Components

### Query Building
1. **FilterBuilder** - Basic filter builder
2. **FilterBuilderWithAutocomplete** - Filter builder with autocomplete (NEW!)
3. **AuditLogQueryComponent** - Complete query UI (uses FilterBuilder)

### Data Display
4. **AuditEventViewer** - Display audit events in cards with expandable details

### Programmatic Access
5. **useAuditLogQuery** - React hook for query execution
6. **ActivityApiClient** - Typed API client

## Future Enhancements

Potential additions:
- [ ] **Smart templates** - Save and reuse common queries
- [ ] **Query history** - Recent queries
- [ ] **Syntax highlighting** - Color-coded CEL expressions
- [ ] **Query validation** - Real-time syntax checking
- [ ] **Visual query builder** - Drag-and-drop interface
- [ ] **Field value discovery** - Suggest actual values from your data
- [ ] **Query sharing** - Share queries via URL

## Try It Now

The autocomplete feature is already built and exported! To use it:

```tsx
// Instead of:
import { FilterBuilder } from '@miloapis/activity-ui';

// Use:
import { FilterBuilderWithAutocomplete } from '@miloapis/activity-ui';
```

The API is identical - it's a drop-in replacement with enhanced functionality!

## Screenshot Examples

**Field Suggestions:**
```
Type: ns
Shows: ns, namespace (if available)
```

**Operator Suggestions:**
```
Type: verb
Shows: ==, !=, in, &&, ||, etc.
```

**Value Suggestions:**
```
Type: verb ==
Shows: "get", "list", "create", "update", "delete", "watch"
```

**Function Suggestions:**
```
Type: user.
Shows: .startsWith(, .contains(, .endsWith(, .matches(
```

## Performance

- ⚡ Instant suggestions (no API calls)
- 🎯 Context-aware filtering
- 🚀 Smooth keyboard navigation
- 💾 Minimal memory footprint

The autocomplete is completely client-side and doesn't require any server calls!
