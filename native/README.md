# Piano Capture Studio – native iPad test (Expo)
This is an experimental native iPad recording interface using expo-audio (AVAudioRecorder on iOS). It is **not** the Safari/GitHub Pages recorder.

## Launch without a Mac
Open https://snack.expo.dev/?name=Piano%20Capture%20Studio&platform=mydevice&supportedPlatforms=ios,mydevice&dependencies=expo-audio%40%2A%2Cexpo-file-system%40%2A%2Cexpo-sharing%40%2A&sourceUrl=https%3A%2F%2Fraw.githubusercontent.com%2Fhofcapellmeister-afk%2Fpianocapturestudio%2Fmain%2Fnative%2FApp.js on iPad. Install/open Expo Go from the App Store, then follow the "My Device" instructions. Test might require a second device to scan QR or login to Expo.

## Limitations
- Requests 48 kHz 24-bit linear PCM WAV, two recording channels; actual hardware route must be tested.
- iPad's built-in stereo mic support may require explicit AVAudioSession preferred data source and stereo polar pattern, which expo-audio does not expose in this test.
- Expo Go is a development container, not a standalone app. This project does not yet produce an installable .ipa.
- Saved files reside in Expo Go's document storage and must be exported using Share for durable preservation.
- No peak normalization, no compression, no EQ, no claim of guaranteed clean/true stereo.
- Does not include a real-time meter or strict validation of the WAV channel separation.
