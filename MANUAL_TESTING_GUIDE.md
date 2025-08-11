# 🧪 Manual Testing Guide - API Key Settings

## Overview
This guide provides comprehensive manual testing procedures for the API Key Settings functionality to ensure robust operation in production.

## Prerequisites
- RealMultiLLM running on `http://localhost:3000` (or appropriate port)
- Valid API keys for testing (or test with invalid keys to verify error handling)
- Browser with developer tools open

## Test Scenarios

### 1. API Key Input and Validation

#### Test 1.1: Valid OpenAI API Key
**Objective**: Verify successful API key saving and validation

**Steps**:
1. Navigate to Settings page → API Keys tab
2. Locate OpenAI API Key card
3. Enter a valid OpenAI API key (format: `sk-proj-...` or `sk-...`)
4. Click "Save & Test" button

**Expected Results**:
- ✅ Button shows "Saving..." with spinner during operation
- ✅ Success toast appears: "✅ API Key Valid - OpenAI API key is working correctly"
- ✅ Green border appears around input field
- ✅ "✓ Verified" badge appears next to label
- ✅ Status shows "✅ API key is valid and working"
- ✅ Partial key shown in status (first 8 characters)

#### Test 1.2: Invalid OpenAI API Key Format
**Objective**: Verify format validation works

**Steps**:
1. Enter invalid format: `invalid-key-123`
2. Click "Save & Test"

**Expected Results**:
- ❌ Error toast: "❌ API Key Invalid - OpenAI API key must start with 'sk-'"
- ❌ Red border around input field
- ❌ "✗ Invalid" badge appears
- ❌ Status shows "❌ API key test failed"

#### Test 1.3: Valid Claude API Key
**Objective**: Test Claude API key validation

**Steps**:
1. Enter valid Claude key (format: `sk-ant-api03-...`)
2. Click "Save & Test"

**Expected Results**:
- ✅ Success validation similar to OpenAI
- ✅ API call made to Anthropic endpoint
- ✅ Proper success indicators

#### Test 1.4: Invalid Claude API Key Format
**Steps**:
1. Enter invalid format: `claude-123`
2. Click "Save & Test"

**Expected Results**:
- ❌ Error: "Claude API key must start with 'sk-ant-'"

#### Test 1.5: Valid Google AI API Key
**Steps**:
1. Enter valid Google AI key (format: `AIza...`)
2. Click "Save & Test"

**Expected Results**:
- ✅ Success validation
- ✅ API call to Google AI endpoint

### 2. User Interface Interactions

#### Test 2.1: Enter Key Functionality
**Steps**:
1. Enter API key in input field
2. Press Enter key

**Expected Results**:
- ✅ Automatically triggers save and test
- ✅ Same behavior as clicking "Save & Test" button

#### Test 2.2: Empty/Whitespace Validation
**Steps**:
1. Leave input field empty
2. Try to save

**Expected Results**:
- ❌ "Save & Test" button is disabled
- ❌ No API call made

**Steps**:
1. Enter only whitespace: `   `
2. Try to save

**Expected Results**:
- ❌ Error toast: "Error - API key cannot be empty"

#### Test 2.3: Real-time Status Updates
**Steps**:
1. Enter API key
2. Observe button and status changes during save/test process

**Expected Results**:
- 🔄 Button text changes to "Saving..." with spinner
- 🔄 Status shows "🔄 Testing API key..."
- ✅ Success or error status updates appropriately

### 3. Error Handling

#### Test 3.1: Network Error Simulation
**Steps**:
1. Disconnect internet or block API endpoints
2. Try to save and test API key

**Expected Results**:
- ❌ Error toast: "🔌 Connection Error - Failed to test API key: [error details]"
- ❌ Proper error logging in activity log

#### Test 3.2: Rate Limiting Simulation
**Objective**: Test handling of API rate limits

**Steps**:
1. Use API key that's hitting rate limits
2. Try to test

**Expected Results**:
- ❌ Specific error message about rate limiting
- ❌ Suggestion that key is valid but temporarily blocked

#### Test 3.3: Invalid/Expired API Key
**Steps**:
1. Use an expired or invalid API key with correct format
2. Test the key

**Expected Results**:
- ❌ Specific authentication error message
- ❌ Clear indication that key is invalid

### 4. Persistence and Data Loading

#### Test 4.1: API Key Persistence
**Steps**:
1. Save valid API keys for all providers
2. Refresh the page
3. Check if keys are loaded

**Expected Results**:
- ✅ All saved API keys appear in their respective fields
- ✅ Status indicators reflect saved state
- ✅ Partial keys shown in status areas

#### Test 4.2: Browser Storage
**Steps**:
1. Open browser dev tools → Application → Local Storage
2. Save API keys
3. Check storage entries

**Expected Results**:
- ✅ Encrypted API key data stored securely
- ✅ No plain text API keys visible in browser storage

### 5. Activity Logging

#### Test 5.1: Success Logging
**Steps**:
1. Successfully save and test API keys
2. Check activity logs in Settings

**Expected Results**:
- ✅ Log entries for "Saved API key for [Provider]"
- ✅ Log entries for "API key test passed for [Provider]"
- ✅ Response times displayed
- ✅ Chronological order maintained

#### Test 5.2: Error Logging
**Steps**:
1. Attempt invalid API key saves/tests
2. Check activity logs

**Expected Results**:
- ❌ Error log entries with specific error messages
- ❌ Timestamp and provider information
- ❌ Detailed error descriptions

### 6. Cross-Provider Testing

#### Test 6.1: Multiple Provider Setup
**Steps**:
1. Set up API keys for all available providers
2. Test each one individually
3. Test all simultaneously

**Expected Results**:
- ✅ Each provider validates independently
- ✅ No interference between providers
- ✅ Correct API endpoints called for each

### 7. Edge Cases

#### Test 7.1: Very Long API Keys
**Steps**:
1. Enter extremely long API key (>200 characters)
2. Test saving and display

**Expected Results**:
- ✅ Handles long keys gracefully
- ✅ UI doesn't break
- ✅ Partial display still works

#### Test 7.2: Special Characters
**Steps**:
1. Try API keys with special characters
2. Test encoding/decoding

**Expected Results**:
- ✅ Special characters handled correctly
- ✅ No encoding issues

#### Test 7.3: Rapid Successive Tests
**Steps**:
1. Rapidly click test button multiple times
2. Verify no race conditions

**Expected Results**:
- ✅ Only one test runs at a time
- ✅ Proper state management
- ✅ No conflicting status updates

### 8. Production Readiness Checks

#### Test 8.1: Real API Validation
**Objective**: Verify actual API connectivity

**Steps**:
1. Use real, active API keys
2. Verify actual API calls work
3. Check response handling

**Expected Results**:
- ✅ Real API calls succeed
- ✅ Proper response parsing
- ✅ Accurate validation results

#### Test 8.2: Security Validation
**Steps**:
1. Check browser dev tools for exposed keys
2. Verify network requests don't leak keys
3. Check local storage encryption

**Expected Results**:
- ✅ No plain text keys in browser
- ✅ HTTPS-only requests
- ✅ Proper encryption at rest

## Performance Testing

### Load Test
**Steps**:
1. Save and test all API keys simultaneously
2. Monitor response times
3. Check for memory leaks

**Expected Results**:
- ✅ Response times < 5 seconds per test
- ✅ No memory leaks
- ✅ Smooth UI interactions

## Browser Compatibility

Test on:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

## Mobile Responsiveness

**Steps**:
1. Test on mobile devices/responsive mode
2. Verify UI elements are accessible
3. Test touch interactions

**Expected Results**:
- ✅ Responsive design works correctly
- ✅ Buttons are touch-friendly
- ✅ Text is readable on small screens

## Accessibility Testing

**Steps**:
1. Use keyboard navigation only
2. Test with screen reader
3. Check ARIA labels

**Expected Results**:
- ✅ Full keyboard accessibility
- ✅ Screen reader compatibility
- ✅ Proper focus management

## Final Validation Checklist

Before marking as production-ready:

- [ ] All test scenarios pass
- [ ] Real API keys work correctly
- [ ] Error handling is comprehensive
- [ ] UI provides clear feedback
- [ ] Data persistence works
- [ ] Security measures are in place
- [ ] Performance is acceptable
- [ ] Cross-browser compatibility confirmed
- [ ] Mobile responsiveness verified
- [ ] Accessibility standards met

## Troubleshooting Common Issues

### Issue: API key not saving
**Solution**: Check browser console for storage errors, verify HTTPS context

### Issue: Test always fails
**Solution**: Verify network connectivity, check API endpoint availability

### Issue: UI not updating
**Solution**: Check for JavaScript errors, verify React state management

### Issue: Keys disappear on refresh
**Solution**: Check local storage permissions, verify storage encryption

---

**Testing Complete**: When all scenarios pass, the API key functionality is ready for production deployment.