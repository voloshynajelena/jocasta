import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Rect, Path, Circle } from 'react-native-svg';

const LETTERS = ['J', '.', 'O', '.', 'C', '.', 'A', '.', 'S', '.', 'T', '.', 'A', '.'];
const LETTER_DELAY = 120;
const RESET_DELAY = 800;

interface LoadingScreenProps {
  showLogo?: boolean;
}

export function LoadingScreen({ showLogo = true }: LoadingScreenProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [fadeAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Fade in logo
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Letter animation
    const interval = setInterval(() => {
      setVisibleCount((prev) => {
        if (prev >= LETTERS.length) {
          // Reset after showing all letters
          setTimeout(() => setVisibleCount(0), RESET_DELAY);
          return prev;
        }
        return prev + 1;
      });
    }, LETTER_DELAY);

    return () => clearInterval(interval);
  }, [fadeAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        {LETTERS.map((letter, index) => (
          <Text
            key={index}
            style={[
              styles.letter,
              letter === '.' ? styles.dot : null,
              index < visibleCount ? styles.visible : styles.hidden,
            ]}
          >
            {letter}
          </Text>
        ))}
      </View>

      <View style={styles.dotsContainer}>
        {[0, 1, 2].map((i) => (
          <LoadingDot key={i} delay={i * 200} />
        ))}
      </View>
    </View>
  );
}

function LoadingDot({ delay }: { delay: number }) {
  const [scaleAnim] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 400,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.5,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [scaleAnim, delay]);

  return (
    <Animated.View
      style={[
        styles.loadingDot,
        { transform: [{ scale: scaleAnim }] },
      ]}
    />
  );
}

export function JocastaLogo({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Rect width="512" height="512" rx="80" fill="#1a2744" />
      <Path
        d="M 340 80 C 362 80, 380 98, 380 120 L 380 320 C 380 386, 326 440, 260 440 L 200 440 C 156 440, 120 404, 120 360 C 120 316, 156 280, 200 280 C 222 280, 240 298, 240 320 C 240 342, 258 360, 280 360 C 302 360, 320 342, 320 320 L 320 120 C 320 98, 338 80, 340 80 Z"
        fill="#4eca8b"
      />
    </Svg>
  );
}

// Blue J. logo for header
export function JocastaHeaderLogo({ height = 32 }: { height?: number }) {
  const width = height * 2;
  return (
    <Svg width={width} height={height} viewBox="0 0 120 60">
      <Path
        d="M42 8C42 5.79086 43.7909 4 46 4H52C54.2091 4 56 5.79086 56 8V38C56 48.4934 47.4934 57 37 57H32C26.4772 57 22 52.5228 22 47C22 41.4772 26.4772 37 32 37H42V8Z"
        fill="#5b8def"
      />
      <Circle cx="72" cy="47" r="10" fill="#5b8def" />
    </Svg>
  );
}

export function JocastaLogoText({ size = 200 }: { size?: number }) {
  const height = size * 0.25;
  return (
    <Svg width={size} height={height} viewBox="0 0 400 100">
      {/* J */}
      <Path
        d="M30 10C30 6 33 3 37 3H47C51 3 54 6 54 10V60C54 77 40 91 23 91H17C9 91 3 85 3 77V77C3 69 9 63 17 63H30V10Z"
        fill="#4eca8b"
      />
      <Circle cx="68" cy="83" r="8" fill="#4eca8b" />

      {/* O */}
      <Path
        d="M115 47C115 28 130 13 149 13C168 13 183 28 183 47V57C183 76 168 91 149 91C130 91 115 76 115 57V47ZM139 47V57C139 63 143 68 149 68C155 68 159 63 159 57V47C159 41 155 36 149 36C143 36 139 41 139 47Z"
        fill="#4eca8b"
      />

      {/* C */}
      <Path
        d="M197 47C197 28 212 13 231 13C244 13 255 20 260 31L240 43C238 39 235 36 231 36C225 36 221 41 221 47V57C221 63 225 68 231 68C235 68 238 65 240 61L260 73C255 84 244 91 231 91C212 91 197 76 197 57V47Z"
        fill="#4eca8b"
      />

      {/* A */}
      <Path
        d="M277 77L299 17H323L345 77C346 80 344 83 341 83H325C322 83 320 81 319 78L316 70H306L303 78C302 81 300 83 297 83H281C278 83 276 80 277 77ZM311 50L309 56H313L311 50Z"
        fill="#4eca8b"
      />

      {/* S */}
      <Path
        d="M357 30C357 20 365 13 377 13C389 13 397 20 397 30V35H377V33C377 31 376 30 374 30H380C382 30 383 31 383 33V35L363 55C359 59 357 64 357 69V71C357 82 365 89 377 89C389 89 397 82 397 71V66H377V71C377 73 376 74 374 74H380C382 74 383 73 383 71V69L363 49C359 45 357 40 357 35V30Z"
        fill="#4eca8b"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2744',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 40,
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
  },
  letter: {
    fontSize: 32,
    fontWeight: '700',
    color: '#5b8def',
    marginHorizontal: 1,
  },
  dot: {
    fontSize: 32,
    marginHorizontal: 0,
  },
  visible: {
    opacity: 1,
  },
  hidden: {
    opacity: 0,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginTop: 40,
    gap: 8,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#5b8def',
  },
});

export default LoadingScreen;
