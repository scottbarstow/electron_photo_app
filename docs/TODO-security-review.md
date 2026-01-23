# Security Review TODOs

Issues identified during code review of Phase 1a implementation. Critical issues have been fixed; these are P2 (IMPORTANT) and P3 (NICE-TO-HAVE) items for future iterations.

## P2 - IMPORTANT

### Input Validation

- [ ] Add input validation to database operations (sanitize strings, validate IDs)
- [ ] Validate file extensions match actual file content (magic bytes check)
- [ ] Add length limits to user inputs (tag names, album names, descriptions)

### Error Handling

- [ ] Review error messages for information leakage (don't expose internal paths/details)
- [ ] Add global unhandled promise rejection handler in main process
- [ ] Improve error recovery in directory watcher

### Concurrency

- [ ] Review shared state access patterns in DirectoryService for race conditions
- [ ] Consider adding mutex/lock for critical sections in thumbnail generation
- [ ] Handle concurrent IPC requests that modify the same resources

### Memory Management

- [ ] Add memory limits for thumbnail cache
- [ ] Implement cache eviction strategy (LRU) for large image directories
- [ ] Review sharp library memory usage with large images

### Security Hardening

- [ ] Consider adding rate limiting to file operation IPC handlers
- [ ] Review CSP policy for further restrictions (remove unsafe-inline if possible)
- [ ] Audit npm dependencies for known vulnerabilities (`npm audit`)

## P3 - NICE-TO-HAVE

### Code Quality

- [ ] Enable TypeScript strict mode
- [ ] Add JSDoc comments to public APIs
- [ ] Extract magic strings/numbers to constants

### Testing

- [ ] Add unit tests for path validation functions
- [ ] Add integration tests for IPC handlers
- [ ] Add tests for protocol handler edge cases

### Performance

- [ ] Profile thumbnail generation for optimization opportunities
- [ ] Consider worker threads for CPU-intensive operations (hashing)
- [ ] Implement virtual scrolling optimizations for very large directories

### User Experience

- [ ] Add loading states for long-running operations
- [ ] Improve error messages shown to users
- [ ] Add keyboard shortcuts for common actions

### Accessibility

- [ ] Add ARIA labels to interactive elements
- [ ] Test with screen readers
- [ ] Ensure proper focus management in modals

---

*Generated from code review on feat/phase-1a-core-features branch*
*Critical fixes committed in this PR; these items deferred to future iterations*
