# Chat Layout Fix

## Problem
Messages were being cut off on top of the input, leaving large empty spaces, and not properly fading behind the input like Claude.

## Root Cause
1. **Conversation container** was using `absolute inset-0` which covered the entire screen
2. **Input container** was using `fixed bottom-0` which overlapped with conversation
3. **No proper flex layout** to manage space distribution
4. **Incorrect z-indexing** causing stacking issues

## Solution

### Proper Flex Layout Structure
```
┌─────────────────────────────────────────┐
│ Root Container                          │
│ flex flex-col h-screen overflow-hidden │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Conversation (flex-1)               │ │
│ │ - Takes all available space         │ │
│ │ - Scrolls when content overflows    │ │
│ │ - Messages start from top           │ │
│ │                                     │ │
│ │ [Messages...]                       │ │
│ │ [Messages...]                       │ │
│ │ [Messages...]  ← Scrollable         │ │
│ │ [Messages...]                       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Gradient Fade (h-20)                │ │
│ │ ↑ Transparent                       │ │
│ │ ↓ Black                             │ │
│ ├─────────────────────────────────────┤ │
│ │ Input Container (shrink-0)          │ │
│ │ - Fixed height                      │ │
│ │ - Always visible at bottom          │ │
│ │ [Input Box] [Buttons]               │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Key Changes

1. **Root Container**
   - Added `flex flex-col` for proper flex layout
   - Added `overflow-hidden` to prevent scrolling on root

2. **Conversation Container**
   - Changed from `absolute inset-0` to `flex-1`
   - Now properly takes remaining space after input
   - Scrolls independently

3. **Input Container**
   - Changed from `fixed bottom-0` to `shrink-0`
   - Now part of flex layout
   - Added `bg-black` background
   - Added gradient fade above it

4. **Bottom Gradient**
   - 80px tall gradient above input
   - Fades from black to transparent
   - Creates smooth fade effect for messages

## Benefits
✅ Messages scroll naturally to the bottom  
✅ No large empty spaces at top  
✅ Messages fade behind input (like Claude)  
✅ Proper space distribution  
✅ Input always visible and accessible  
✅ No overlapping issues  

## Result
The chat now behaves like Claude:
- Messages fill the available space
- Scroll smoothly without gaps
- Fade behind the input at the bottom
- Input remains fixed and accessible

