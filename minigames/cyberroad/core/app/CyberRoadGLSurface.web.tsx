// @ts-nocheck
/**
 * Web: real WebGL in a <canvas> — runs Cyber Road in the browser without `expo-gl` (SSR-safe).
 */
import React, { createElement, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

function patchWebGlContext(gl) {
  if (gl && typeof gl.endFrameEXP !== 'function') {
    gl.endFrameEXP = () => {};
  }
  return gl;
}

export default function CyberRoadGLSurface({ onContextCreate, style }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') return;

    let cancelled = false;
    let layoutAttempts = 0;
    const MAX_LAYOUT_ATTEMPTS = 180;

    const run = () => {
      if (cancelled) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        layoutAttempts += 1;
        if (layoutAttempts > MAX_LAYOUT_ATTEMPTS) {
          return;
        }
        window.requestAnimationFrame(run);
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(2, Math.floor(rect.width * dpr));
      const h = Math.max(2, Math.floor(rect.height * dpr));
      canvas.width = w;
      canvas.height = h;

      const gl =
        canvas.getContext('webgl2', {
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
        }) ||
        canvas.getContext('webgl', {
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
        });
      if (!gl || cancelled) return;

      patchWebGlContext(gl);
      void onContextCreate(gl);
    };

    const id = window.requestAnimationFrame(() => window.requestAnimationFrame(run));
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(id);
    };
  }, [onContextCreate]);

  return (
    <View style={[styles.wrap, style]}>
      {createElement('canvas', {
        ref: canvasRef,
        style: {
          width: '100%',
          height: '100%',
          display: 'block',
          touchAction: 'none',
          outline: 'none',
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignSelf: 'stretch',
    minHeight: 0,
    minWidth: 0,
  },
});
