/* global jest */
// Silence animated / native warnings in unit tests where possible
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
