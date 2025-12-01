import React from 'react';
import { Box, Text } from 'ink';

// ASCII art for "THIRAN" - stylized block letters
const BANNER_LARGE = `
 ████████╗██╗  ██╗██╗██████╗  █████╗ ███╗   ██╗
 ╚══██╔══╝██║  ██║██║██╔══██╗██╔══██╗████╗  ██║
    ██║   ███████║██║██████╔╝███████║██╔██╗ ██║
    ██║   ██╔══██║██║██╔══██╗██╔══██║██║╚██╗██║
    ██║   ██║  ██║██║██║  ██║██║  ██║██║ ╚████║
    ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝
`;

const BANNER_MEDIUM = `
 ▀█▀ █░█ █ █▀█ ▄▀█ █▄░█
 ░█░ █▀█ █ █▀▄ █▀█ █░▀█
`;

const BANNER_SMALL = `
╭─────────────────╮
│     THIRAN      │
╰─────────────────╯
`;

// Gradient colors (cyan to blue to purple)
const GRADIENT_COLORS = [
  '#00FFFF', // Cyan
  '#00BFFF', // Deep Sky Blue
  '#1E90FF', // Dodger Blue
  '#6495ED', // Cornflower Blue
  '#7B68EE', // Medium Slate Blue
  '#9370DB', // Medium Purple
];

// Thirukkural-inspired programming wisdom
const KURAL_QUOTES = [
  {
    quote: "Test before you deploy, debug before you sleep",
    kural: "அறன்எனப் பட்டதே இல்வாழ்க்கை அஃதும்\nபிறன்பழிப்பது இல்",
    meaning: "Quality comes from discipline, not haste"
  },
  {
    quote: "Good code speaks for itself, but great comments speak for others",
    kural: "கல்லாதான் சொல்லும் கடைபெறும்",
    meaning: "Knowledge shared multiplies wisdom"
  },
  {
    quote: "Refactor when the code is working, not when it's broken",
    kural: "செய்வினை செய்வான் செயன் மறவன்",
    meaning: "Act with purpose at the right time"
  },
  {
    quote: "A bug found in dev is worth ten found in production",
    kural: "முன்னுரைத்தான் மொழிகோள்",
    meaning: "Prevention surpasses cure"
  },
  {
    quote: "Version control saves code, code reviews save careers",
    kural: "அறிவுடையார் எல்லா முடையார்",
    meaning: "Wisdom lies in collaboration"
  },
  {
    quote: "Write code as if the next maintainer is a violent psychopath who knows where you live",
    kural: "பிறர்க்குஇன்னா முற்பகல் செய்யின்\nதமக்குஇன்னா பிற்பகல் தாம்வரும்",
    meaning: "Treat others' time as you'd treat your own"
  },
  {
    quote: "Premature optimization is the root of all evil, but so is no optimization",
    kural: "அளவு அறிந்து வாழாதான் வாழ்க்கை\nகுளவியது கோடின்றி நீர்",
    meaning: "Balance is the foundation of excellence"
  },
  {
    quote: "Learn from stack overflow, but understand before you paste",
    kural: "கற்க கசடறக் கற்பவை கற்றபின்\nநிற்க அதற்குத் தக",
    meaning: "Learn thoroughly, apply wisely"
  },
  {
    quote: "The best debugging tool is a good night's sleep",
    kural: "உறங்குவது போலும் சாக்காடு",
    meaning: "Rest restores clarity"
  },
  {
    quote: "Name your variables well; future you will thank present you",
    kural: "சொல்லுக சொல்லிற் பயனுடைய சொல்லற்க\nசொல்லிற் பயனிலாச் சொல்",
    meaning: "Clarity in expression prevents confusion"
  },
  {
    quote: "Fail fast, learn faster, iterate fastest",
    kural: "தவறுதலும் தேறலும் தேறாமை",
    meaning: "Mistakes teach, if we listen"
  },
  {
    quote: "Security by obscurity is no security at all",
    kural: "மறைப்பு நீக்கி மாண்புடையார்",
    meaning: "True strength needs no hiding"
  },
  {
    quote: "Delete code with confidence, not with fear",
    kural: "பழமை எனப்படுவது யாதெனின்",
    meaning: "Let go of what no longer serves"
  },
  {
    quote: "Document not what the code does, but why it does it",
    kural: "செய்வினை செய்வானுக்கு தெளிவு",
    meaning: "Intent matters more than action"
  },
  {
    quote: "A well-placed breakpoint beats a thousand print statements",
    kural: "ஒருமைப்பாட்டான் காட்டும் பொருள்",
    meaning: "Precision reveals truth"
  },
];

interface BannerProps {
  width?: number;
}

// Get daily quote based on current date (same quote each day)
function getDailyQuote() {
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  const index = dayOfYear % KURAL_QUOTES.length;
  return KURAL_QUOTES[index];
}

export const Banner: React.FC<BannerProps> = ({ width = 80 }) => {
  // Select banner based on terminal width
  let banner: string;
  if (width >= 50) {
    banner = BANNER_LARGE;
  } else if (width >= 30) {
    banner = BANNER_MEDIUM;
  } else {
    banner = BANNER_SMALL;
  }

  const lines = banner.split('\n').filter(line => line.length > 0);
  const dailyQuote = getDailyQuote();

  return (
    <Box flexDirection="column" marginBottom={1}>
      {lines.map((line, index) => {
        // Apply gradient color based on line position
        const colorIndex = Math.floor((index / lines.length) * GRADIENT_COLORS.length);
        const color = GRADIENT_COLORS[Math.min(colorIndex, GRADIENT_COLORS.length - 1)];

        return (
          <Text key={index} color={color}>
            {line}
          </Text>
        );
      })}
      <Box marginTop={1} marginBottom={1}>
        <Text color="gray">AI-Powered Coding Assistant</Text>
        <Text color="gray" dimColor> • </Text>
        <Text color="gray" dimColor>Type /help for commands</Text>
      </Box>

      {/* Daily Thirukkural wisdom */}
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginTop={1}>
        <Box marginBottom={0}>
          <Text color="yellow" bold>💡 Today's Wisdom: </Text>
          <Text color="cyan" italic>{dailyQuote.quote}</Text>
        </Box>
        <Box>
          <Text color="gray" dimColor>   — {dailyQuote.meaning}</Text>
        </Box>
      </Box>
    </Box>
  );
};

// Simple one-line version for compact displays
export const BannerCompact: React.FC = () => (
  <Box>
    <Text color="cyan" bold>⚡ Thiran</Text>
    <Text color="gray"> - AI Coding Assistant</Text>
  </Box>
);
