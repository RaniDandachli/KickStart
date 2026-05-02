// @ts-nocheck
import { GLView } from 'expo-gl';
import React from 'react';

/** Native: Expo GL view (OpenGL ES). */
export default function CyberRoadGLSurface({ onContextCreate, style }) {
  return (
    <GLView style={[{ flex: 1, height: '100%', overflow: 'hidden' }, style]} onContextCreate={onContextCreate} />
  );
}
