import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';

const STARTUP_VIDEO = require('../assets/lionyxe-startup.mp4');

export default function StartupSplash({ onFinish }: { onFinish: () => void }) {
  const [fallbackTriggered, setFallbackTriggered] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFallbackTriggered(true);
      onFinish();
    }, 6500);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View style={styles.container}>
      {!fallbackTriggered ? (
        <Video
          source={STARTUP_VIDEO}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping={false}
          onPlaybackStatusUpdate={(status) => {
            if (!status.isLoaded) {
              return;
            }
            if (status.didJustFinish) {
              onFinish();
            }
          }}
          onError={() => onFinish()}
        />
      ) : null}
      <View style={styles.overlay}>
        <Text style={styles.brand}>LIONYX-E</Text>
        <ActivityIndicator color="#D6A436" />
        <Text style={styles.loading}>Preparing execution workspace…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  video: { ...StyleSheet.absoluteFillObject },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(18,18,18,0.28)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 72,
    gap: 12,
  },
  brand: { color: '#D6A436', fontSize: 30, fontWeight: '700', letterSpacing: 2 },
  loading: { color: '#F0F0F0', fontSize: 13 },
});
