import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import {
  AudioModule, IOSOutputFormat, useAudioRecorder, useAudioRecorderState,
  useAudioPlayer, setAudioModeAsync
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const OPTIONS = {
  extension: '.wav',
  sampleRate: 48000,
  numberOfChannels: 2,
  bitRate: 2304000,
  directory: 'document',
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: 127,
    linearPCMBitDepth: 24,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
    isMeteringEnabled: true,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 256000 },
};

const AUDIO_DIR = () => (FileSystem.documentDirectory || '') + 'ExpoAudio/';
const secs = ms => {
  const n = Math.floor((ms || 0) / 1000);
  return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
};
const mb = n => (n / 1048576).toFixed(1) + ' MB';

function Action({ title, onPress, disabled, danger, small }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [
      styles.btn, danger && styles.danger, small && styles.small,
      (disabled || pressed) && { opacity: disabled ? 0.4 : 0.78 }
    ]}>
      <Text style={[styles.btnText, danger && { color: '#ffd5d0' }]}>{title}</Text>
    </Pressable>
  );
}

export default function App() {
  const recorder = useAudioRecorder(OPTIONS);
  const recState = useAudioRecorderState(recorder, 250);
  const player = useAudioPlayer(null);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Bereit. iPad-Mikrofone werden über die native Audio-API angesprochen.');
  const [last, setLast] = useState(null);
  const [current, setCurrent] = useState(null);

  async function refresh() {
    try {
      const dir = AUDIO_DIR();
      if (!dir) return;
      const list = await FileSystem.readDirectoryAsync(dir).catch(() => []);
      const wavs = list.filter(f => /\.wav$/i.test(f));
      const details = await Promise.all(wavs.map(async name => {
        const uri = dir + name;
        const stat = await FileSystem.getInfoAsync(uri);
        return { name, uri, size: stat.size || 0, modified: stat.modificationTime || 0 };
      }));
      details.sort((a,b) => b.modified - a.modified);
      setFiles(details);
    } catch (e) { setMessage('Archiv nicht lesbar: ' + e.message); }
  }

  useEffect(() => { refresh(); }, []);

  async function start() {
    if (busy || recState.isRecording) return;
    setBusy(true);
    try {
      if (Platform.OS !== 'ios') throw new Error('Diese Testversion ist für das iPad vorgesehen.');
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error('Mikrofonberechtigung wurde nicht erteilt.');
      player.pause();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setMessage('Aufnahme läuft: PCM 24 Bit / 48 kHz, zwei Kanäle angefordert. Bitte iPad nicht sperren.');
    } catch (e) {
      setMessage('Aufnahme konnte nicht beginnen: ' + (e.message || e));
    } finally { setBusy(false); }
  }

  async function stop() {
    if (busy || !recState.isRecording) return;
    setBusy(true);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!uri) throw new Error('Keine Datei von der Audio-API zurückgegeben.');
      setLast(uri);
      setCurrent(uri);
      await refresh();
      setMessage('Take gesichert. Aufnahme beendet, Wiedergabe auf Musikmodus umgestellt. WAV bitte zusätzlich über „Teilen“ sichern.');
    } catch (e) {
      setMessage('Aufnahme konnte nicht beendet werden: ' + (e.message || e));
    } finally { setBusy(false); }
  }

  async function play(uri) {
    if (busy || recState.isRecording) return;
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      player.pause();
      player.replace({ uri });
      player.volume = 1;
      player.play();
      setCurrent(uri);
      setMessage('Wiedergabe über den normalen iPad-Audioausgang. Kopfhörer oder DAC werden über iPadOS ausgewählt.');
    } catch (e) { setMessage('Wiedergabe fehlgeschlagen: ' + (e.message || e)); }
  }

  async function share(uri) {
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Teilen ist nicht verfügbar.');
      await Sharing.shareAsync(uri, { mimeType: 'audio/wav', UTI: 'com.microsoft.waveform-audio' });
    } catch (e) { setMessage('Teilen fehlgeschlagen: ' + (e.message || e)); }
  }

  async function remove(f) {
    Alert.alert('Aufnahme löschen?', f.name, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        try {
          await FileSystem.deleteAsync(f.uri, { idempotent: true });
          if (current === f.uri) { player.pause(); setCurrent(null); }
          if (last === f.uri) setLast(null);
          await refresh();
        } catch (e) { setMessage(e.message); }
      } }
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>STEINWAY B-211 · iPAD NATIVE TEST</Text>
      <Text style={styles.h1}>Piano Capture Studio</Text>
      <Text style={styles.sub}>Native PCM · Beta 0.1</Text>
      <View style={styles.panel}>
        <Text style={styles.status}>{recState.isRecording ? '● AUFNAHME' : '● BEREIT'}</Text>
        <Text style={styles.timer}>{secs(recState.durationMillis)}</Text>
        <Text style={styles.label}>24-BIT PCM · 48 KHZ · 2 KANÄLE ANGEFORDERT</Text>
        <Action title="● Aufnahme starten" onPress={start} disabled={busy || recState.isRecording} />
        <Action title="■ Aufnahme stoppen" onPress={stop} danger disabled={busy || !recState.isRecording} />
        {!!last && !recState.isRecording && <Action title="▶ Letzten Take anhören" onPress={() => play(last)} />}
      </View>
      <View style={styles.note}><Text style={styles.noteText}>{message}</Text></View>
      <View style={styles.panel}>
        <Text style={styles.h2}>Aufnahmen ({files.length})</Text>
        {files.length === 0 && <Text style={styles.muted}>Noch keine WAV-Aufnahme vorhanden.</Text>}
        {files.map(f => (
          <View key={f.uri} style={styles.take}>
            <Text style={styles.file} numberOfLines={2}>{f.name}</Text>
            <Text style={styles.muted}>{mb(f.size)}</Text>
            <View style={styles.row}>
              <Action small title="▶ Hören" onPress={() => play(f.uri)} disabled={recState.isRecording} />
              <Action small title="Teilen" onPress={() => share(f.uri)} disabled={recState.isRecording} />
              <Action small danger title="Löschen" onPress={() => remove(f)} disabled={recState.isRecording} />
            </View>
          </View>
        ))}
        <Action title="Archiv aktualisieren" onPress={refresh} disabled={recState.isRecording} />
      </View>
      <Text style={styles.disclaimer}>
        Technische Testversion: Zwei Dateikanäle sind noch kein Beweis für zwei unabhängige iPad-Mikrofonkanäle.
        Echte Stereo-Mikrofoncharakteristik benötigt gegebenenfalls eine zusätzliche native AVAudioSession-Konfiguration.
        Keine Kompression oder Klangfilter der App; die iPadOS-Mikrofonverarbeitung ist damit noch nicht vollständig ausgeschlossen.
        Aufnahmen zur Sicherheit in die Dateien-App exportieren. Nicht als Produktionsaufnahme verwenden, bevor ein Test bestanden wurde.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b1320' },
  content: { maxWidth: 820, alignSelf: 'center', width: '100%', paddingHorizontal: 21, paddingTop: 65, paddingBottom: 60 },
  eyebrow: { color: '#9bdcca', letterSpacing: 2.5, fontSize: 11, fontWeight: '700' },
  h1: { color: '#edf5fa', fontSize: 31, fontWeight: '650', marginTop: 10 },
  sub: { color: '#abc0ce', fontSize: 14, marginTop: 5, marginBottom: 26 },
  panel: { backgroundColor: '#132333', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#2c4554', marginBottom: 16 },
  status: { textAlign: 'center', color: '#9bdcca', fontSize: 12, letterSpacing: 1.4, marginTop: 4 },
  timer: { color: '#f1f8fb', fontSize: 76, fontWeight: '200', textAlign: 'center', fontVariant: ['tabular-nums'], marginVertical: 10 },
  label: { color: '#a8bac6', textAlign: 'center', marginBottom: 24, fontSize: 10, letterSpacing: 1.1 },
  btn: { borderRadius: 12, borderWidth: 1, borderColor: '#547884', backgroundColor: '#203c47', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 17, marginTop: 10, minHeight: 51 },
  danger: { borderColor: '#824a53', backgroundColor: '#38232e' },
  small: { paddingHorizontal: 13, paddingVertical: 9, minHeight: 40, flex: 1 },
  btnText: { color: '#e8f5f3', fontSize: 16, fontWeight: '600' },
  note: { padding: 16, backgroundColor: '#1a2d38', borderRadius: 14, marginBottom: 16 },
  noteText: { color: '#c5dbe3', lineHeight: 22 },
  h2: { color: '#eaf4fa', fontSize: 19, fontWeight: '600', marginBottom: 12 },
  take: { borderTopWidth: 1, borderColor: '#365160', paddingTop: 15, marginTop: 12 },
  file: { color: '#e7f1f7', fontSize: 14, marginBottom: 6 },
  muted: { color: '#9cb2be', fontSize: 12 },
  row: { flexDirection: 'row', gap: 8, marginTop: 9 },
  disclaimer: { color: '#93a9b5', fontSize: 12, lineHeight: 18, marginTop: 6 },
});