/**
 * ShareMyMeal — Main App Entry Point
 * ======================================
 * Root component that renders the navigation tree.
 */

import React from 'react';
import { StatusBar, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';

// Suppress common dev warnings
LogBox.ignoreLogs([
  'AsyncStorage has been extracted',
  'Non-serializable values were found',
  'Sending `onAnimatedValueUpdate`',
]);

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F14" />
      <AppNavigator />
    </GestureHandlerRootView>
  );
}
