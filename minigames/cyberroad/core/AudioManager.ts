// @ts-nocheck
import { Audio } from "expo-av";

import AudioFiles from "./Audio";

// Web audio is unreliable in this stack; native uses expo-av (stable across Expo Go SDKs).
const MUTED = process.env.EXPO_OS === "web";

function isBenignPlaybackError(e) {
  const s = String(e?.message ?? e ?? "");
  return /interrupted|seek/i.test(s);
}

class AudioManager {
  sounds = AudioFiles;

  audioFileMoveIndex = 0;

  _audioModeReady = false;

  playMoveSound = async () => {
    await this.playAsync(
      this.sounds.player.move[`${this.audioFileMoveIndex}`]
    );
    this.audioFileMoveIndex =
      (this.audioFileMoveIndex + 1) %
      Object.keys(this.sounds.player.move).length;
  };

  playPassiveCarSound = async () => {
    if (Math.floor(Math.random() * 2) === 0) {
      await this.playAsync(this.sounds.car.passive[`1`]);
    }
  };

  playDeathSound = async () => {
    await this.playAsync(
      this.sounds.player.die[`${Math.floor(Math.random() * 2)}`]
    );
  };

  playCarHitSound = async () => {
    await this.playAsync(
      this.sounds.car.die[`${Math.floor(Math.random() * 2)}`]
    );
  };

  /** Metro asset module id → pooled Sound instances */
  _soundCache: Record<number, Audio.Sound[]> = {};

  ensureAudioMode = async () => {
    if (this._audioModeReady || MUTED) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      this._audioModeReady = true;
    } catch {
      /* ignore */
    }
  };

  getIdleSoundAsync = async (resourceId: number) => {
    const pool = this._soundCache[resourceId];
    if (!pool) return null;
    for (const sound of pool) {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded && !status.isPlaying) {
          return sound;
        }
      } catch {
        /* skip broken handle */
      }
    }
    return null;
  };

  createIdleSoundAsync = async (resourceId: number) => {
    if (!this._soundCache[resourceId]) {
      this._soundCache[resourceId] = [];
    }
    const { sound } = await Audio.Sound.createAsync(resourceId);
    this._soundCache[resourceId].push(sound);
    return sound;
  };

  /**
   * Prefer replayAsync for rewinds — avoids setPositionAsync races on iOS ("Seeking interrupted").
   */
  playAsync = async (soundObject: number) => {
    if (MUTED) return;

    await this.ensureAudioMode();

    let sound = await this.getIdleSoundAsync(soundObject);
    const isFresh = !sound;
    if (!sound) {
      sound = await this.createIdleSoundAsync(soundObject);
    }

    try {
      if (isFresh) {
        await sound.playAsync();
      } else {
        await sound.replayAsync();
      }
    } catch (e) {
      if (isBenignPlaybackError(e)) return;
      try {
        await sound.stopAsync();
      } catch {
        /* */
      }
      try {
        await sound.setPositionAsync(0);
      } catch {
        /* seek races — ignore */
      }
      try {
        await sound.playAsync();
      } catch (e2) {
        if (!isBenignPlaybackError(e2)) {
          console.warn("AudioManager.playAsync", e2);
        }
      }
    }
  };

  stopAsync = async (name: string) => {
    if (name in this.sounds) {
      const soundObject = this.sounds[name];
      try {
        if (typeof soundObject === "number" && this._soundCache[soundObject]) {
          for (const sound of this._soundCache[soundObject]) {
            await sound.stopAsync();
            try {
              await sound.setPositionAsync(0);
            } catch {
              /* ignore seek after stop */
            }
          }
        }
      } catch (error) {
        console.warn("Error stopping audio", { error });
      }
    } else {
      console.warn("Audio doesn't exist", name);
    }
  };

  volumeAsync = async (name: string, volume: number) => {
    if (name in this.sounds) {
      const soundObject = this.sounds[name];
      try {
        if (typeof soundObject === "number" && this._soundCache[soundObject]) {
          for (const sound of this._soundCache[soundObject]) {
            await sound.setVolumeAsync(volume);
          }
        }
      } catch (error) {
        console.warn("Error setting volume of audio", { error });
      }
    } else {
      console.warn("Audio doesn't exist", name);
    }
  };

  pauseAsync = async (name: string) => {
    if (name in this.sounds) {
      const soundObject = this.sounds[name];
      try {
        if (typeof soundObject === "number" && this._soundCache[soundObject]) {
          for (const sound of this._soundCache[soundObject]) {
            await sound.pauseAsync();
          }
        }
      } catch (error) {
        console.warn("Error pausing audio", { error });
      }
    } else {
      console.warn("Audio doesn't exist", name);
    }
  };

  get assets() {
    return AudioFiles;
  }

  setupAsync = async () => {
    await this.ensureAudioMode();
    return true;
  };
}

export default new AudioManager();
