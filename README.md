# AI DJ Assistant

A modern, interactive AI DJ Assistant built with Next.js 16, TypeScript, and Tailwind CSS v4. Features an animated input interface with typewriter effects and a beautiful gradient background.

## Features

- 🎵 **AI DJ Assistant Interface** - Clean, centered input with animated placeholder text
- ✨ **Typewriter Animation** - Dynamic placeholder text that cycles through music-related prompts
- 🎨 **Gradient Background** - Beautiful dual-gradient background with grid pattern
- 📱 **Responsive Design** - Works perfectly on desktop and mobile devices
- ⚡ **Auto-resizing Input** - Textarea automatically adjusts height as you type
- 💬 **Message System** - Displays user messages with proper styling and alignment
- 🎯 **Modern UI** - Built with Tailwind CSS v4 and shadcn/ui components

## Tech Stack

- **Framework**: Next.js 16 (Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **UI Components**: shadcn/ui
- **Build Tool**: Turbopack

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ai-dj.git
   cd ai-dj
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
ai-dj/
├── app/
│   ├── globals.css          # Global styles and Tailwind imports
│   ├── layout.tsx           # Root layout component
│   └── page.tsx             # Main page component
├── components/
│   ├── hooks/
│   │   └── use-auto-resize-textarea.ts  # Custom hook for textarea resizing
│   └── ui/
│       ├── ai-input-demo.tsx            # Demo component with message display
│       ├── ai-input-with-loading.tsx    # Main input component
│       ├── gradient-blur-bg.tsx         # Background component
│       ├── textarea.tsx                 # Custom textarea component
│       └── typewriter.tsx               # Typewriter animation component
├── lib/
│   └── utils.ts             # Utility functions (cn helper)
└── package.json
```

## Key Components

### AIInputWithLoading
The main input component featuring:
- Auto-resizing textarea
- Typewriter placeholder animation
- Custom styling with Tailwind CSS
- Loading states and animations

### GradientBlurBg
Background component with:
- Dual gradient system
- Grid pattern overlay
- Responsive design
- Multiple variants (single/dual)

### Typewriter
Animation component for:
- Cycling through placeholder text
- Smooth typewriter effects
- Customizable speed and timing
- Music-related prompts

## Customization

### Changing Placeholder Text
Edit the `text` array in `components/ui/typewriter.tsx`:

```typescript
const texts = [
  "Create a playlist for a late night drive through the city",
  "I need music for a workout session - something energetic",
  // Add your own prompts here
];
```

### Styling
The project uses Tailwind CSS v4. Modify styles in:
- `app/globals.css` - Global styles
- Component files - Individual component styles

### Background
Customize the gradient background in `components/ui/gradient-blur-bg.tsx`:
- Change gradient colors
- Adjust grid pattern
- Modify opacity and blur effects

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Animated with [Framer Motion](https://www.framer.com/motion/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)