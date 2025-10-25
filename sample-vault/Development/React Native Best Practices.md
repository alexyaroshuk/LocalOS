---
title: React Native Best Practices
tags: [react-native, development, best-practices]
category: Development
importance: high
created: 2025-01-08T09:00:00Z
updated: 2025-01-23T11:20:00Z
---

# React Native Best Practices

Key principles to follow when building React Native apps.

## Performance Optimization

### Lists and ScrollViews

- Use `FlatList` for long lists instead of `ScrollView`
- Implement `getItemLayout` for fixed-height items
- Use `windowSize` prop to control rendering window
- Enable `removeClippedSubviews` on Android

```typescript
<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={item => item.id}
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
  windowSize={5}
/>
```

### Avoid Inline Functions

Bad:
```typescript
<Button onPress={() => handlePress(item.id)} />
```

Good:
```typescript
const handlePress = useCallback(() => {
  doSomething(item.id);
}, [item.id]);

<Button onPress={handlePress} />
```

### Memoization

- Use `useMemo` for expensive calculations
- Use `useCallback` for function references
- Use `React.memo` for component optimization

### Animations

- Use `useNativeDriver: true` whenever possible
- Prefer `Animated` API over state updates
- Consider `react-native-reanimated` for complex animations

## State Management

### Local State

Keep component state minimal and focused:

```typescript
const [isLoading, setIsLoading] = useState(false);
const [data, setData] = useState<Item[]>([]);
```

### Global State

**Context API:**
```typescript
const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }) {
  const [state, setState] = useState(initialState);
  return (
    <AppContext.Provider value={state}>
      {children}
    </AppContext.Provider>
  );
}
```

**When to use Redux:**
- Complex state logic
- Many components need same data
- State updates from many places
- Time-travel debugging needed

## Code Organization

### Folder Structure

```
src/
├── components/     # Reusable UI components
├── screens/        # Screen components
├── services/       # Business logic
├── types/          # TypeScript types
├── utils/          # Helper functions
└── navigation/     # Navigation config
```

### Component Structure

Keep components focused and small:

```typescript
// Good: Single responsibility
function UserAvatar({ userId }: Props) {
  const user = useUser(userId);
  return <Image source={{ uri: user.avatar }} />;
}

// Bad: Too many responsibilities
function UserProfile({ userId }: Props) {
  // Fetching, rendering, business logic all mixed
}
```

### Custom Hooks

Extract reusable logic:

```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

## Error Handling

### Error Boundaries

```typescript
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorScreen />;
    }
    return this.props.children;
  }
}
```

### Try-Catch for Async

```typescript
async function fetchData() {
  try {
    const response = await api.getData();
    return response.data;
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
}
```

## Testing

### Unit Tests

```typescript
describe('UserService', () => {
  it('should fetch user data', async () => {
    const user = await UserService.getUser('123');
    expect(user.id).toBe('123');
  });
});
```

### Component Tests

```typescript
import { render, fireEvent } from '@testing-library/react-native';

test('button click increments counter', () => {
  const { getByText } = render(<Counter />);
  const button = getByText('Increment');

  fireEvent.press(button);

  expect(getByText('Count: 1')).toBeTruthy();
});
```

## Related Notes

- [[TypeScript Tips]]
- [[LocalOS Project]]
- [[Performance Optimization]]

#development #react-native #best-practices
