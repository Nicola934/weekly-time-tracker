import React, { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const STARTUP_LOG_PREFIX = '[startupSplash]';
const STARTUP_LOGO = require('../assets/logo.png');
const SPLASH_MIN_DURATION_MS = 5000;

export default function StartupSplash({ onFinish }: { onFinish: () => void }) {
  const finishedRef = useRef(false);

  const finishOnce = useCallback(() => {
    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    onFinish();
  }, [onFinish]);

  useEffect(() => {
    const timer = setTimeout(() => {
      finishOnce();
    }, SPLASH_MIN_DURATION_MS);

    return () => clearTimeout(timer);
  }, [finishOnce]);

  return (
    <View style={styles.container}>
      <View style={styles.overlay}>
        <View style={styles.glow} />
        <View style={styles.card}>
          <Image
            accessibilityLabel="LIONYX-E logo"
            onError={(event) => {
              console.error(
                `${STARTUP_LOG_PREFIX} logo render failed`,
                event?.nativeEvent,
              );
            }}
            resizeMode="contain"
            source={STARTUP_LOGO}
            style={styles.logo}
          />
          <Text style={styles.brand}>LIONYX-E</Text>
          <ActivityIndicator color="#D6A436" />
          <Text style={styles.loading}>Preparing execution workspace...</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: '#2B2110',
    opacity: 0.55,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    gap: 14,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2C2C2C',
    backgroundColor: 'rgba(26,26,26,0.92)',
  },
  logo: {
    width: 72,
    height: 72,
  },
  brand: {
    color: '#D6A436',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  loading: { color: '#F0F0F0', fontSize: 13 },
});
